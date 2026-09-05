use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use orarepot_common::{
    insert_outbox, sha256_hex, sign_jwt, user_id_from_headers, AppCfg, AppError,
};
use password_hash::rand_core::OsRng;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    cfg: AppCfg,
}

#[derive(Deserialize)]
struct RegisterBody {
    email: String,
    password: String,
    full_name: String,
    phone_e164: Option<String>,
}

#[derive(Deserialize)]
struct LoginBody {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct AuthOut {
    token: String,
    user: UserOut,
}

#[derive(Serialize, sqlx::FromRow)]
struct UserOut {
    id: Uuid,
    email: String,
    full_name: String,
    phone_e164: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();
    let db = std::env::var("DATABASE_URL")?;
    let bind = std::env::var("BIND").unwrap_or_else(|_| "0.0.0.0:8101".into());
    let pool = PgPool::connect(&db).await?;
    let state = AppState {
        pool,
        cfg: AppCfg::from_env(),
    };
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me).patch(update_me))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());
    let addr: SocketAddr = bind.parse()?;
    tracing::info!("orarepot-identity on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::internal(e.to_string()))
}

fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .ok()
        .and_then(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).ok())
        .is_some()
}

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterBody>,
) -> Result<Json<AuthOut>, AppError> {
    if body.email.is_empty() || body.password.len() < 8 {
        return Err(AppError::bad("email and password (min 8) required"));
    }
    let hash = hash_password(&body.password)?;
    let row = sqlx::query_as::<_, UserOut>(
        "INSERT INTO mt_users (email, password_hash, full_name, phone_e164)
         VALUES ($1,$2,$3,$4)
         RETURNING id, email::text AS email, full_name, phone_e164",
    )
    .bind(body.email.to_lowercase())
    .bind(&hash)
    .bind(&body.full_name)
    .bind(&body.phone_e164)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            AppError::conflict("email already registered")
        } else {
            AppError::from(e)
        }
    })?;
    sqlx::query("INSERT INTO mt_account_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(row.id)
        .execute(&state.pool)
        .await?;
    insert_outbox(
        &state.pool,
        "orarepot.user.created",
        "user",
        row.id,
        serde_json::json!({ "id": row.id, "email": row.email }),
    )
    .await?;
    issue(&state, row, None).await
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> Result<Json<AuthOut>, AppError> {
    let row = sqlx::query_as::<_, (Uuid, String, String, Option<String>, String)>(
        "SELECT id, email::text, full_name, phone_e164, password_hash
         FROM mt_users WHERE email = $1",
    )
    .bind(body.email.to_lowercase())
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::unauthorized("invalid credentials"))?;
    if !verify_password(&body.password, &row.4) {
        return Err(AppError::unauthorized("invalid credentials"));
    }
    sqlx::query("UPDATE mt_users SET last_login_at = now() WHERE id = $1")
        .bind(row.0)
        .execute(&state.pool)
        .await?;
    let user = UserOut {
        id: row.0,
        email: row.1,
        full_name: row.2,
        phone_e164: row.3,
    };
    issue(&state, user, None).await
}

async fn issue(
    state: &AppState,
    user: UserOut,
    ua: Option<String>,
) -> Result<Json<AuthOut>, AppError> {
    let token = sign_jwt(&state.cfg, user.id, &user.email)?;
    let token_hash = sha256_hex(&token);
    sqlx::query(
        "INSERT INTO cm_user_sessions (user_id, token_hash, user_agent, expires_at)
         VALUES ($1,$2,$3,$4)",
    )
    .bind(user.id)
    .bind(&token_hash)
    .bind(ua)
    .bind(Utc::now() + Duration::hours(12))
    .execute(&state.pool)
    .await?;
    Ok(Json(AuthOut { token, user }))
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = user_id_from_headers(&headers)?;
    if let Some(header) = headers.get(axum::http::header::AUTHORIZATION).and_then(|v| v.to_str().ok()) {
        if let Some(token) = header.strip_prefix("Bearer ") {
            sqlx::query(
                "UPDATE cm_user_sessions SET revoked_at = now()
                 WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL",
            )
            .bind(user_id)
            .bind(sha256_hex(token))
            .execute(&state.pool)
            .await?;
        }
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn me(State(state): State<AppState>, headers: HeaderMap) -> Result<Json<UserOut>, AppError> {
    let user_id = user_id_from_headers(&headers)?;
    let row = sqlx::query_as::<_, UserOut>(
        "SELECT id, email::text AS email, full_name, phone_e164 FROM mt_users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("user"))?;
    Ok(Json(row))
}

#[derive(Deserialize)]
struct UpdateMe {
    full_name: Option<String>,
    phone_e164: Option<String>,
}

async fn update_me(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<UpdateMe>,
) -> Result<Json<UserOut>, AppError> {
    let user_id = user_id_from_headers(&headers)?;
    let row = sqlx::query_as::<_, UserOut>(
        "UPDATE mt_users SET
            full_name = COALESCE($2, full_name),
            phone_e164 = COALESCE($3, phone_e164)
         WHERE id = $1
         RETURNING id, email::text AS email, full_name, phone_e164",
    )
    .bind(user_id)
    .bind(body.full_name)
    .bind(body.phone_e164)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}
