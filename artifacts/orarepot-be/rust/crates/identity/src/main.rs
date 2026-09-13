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
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    cfg: AppCfg,
    http: reqwest::Client,
    stub: bool,
    graph_version: String,
    phone_number_id: String,
    wa_token: String,
    otp_tpl_id_name: String,
    otp_tpl_id_lang: String,
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
        http: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .build()?,
        stub: std::env::var("WHATSAPP_STUB").unwrap_or_else(|_| "true".into()) != "false",
        graph_version: std::env::var("META_GRAPH_VERSION").unwrap_or_else(|_| "v26.0".into()),
        phone_number_id: std::env::var("META_PHONE_NUMBER_ID").unwrap_or_default(),
        wa_token: std::env::var("META_WA_TOKEN").unwrap_or_default(),
        otp_tpl_id_name: std::env::var("META_OTP_TEMPLATE_ID")
            .unwrap_or_else(|_| "otp_merchant_id".into()),
        otp_tpl_id_lang: std::env::var("META_OTP_TEMPLATE_ID_LANG").unwrap_or_else(|_| "id".into()),
    };
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/forgot-password", post(forgot_password))
        .route("/auth/reset-password", post(reset_password))
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

#[derive(Deserialize)]
struct ForgotBody {
    identifier: String,
}

#[derive(Deserialize)]
struct ResetBody {
    identifier: String,
    code: String,
    password: String,
}

fn to_e164(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let digits: String = trimmed.chars().filter(|c| c.is_ascii_digit()).collect();
    let e164 = if trimmed.starts_with('+') {
        format!("+{digits}")
    } else if digits.starts_with("62") {
        format!("+{digits}")
    } else if digits.starts_with('0') {
        format!("+62{}", &digits[1..])
    } else {
        format!("+{digits}")
    };
    if e164.len() >= 10 && e164.len() <= 16 {
        Some(e164)
    } else {
        None
    }
}

async fn find_user(
    pool: &PgPool,
    identifier: &str,
) -> Result<Option<(Uuid, String, Option<String>)>, AppError> {
    let raw = identifier.trim();
    if raw.contains('@') {
        let row = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
            "SELECT id, email::text, phone_e164 FROM mt_users WHERE email = $1",
        )
        .bind(raw.to_lowercase())
        .fetch_optional(pool)
        .await?;
        return Ok(row);
    }
    if let Some(phone) = to_e164(raw) {
        let row = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
            "SELECT id, email::text, phone_e164 FROM mt_users WHERE phone_e164 = $1",
        )
        .bind(&phone)
        .fetch_optional(pool)
        .await?;
        return Ok(row);
    }
    Ok(None)
}

async fn forgot_password(
    State(state): State<AppState>,
    Json(body): Json<ForgotBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let Some((user_id, _email, phone)) = find_user(&state.pool, &body.identifier).await? else {
        return Ok(Json(serde_json::json!({ "ok": true })));
    };
    let sent_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tx_password_resets
         WHERE user_id = $1
           AND (created_at AT TIME ZONE 'Asia/Jakarta')::date
             = (now() AT TIME ZONE 'Asia/Jakarta')::date",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;
    if sent_today >= 2 {
        return Err(AppError::conflict(
            "OTP reset password hanya bisa 2 kali per hari",
        ));
    }
    let phone = phone.filter(|p| !p.is_empty()).ok_or_else(|| {
        AppError::bad("akun belum punya nomor WhatsApp untuk kirim OTP")
    })?;
    let code = format!("{:06}", rand::thread_rng().gen_range(0..1_000_000));
    sqlx::query(
        "UPDATE tx_password_resets SET consumed_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL",
    )
    .bind(user_id)
    .execute(&state.pool)
    .await?;
    let reset_id: Uuid = sqlx::query_scalar(
        "INSERT INTO tx_password_resets (user_id, code_hash, expires_at)
         VALUES ($1,$2, now() + interval '10 minutes')
         RETURNING id",
    )
    .bind(user_id)
    .bind(sha256_hex(&code))
    .fetch_one(&state.pool)
    .await?;
    let send_result = if state.stub {
        tracing::info!(user_id = %user_id, "password reset OTP stubbed");
        Ok(String::from("stub"))
    } else {
        send_whatsapp(
            &state.http,
            &state.graph_version,
            &state.phone_number_id,
            &state.wa_token,
            &phone,
            &state.otp_tpl_id_name,
            &state.otp_tpl_id_lang,
            &code,
        )
        .await
    };
    if let Err(err) = send_result {
        sqlx::query("DELETE FROM tx_password_resets WHERE id = $1")
            .bind(reset_id)
            .execute(&state.pool)
            .await?;
        return Err(AppError::internal(err));
    }
    Ok(Json(serde_json::json!({
        "ok": true,
        "remaining_today": 2 - sent_today - 1
    })))
}

async fn reset_password(
    State(state): State<AppState>,
    Json(body): Json<ResetBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    if body.password.len() < 8 {
        return Err(AppError::bad("password min 8"));
    }
    let code = body.code.chars().filter(|c| c.is_ascii_digit()).collect::<String>();
    if code.len() < 4 || code.len() > 8 {
        return Err(AppError::bad("kode OTP tidak valid"));
    }
    let Some((user_id, _, _)) = find_user(&state.pool, &body.identifier).await? else {
        return Err(AppError::unauthorized("kode OTP salah atau kadaluarsa"));
    };
    let row = sqlx::query_as::<_, (Uuid,)>(
        "SELECT id FROM tx_password_resets
         WHERE user_id = $1 AND code_hash = $2 AND consumed_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(user_id)
    .bind(sha256_hex(&code))
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::unauthorized("kode OTP salah atau kadaluarsa"))?;
    let hash = hash_password(&body.password)?;
    sqlx::query("UPDATE mt_users SET password_hash = $2 WHERE id = $1")
        .bind(user_id)
        .bind(&hash)
        .execute(&state.pool)
        .await?;
    sqlx::query("UPDATE tx_password_resets SET consumed_at = now() WHERE id = $1")
        .bind(row.0)
        .execute(&state.pool)
        .await?;
    sqlx::query(
        "UPDATE cm_user_sessions SET revoked_at = now()
         WHERE user_id = $1 AND revoked_at IS NULL",
    )
    .bind(user_id)
    .execute(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

fn digits_only(phone_e164: &str) -> String {
    phone_e164.chars().filter(|c| c.is_ascii_digit()).collect()
}

async fn send_whatsapp(
    http: &reqwest::Client,
    graph_version: &str,
    phone_number_id: &str,
    token: &str,
    phone_e164: &str,
    template_name: &str,
    language_code: &str,
    code: &str,
) -> Result<String, String> {
    if token.is_empty() {
        return Err("META_WA_TOKEN is empty".into());
    }
    if phone_number_id.is_empty() {
        return Err("META_PHONE_NUMBER_ID is empty".into());
    }
    let to = digits_only(phone_e164);
    let url = format!("https://graph.facebook.com/{graph_version}/{phone_number_id}/messages");
    let payload = serde_json::json!({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": { "code": language_code },
            "components": [
                {
                    "type": "body",
                    "parameters": [{ "type": "text", "text": code }]
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{ "type": "text", "text": code }]
                }
            ]
        }
    });
    let res = http
        .post(&url)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let msg = json
            .pointer("/error/message")
            .and_then(|v| v.as_str())
            .unwrap_or("graph api error");
        return Err(format!("meta {status}: {msg}"));
    }
    json.pointer("/messages/0/id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| "graph api returned no message id".into())
}
