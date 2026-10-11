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
    google_client_id: String,
    google_client_secret: String,
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
    /// Email or WhatsApp. `email` is the form field; `identifier` is accepted too.
    #[serde(default)]
    email: String,
    #[serde(default)]
    identifier: String,
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
        google_client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
        google_client_secret: std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
    };
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/google", post(google_login))
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

fn login_identifier(body: &LoginBody) -> String {
    let email = body.email.trim();
    if !email.is_empty() {
        return email.to_string();
    }
    body.identifier.trim().to_string()
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> Result<Json<AuthOut>, AppError> {
    let identifier = login_identifier(&body);
    if identifier.is_empty() || body.password.is_empty() {
        return Err(AppError::unauthorized("invalid credentials"));
    }

    let candidates = if identifier.contains('@') {
        sqlx::query_as::<_, (Uuid, String, String, Option<String>, String)>(
            "SELECT id, email::text, full_name, phone_e164, password_hash
             FROM mt_users WHERE email = $1",
        )
        .bind(identifier.to_lowercase())
        .fetch_all(&state.pool)
        .await?
    } else if let Some(phone) = to_e164(&identifier) {
        sqlx::query_as::<_, (Uuid, String, String, Option<String>, String)>(
            "SELECT id, email::text, full_name, phone_e164, password_hash
             FROM mt_users WHERE phone_e164 = $1",
        )
        .bind(&phone)
        .fetch_all(&state.pool)
        .await?
    } else {
        Vec::new()
    };

    let matched: Vec<_> = candidates
        .into_iter()
        .filter(|row| verify_password(&body.password, &row.4))
        .collect();

    let row = match matched.len() {
        0 => return Err(AppError::unauthorized("invalid credentials")),
        1 => matched.into_iter().next().expect("len checked"),
        _ => {
            return Err(AppError::bad(
                "Nomor WhatsApp ini terdaftar di lebih dari satu akun. Masuk dengan email.",
            ));
        }
    };

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

#[derive(Deserialize)]
struct GoogleBody {
    code: String,
}

struct GoogleProfile {
    sub: String,
    email: String,
    name: String,
    email_verified: bool,
}

fn urlencode(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn json_flag(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Bool(flag) => *flag,
        serde_json::Value::String(text) => text.eq_ignore_ascii_case("true"),
        _ => false,
    }
}

async fn exchange_google_code(state: &AppState, code: &str) -> Result<GoogleProfile, AppError> {
    let body = format!(
        "code={}&client_id={}&client_secret={}&redirect_uri=postmessage&grant_type=authorization_code",
        urlencode(code),
        urlencode(&state.google_client_id),
        urlencode(&state.google_client_secret),
    );
    let token_res = state
        .http
        .post("https://oauth2.googleapis.com/token")
        .header("content-type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|err| AppError::internal(err.to_string()))?;
    let token_status = token_res.status();
    let token_json: serde_json::Value = token_res
        .json()
        .await
        .map_err(|err| AppError::internal(err.to_string()))?;
    if !token_status.is_success() {
        let message = token_json
            .get("error_description")
            .or_else(|| token_json.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("Google token exchange failed");
        return Err(AppError::unauthorized(message));
    }
    let id_token = token_json
        .get("id_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::unauthorized("Google did not return an id token"))?;
    let info_res = state
        .http
        .get("https://oauth2.googleapis.com/tokeninfo")
        .query(&[("id_token", id_token)])
        .send()
        .await
        .map_err(|err| AppError::internal(err.to_string()))?;
    let info_status = info_res.status();
    let info: serde_json::Value = info_res
        .json()
        .await
        .map_err(|err| AppError::internal(err.to_string()))?;
    if !info_status.is_success() {
        return Err(AppError::unauthorized("Google id token rejected"));
    }
    let aud = info.get("aud").and_then(|v| v.as_str()).unwrap_or("");
    if aud != state.google_client_id {
        return Err(AppError::unauthorized("Google token audience mismatch"));
    }
    let email = info
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    let sub = info.get("sub").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if email.is_empty() || sub.is_empty() {
        return Err(AppError::unauthorized("Google account has no email"));
    }
    let name = info
        .get("name")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| email.split('@').next().unwrap_or("Ora Repot"))
        .to_string();
    Ok(GoogleProfile {
        sub,
        email,
        name,
        email_verified: info.get("email_verified").map(json_flag).unwrap_or(false),
    })
}

async fn upsert_google_user(state: &AppState, profile: &GoogleProfile) -> Result<UserOut, AppError> {
    if !profile.email_verified {
        return Err(AppError::unauthorized("Google email is not verified"));
    }
    let linked = sqlx::query_as::<_, UserOut>(
        "UPDATE mt_users
         SET last_login_at = now(),
             email_verified_at = COALESCE(email_verified_at, now())
         WHERE google_sub = $1
         RETURNING id, email::text AS email, full_name, phone_e164",
    )
    .bind(&profile.sub)
    .fetch_optional(&state.pool)
    .await?;
    if let Some(user) = linked {
        return Ok(user);
    }

    let existing = sqlx::query_as::<_, (Uuid, Option<String>)>(
        "SELECT id, google_sub FROM mt_users WHERE email = $1",
    )
    .bind(&profile.email)
    .fetch_optional(&state.pool)
    .await?;
    if let Some((id, google_sub)) = existing {
        if google_sub.as_deref().is_some_and(|current| current != profile.sub) {
            return Err(AppError::conflict(
                "email already linked to another Google account",
            ));
        }
        return Ok(sqlx::query_as::<_, UserOut>(
            "UPDATE mt_users
             SET google_sub = $2,
                 last_login_at = now(),
                 email_verified_at = COALESCE(email_verified_at, now())
             WHERE id = $1
             RETURNING id, email::text AS email, full_name, phone_e164",
        )
        .bind(id)
        .bind(&profile.sub)
        .fetch_one(&state.pool)
        .await?);
    }

    let hash = hash_password(&Uuid::new_v4().to_string())?;
    let user = sqlx::query_as::<_, UserOut>(
        "INSERT INTO mt_users
           (email, password_hash, full_name, google_sub, email_verified_at, last_login_at)
         VALUES ($1,$2,$3,$4, now(), now())
         RETURNING id, email::text AS email, full_name, phone_e164",
    )
    .bind(&profile.email)
    .bind(&hash)
    .bind(&profile.name)
    .bind(&profile.sub)
    .fetch_one(&state.pool)
    .await
    .map_err(|err| {
        if err.to_string().contains("unique") {
            AppError::conflict("email already registered")
        } else {
            AppError::from(err)
        }
    })?;
    sqlx::query("INSERT INTO mt_account_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(user.id)
        .execute(&state.pool)
        .await?;
    insert_outbox(
        &state.pool,
        "orarepot.user.created",
        "user",
        user.id,
        serde_json::json!({ "id": user.id, "email": user.email, "provider": "google" }),
    )
    .await?;
    Ok(user)
}

async fn google_login(
    State(state): State<AppState>,
    Json(body): Json<GoogleBody>,
) -> Result<Json<AuthOut>, AppError> {
    if state.google_client_id.is_empty() || state.google_client_secret.is_empty() {
        return Err(AppError::internal("Google OAuth is not configured"));
    }
    let code = body.code.trim();
    if code.is_empty() {
        return Err(AppError::bad("missing Google code"));
    }
    let profile = exchange_google_code(&state, code).await?;
    let user = upsert_google_user(&state, &profile).await?;
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
        let rows = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
            "SELECT id, email::text, phone_e164 FROM mt_users WHERE phone_e164 = $1",
        )
        .bind(&phone)
        .fetch_all(pool)
        .await?;
        if rows.len() > 1 {
            return Err(AppError::bad(
                "Nomor WhatsApp ini terdaftar di lebih dari satu akun. Gunakan email.",
            ));
        }
        return Ok(rows.into_iter().next());
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
    let Some((user_id, email, _)) = find_user(&state.pool, &body.identifier).await? else {
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
    let updated = sqlx::query("UPDATE mt_users SET password_hash = $2, updated_at = now() WHERE id = $1")
        .bind(user_id)
        .bind(&hash)
        .execute(&state.pool)
        .await?
        .rows_affected();
    if updated != 1 {
        return Err(AppError::internal("failed to update password"));
    }
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
    Ok(Json(serde_json::json!({ "ok": true, "email": email })))
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
