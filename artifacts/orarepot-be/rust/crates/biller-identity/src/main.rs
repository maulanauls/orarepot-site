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
use jsonwebtoken::{encode, EncodingKey, Header};
use orarepot_common::{user_id_from_headers, AppCfg, AppError};
use password_hash::rand_core::OsRng;
use rand::Rng;
use redis::aio::MultiplexedConnection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::{net::SocketAddr, sync::Arc};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use uuid::Uuid;

/// Sessions have no idle expiry: they live until the user logs out, so the JWT
/// exp only exists because the gateway parser requires one.
const TOKEN_LIFETIME_DAYS: i64 = 3650;
const OTP_TTL_SECS: u64 = 5 * 60;
const OTP_RESEND_SECS: u64 = 60;
const OTP_MAX_ATTEMPTS: u32 = 5;

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    cfg: AppCfg,
    redis: MultiplexedConnection,
    otp: Arc<OtpConfig>,
    google_client_id: String,
    google_client_secret: String,
}

struct OtpConfig {
    http: reqwest::Client,
    notify_url: Option<String>,
    notify_token: Option<String>,
    /// Official Meta WhatsApp Cloud API (same stack as orarepot-otp).
    meta_graph_version: String,
    meta_phone_number_id: Option<String>,
    meta_wa_token: Option<String>,
    meta_tpl_name: String,
    meta_tpl_lang: String,
    dev_log: bool,
}

impl OtpConfig {
    fn from_env() -> Result<Self, reqwest::Error> {
        let nonempty = |key: &str| std::env::var(key).ok().filter(|v| !v.trim().is_empty());
        Ok(Self {
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()?,
            notify_url: nonempty("OTP_NOTIFY_URL"),
            notify_token: nonempty("OTP_NOTIFY_TOKEN"),
            meta_graph_version: nonempty("META_GRAPH_VERSION").unwrap_or_else(|| "v26.0".into()),
            meta_phone_number_id: nonempty("META_PHONE_NUMBER_ID"),
            meta_wa_token: nonempty("META_WA_TOKEN"),
            meta_tpl_name: nonempty("META_OTP_TEMPLATE_ID").unwrap_or_else(|| "otp_merchant_id".into()),
            meta_tpl_lang: nonempty("META_OTP_TEMPLATE_ID_LANG").unwrap_or_else(|| "id".into()),
            dev_log: nonempty("OTP_DEV_LOG").is_some_and(|v| v == "1"),
        })
    }

    fn meta_ready(&self) -> bool {
        self.meta_wa_token.as_deref().is_some_and(|v| !v.is_empty())
            && self.meta_phone_number_id.as_deref().is_some_and(|v| !v.is_empty())
    }
}

#[derive(Deserialize)]
struct RegisterBody {
    #[serde(default)]
    full_name: String,
    #[serde(default)]
    identifier: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    phone: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginBody {
    #[serde(default)]
    identifier: String,
    #[serde(default)]
    email: String,
    password: String,
}

#[derive(Serialize, sqlx::FromRow)]
struct UserOut {
    users_idf: Uuid,
    users_fullname: Option<String>,
    users_email: Option<String>,
    user_phonenumber: Option<String>,
}

#[derive(Serialize)]
struct AuthOut {
    token: String,
    user: UserOut,
}

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: String,
    email: String,
    kind: String,
    jti: String,
    iat: i64,
    exp: i64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();
    let db = std::env::var("DATABASE_URL")?;
    let bind = std::env::var("BIND").unwrap_or_else(|_| "0.0.0.0:8104".into());
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into());
    let pool = PgPool::connect(&db).await?;
    sqlx::query(
        "ALTER TABLE mt_users ADD COLUMN IF NOT EXISTS users_google_sub character varying",
    )
    .execute(&pool)
    .await?;
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS mt_users_google_sub_uidx
         ON mt_users (users_google_sub) WHERE users_google_sub IS NOT NULL",
    )
    .execute(&pool)
    .await?;
    let client = redis::Client::open(redis_url)?;
    let redis = client.get_multiplexed_async_connection().await?;
    let otp = OtpConfig::from_env()?;
    if !otp.meta_ready() && otp.notify_url.is_none() {
        if otp.dev_log {
            tracing::warn!("OTP delivery unset: codes are written to the log (dev only)");
        } else {
            tracing::warn!("META_WA_TOKEN / OTP_NOTIFY_URL unset: WhatsApp claim OTP cannot be sent");
        }
    } else if otp.meta_ready() {
        tracing::info!(template = %otp.meta_tpl_name, "OTP delivery via Meta Cloud API");
    } else {
        tracing::info!("OTP delivery via OTP_NOTIFY_URL");
    }
    let google_client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
    let google_client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();
    if google_client_id.is_empty() || google_client_secret.is_empty() {
        tracing::warn!("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET unset: Google login disabled");
    } else {
        tracing::info!("Google login enabled for biller customers");
    }
    let state = AppState {
        pool,
        cfg: AppCfg::from_env(),
        redis,
        otp: Arc::new(otp),
        google_client_id,
        google_client_secret,
    };
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/biller/auth/register", post(register))
        .route("/biller/auth/enter", post(enter))
        .route("/biller/auth/enter/verify", post(enter_verify))
        .route("/biller/auth/login", post(login))
        .route("/biller/auth/google", post(google_login))
        .route("/biller/auth/logout", post(logout))
        .route("/biller/auth/me", get(me))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());
    let addr: SocketAddr = bind.parse()?;
    tracing::info!("orarepot-biller-identity on {addr}");
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

fn split_name(full_name: &str) -> (String, Option<String>, Option<String>) {
    let full = full_name.trim().to_string();
    let mut parts = full.split_whitespace();
    let first = parts.next().map(|s| s.to_string());
    let last = parts.collect::<Vec<_>>().join(" ");
    let last = if last.is_empty() { None } else { Some(last) };
    (full, first, last)
}

fn normalize_phone(raw: &str) -> Option<String> {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 9 {
        return None;
    }
    let local = if let Some(rest) = digits.strip_prefix("62") {
        format!("0{rest}")
    } else if digits.starts_with('0') {
        digits
    } else {
        format!("0{digits}")
    };
    Some(local)
}

/// The WhatsApp bot stores `62…` while older web rows store `0…`; match either.
fn phone_variants(local: &str) -> [String; 2] {
    let rest = local.strip_prefix('0').unwrap_or(local);
    [local.to_string(), format!("62{rest}")]
}

fn phone_intl(local: &str) -> String {
    let [_, intl] = phone_variants(local);
    intl
}

fn otp_digest(challenge: &str, code: &str) -> String {
    hex::encode(Sha256::digest(format!("{challenge}:{code}").as_bytes()))
}

fn identifier_of(body_identifier: &str, body_email: &str) -> String {
    let email = body_email.trim();
    if !email.is_empty() {
        email.to_string()
    } else {
        body_identifier.trim().to_string()
    }
}

fn contact_of(body: &RegisterBody) -> Result<(Option<String>, Option<String>), AppError> {
    let mut email = body.email.trim().to_lowercase();
    let mut phone_raw = body.phone.trim().to_string();
    let identifier = body.identifier.trim();
    if !identifier.is_empty() {
        if identifier.contains('@') && email.is_empty() {
            email = identifier.to_lowercase();
        } else if !identifier.contains('@') && phone_raw.is_empty() {
            phone_raw = identifier.to_string();
        }
    }
    let email = if email.is_empty() {
        None
    } else if email.contains('@') && email.split('@').nth(1).is_some_and(|host| host.contains('.')) {
        Some(email)
    } else {
        return Err(AppError::bad("email tidak valid"));
    };
    let phone = if phone_raw.is_empty() {
        None
    } else {
        Some(normalize_phone(&phone_raw).ok_or_else(|| AppError::bad("nomor telepon tidak valid"))?)
    };
    if email.is_none() && phone.is_none() {
        return Err(AppError::bad("email atau nomor WhatsApp wajib diisi"));
    }
    Ok((email, phone))
}

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterBody>,
) -> Result<Json<AuthOut>, AppError> {
    let (email, phone) = contact_of(&body)?;
    let name_source = if body.full_name.trim().is_empty() {
        email.clone().or(phone.clone()).unwrap_or_default()
    } else {
        body.full_name.clone()
    };
    let (full, first, last) = split_name(&name_source);
    if full.is_empty() || body.password.len() < 8 {
        return Err(AppError::bad("nama dan kata sandi (min 8) wajib diisi"));
    }
    if let Some(email) = &email {
        let taken: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM mt_users WHERE lower(users_email) = $1)",
        )
        .bind(email)
        .fetch_one(&state.pool)
        .await?;
        if taken {
            return Err(AppError::conflict("email sudah terdaftar"));
        }
    }
    if let Some(local) = &phone {
        let taken: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM mt_users WHERE user_phonenumber = ANY($1))",
        )
        .bind(phone_variants(local).to_vec())
        .fetch_one(&state.pool)
        .await?;
        if taken {
            return Err(AppError::conflict("nomor WhatsApp sudah terdaftar"));
        }
    }
    let phone = phone.as_deref().map(phone_intl);
    let hash = hash_password(&body.password)?;
    let user = sqlx::query_as::<_, UserOut>(
        "INSERT INTO mt_users (
            users_fullname, users_firstname, users_lastname, users_email,
            users_credentials, user_phonenumber, users_status, users_created_date
         ) VALUES ($1,$2,$3,$4,$5,$6,1, now())
         RETURNING users_idf, users_fullname, users_email, user_phonenumber",
    )
    .bind(&full)
    .bind(&first)
    .bind(&last)
    .bind(&email)
    .bind(&hash)
    .bind(&phone)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("unique") || msg.contains("duplicate") {
            AppError::conflict("nomor WhatsApp sudah terdaftar")
        } else {
            AppError::from(e)
        }
    })?;
    issue(&state, user).await
}

#[derive(Deserialize)]
struct EnterBody {
    #[serde(default)]
    email: String,
    #[serde(default)]
    phone: String,
    password: String,
}

fn valid_email(email: &str) -> bool {
    email.contains('@') && email.split('@').nth(1).is_some_and(|host| host.contains('.'))
}

async fn enter(
    State(state): State<AppState>,
    Json(body): Json<EnterBody>,
) -> Result<Json<Value>, AppError> {
    let email = body.email.trim().to_lowercase();
    let phone = normalize_phone(&body.phone);
    if email.is_empty() && phone.is_none() {
        return Err(AppError::bad("email atau nomor WhatsApp wajib diisi"));
    }
    if !email.is_empty() && !valid_email(&email) {
        return Err(AppError::bad("email tidak valid"));
    }
    if body.password.len() < 8 {
        return Err(AppError::bad("kata sandi minimal 8 karakter"));
    }
    if let Some(phone) = phone.as_ref() {
        // Prefer the WhatsApp-linked row (62… / chat_id) so we claim that account
        // instead of creating or logging into a later 08… duplicate.
        let existing = sqlx::query_as::<_, ClaimRow>(
            "SELECT users_idf, users_fullname, users_email, user_phonenumber, users_credentials, users_chat_id
             FROM mt_users
             WHERE user_phonenumber = ANY($1) AND users_status = 1
             ORDER BY
               (NULLIF(BTRIM(users_chat_id), '') IS NOT NULL) DESC,
               users_created_date ASC,
               (users_credentials IS NOT NULL) DESC
             LIMIT 1",
        )
        .bind(phone_variants(phone).to_vec())
        .fetch_optional(&state.pool)
        .await?;
        if let Some(row) = existing {
            if let Some(hash) = row.users_credentials.as_deref() {
                if !verify_password(&body.password, hash) {
                    return Err(AppError::unauthorized("email atau kata sandi salah"));
                }
                sqlx::query("UPDATE mt_users SET users_updated_date = now() WHERE users_idf = $1")
                    .bind(row.users_idf)
                    .execute(&state.pool)
                    .await?;
                return auth_json(issue(&state, row.into_user()).await?);
            }
            let claim_email = if email.is_empty() {
                row.users_email.clone().unwrap_or_default()
            } else {
                email.clone()
            };
            return start_claim(&state, row, claim_email, &body.password).await;
        }
    }
    if !email.is_empty() {
        let by_email = sqlx::query_as::<_, ClaimRow>(
            "SELECT users_idf, users_fullname, users_email, user_phonenumber, users_credentials, users_chat_id
             FROM mt_users
             WHERE lower(users_email) = $1 AND users_status = 1
             LIMIT 1",
        )
        .bind(&email)
        .fetch_optional(&state.pool)
        .await?;
        if let Some(row) = by_email {
            let Some(hash) = row.users_credentials.as_deref() else {
                return Err(AppError::unauthorized(
                    "akun ini belum punya kata sandi web, masuk dengan nomor WhatsApp",
                ));
            };
            if !verify_password(&body.password, hash) {
                return Err(AppError::unauthorized("email atau kata sandi salah"));
            }
            sqlx::query("UPDATE mt_users SET users_updated_date = now() WHERE users_idf = $1")
                .bind(row.users_idf)
                .execute(&state.pool)
                .await?;
            return auth_json(issue(&state, row.into_user()).await?);
        }
    }
    let auth = register(
        State(state),
        Json(RegisterBody {
            full_name: if !email.is_empty() {
                email.clone()
            } else {
                phone.clone().unwrap_or_default()
            },
            identifier: String::new(),
            email,
            phone: phone.unwrap_or_default(),
            password: body.password,
        }),
    )
    .await?;
    auth_json(auth)
}

fn auth_json(auth: Json<AuthOut>) -> Result<Json<Value>, AppError> {
    serde_json::to_value(auth.0)
        .map(Json)
        .map_err(|e| AppError::internal(e.to_string()))
}

#[derive(sqlx::FromRow)]
struct ClaimRow {
    users_idf: Uuid,
    users_fullname: Option<String>,
    users_email: Option<String>,
    user_phonenumber: Option<String>,
    users_credentials: Option<String>,
    users_chat_id: Option<String>,
}

impl ClaimRow {
    fn into_user(self) -> UserOut {
        UserOut {
            users_idf: self.users_idf,
            users_fullname: self.users_fullname,
            users_email: self.users_email,
            user_phonenumber: self.user_phonenumber,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Challenge {
    user_id: Uuid,
    email: Option<String>,
    password_hash: String,
    code_digest: String,
    attempts: u32,
}

/// A WhatsApp-created account has no password yet. Owning the phone number is
/// proven with a code sent to that account's WhatsApp chat before the web
/// password is attached, otherwise anyone could take over its Koin balance.
async fn start_claim(
    state: &AppState,
    row: ClaimRow,
    email: String,
    password: &str,
) -> Result<Json<Value>, AppError> {
    let Some(chat_id) = row.users_chat_id.clone() else {
        return Err(AppError::conflict(
            "nomor ini terdaftar tapi belum bisa diverifikasi, hubungi admin",
        ));
    };
    let phone = row
        .user_phonenumber
        .as_deref()
        .and_then(normalize_phone)
        .map(|local| phone_intl(&local))
        .ok_or_else(|| AppError::conflict("nomor WhatsApp akun tidak valid"))?;
    let attach_email = match row.users_email.as_deref() {
        Some(current) if email.is_empty() || current.eq_ignore_ascii_case(&email) => None,
        Some(_) => return Err(AppError::unauthorized("email tidak cocok dengan akun nomor ini")),
        None if email.is_empty() || !valid_email(&email) => None,
        None => {
            let taken: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM mt_users WHERE lower(users_email) = $1 AND users_idf <> $2)",
            )
            .bind(&email)
            .bind(row.users_idf)
            .fetch_one(&state.pool)
            .await?;
            if taken {
                return Err(AppError::conflict("email sudah dipakai akun lain"));
            }
            Some(email)
        }
    };
    let mut redis = state.redis.clone();
    let cooling: Option<String> = redis::cmd("SET")
        .arg(format!("biller:otp:cool:{}", row.users_idf))
        .arg("1")
        .arg("NX")
        .arg("EX")
        .arg(OTP_RESEND_SECS)
        .query_async(&mut redis)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
    if cooling.is_none() {
        return Err(AppError::conflict("kode baru saja dikirim, tunggu 1 menit sebelum minta lagi"));
    }
    let challenge = Uuid::new_v4().to_string();
    let code = format!("{:06}", rand::thread_rng().gen_range(0..1_000_000));
    let pending = Challenge {
        user_id: row.users_idf,
        email: attach_email,
        password_hash: hash_password(password)?,
        code_digest: otp_digest(&challenge, &code),
        attempts: 0,
    };
    let raw = serde_json::to_string(&pending).map_err(|e| AppError::internal(e.to_string()))?;
    let _: () = redis::cmd("SET")
        .arg(format!("biller:otp:{challenge}"))
        .arg(raw)
        .arg("EX")
        .arg(OTP_TTL_SECS)
        .query_async(&mut redis)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
    if let Err(err) = send_otp(state, &phone, &chat_id, &code).await {
        let _: Result<(), _> = redis::cmd("DEL")
            .arg(format!("biller:otp:{challenge}"))
            .arg(format!("biller:otp:cool:{}", row.users_idf))
            .query_async(&mut redis)
            .await;
        return Err(err);
    }
    Ok(Json(json!({
        "otp_required": true,
        "challenge": challenge,
        "expires_in": OTP_TTL_SECS,
        "resend_in": OTP_RESEND_SECS,
    })))
}

async fn send_otp(state: &AppState, phone_intl: &str, chat_id: &str, code: &str) -> Result<(), AppError> {
    let otp = &state.otp;
    if otp.meta_ready() {
        match send_otp_meta(otp, phone_intl, code).await {
            Ok(()) => return Ok(()),
            Err(err) => {
                tracing::error!(error = %err, phone = %phone_intl, "Meta OTP send failed");
                if otp.notify_url.is_none() && !otp.dev_log {
                    return Err(AppError::internal("kode WhatsApp gagal dikirim, coba lagi"));
                }
            }
        }
    }
    if let Some(url) = otp.notify_url.as_deref() {
        let mut request = otp.http.post(url).json(&json!({ "chat_id": chat_id, "code": code }));
        if let Some(token) = otp.notify_token.as_deref() {
            request = request.header("x-internal-token", token);
        }
        let response = request.send().await.map_err(|e| {
            tracing::error!(error = %e, "OTP notify unreachable");
            AppError::internal("kode WhatsApp gagal dikirim, coba lagi")
        })?;
        if !response.status().is_success() {
            tracing::error!(status = %response.status(), "OTP notify rejected");
            return Err(AppError::internal("kode WhatsApp gagal dikirim, coba lagi"));
        }
        return Ok(());
    }
    if otp.dev_log {
        tracing::warn!(chat_id, phone = %phone_intl, code, "OTP (dev log, not sent)");
        return Ok(());
    }
    Err(AppError::internal("pengiriman kode WhatsApp belum aktif"))
}

async fn send_otp_meta(otp: &OtpConfig, phone_intl: &str, code: &str) -> Result<(), String> {
    let token = otp.meta_wa_token.as_deref().unwrap_or("");
    let phone_number_id = otp.meta_phone_number_id.as_deref().unwrap_or("");
    let to: String = phone_intl.chars().filter(|c| c.is_ascii_digit()).collect();
    if to.len() < 10 {
        return Err("phone too short for Meta".into());
    }
    let url = format!(
        "https://graph.facebook.com/{}/{}/messages",
        otp.meta_graph_version, phone_number_id
    );
    let payload = json!({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": otp.meta_tpl_name,
            "language": { "code": otp.meta_tpl_lang },
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
    let response = otp
        .http
        .post(url)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let msg = body
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("graph api error");
        return Err(format!("meta {status}: {msg}"));
    }
    if body.pointer("/messages/0/id").and_then(Value::as_str).is_none() {
        return Err("graph api returned no message id".into());
    }
    Ok(())
}

#[derive(Deserialize)]
struct VerifyBody {
    challenge: String,
    code: String,
}

async fn enter_verify(
    State(state): State<AppState>,
    Json(body): Json<VerifyBody>,
) -> Result<Json<AuthOut>, AppError> {
    let challenge = body.challenge.trim();
    let code: String = body.code.chars().filter(|c| c.is_ascii_digit()).collect();
    if Uuid::parse_str(challenge).is_err() {
        return Err(AppError::bad("sesi verifikasi tidak valid, minta kode baru"));
    }
    if code.len() != 6 {
        return Err(AppError::bad("kode harus tepat 6 angka"));
    }
    let key = format!("biller:otp:{challenge}");
    let mut redis = state.redis.clone();
    let raw: Option<String> = redis::cmd("GET")
        .arg(&key)
        .query_async(&mut redis)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
    let Some(raw) = raw else {
        return Err(AppError::bad("kode sudah kedaluwarsa, minta kode baru"));
    };
    let mut pending: Challenge =
        serde_json::from_str(&raw).map_err(|e| AppError::internal(e.to_string()))?;
    if otp_digest(challenge, &code) != pending.code_digest {
        pending.attempts += 1;
        if pending.attempts >= OTP_MAX_ATTEMPTS {
            let _: () = redis::cmd("DEL")
                .arg(&key)
                .query_async(&mut redis)
                .await
                .map_err(|e| AppError::internal(e.to_string()))?;
            return Err(AppError::unauthorized("kode salah terlalu sering, minta kode baru"));
        }
        let raw = serde_json::to_string(&pending).map_err(|e| AppError::internal(e.to_string()))?;
        let _: () = redis::cmd("SET")
            .arg(&key)
            .arg(raw)
            .arg("KEEPTTL")
            .query_async(&mut redis)
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;
        return Err(AppError::unauthorized("kode salah"));
    }
    let _: () = redis::cmd("DEL")
        .arg(&key)
        .query_async(&mut redis)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
    let user = sqlx::query_as::<_, UserOut>(
        "UPDATE mt_users
         SET users_credentials = $2,
             users_email = COALESCE(users_email, $3),
             users_updated_date = now()
         WHERE users_idf = $1 AND users_credentials IS NULL AND users_status = 1
         RETURNING users_idf, users_fullname, users_email, user_phonenumber",
    )
    .bind(pending.user_id)
    .bind(&pending.password_hash)
    .bind(&pending.email)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("unique") || msg.contains("duplicate") {
            AppError::conflict("email sudah dipakai akun lain")
        } else {
            AppError::from(e)
        }
    })?
    .ok_or_else(|| AppError::conflict("akun ini sudah punya kata sandi, silakan masuk"))?;
    issue(&state, user).await
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> Result<Json<AuthOut>, AppError> {
    let identifier = identifier_of(&body.identifier, &body.email);
    if identifier.is_empty() || body.password.is_empty() {
        return Err(AppError::unauthorized("email atau kata sandi salah"));
    }
    let row = if identifier.contains('@') {
        sqlx::query_as::<_, AuthRow>(
            "SELECT users_idf, users_fullname, users_email, user_phonenumber, users_credentials
             FROM mt_users
             WHERE lower(users_email) = $1 AND users_status = 1",
        )
        .bind(identifier.to_lowercase())
        .fetch_optional(&state.pool)
        .await?
    } else if let Some(phone) = normalize_phone(&identifier) {
        sqlx::query_as::<_, AuthRow>(
            "SELECT users_idf, users_fullname, users_email, user_phonenumber, users_credentials
             FROM mt_users
             WHERE user_phonenumber = ANY($1) AND users_status = 1
             ORDER BY
               (users_credentials IS NOT NULL) DESC,
               (NULLIF(BTRIM(users_chat_id), '') IS NOT NULL) DESC,
               users_created_date ASC
             LIMIT 1",
        )
        .bind(phone_variants(&phone).to_vec())
        .fetch_optional(&state.pool)
        .await?
    } else {
        None
    };
    let Some(row) = row else {
        return Err(AppError::unauthorized("email atau kata sandi salah"));
    };
    let Some(hash) = row.users_credentials.clone() else {
        return Err(AppError::unauthorized("email atau kata sandi salah"));
    };
    if !verify_password(&body.password, &hash) {
        return Err(AppError::unauthorized("email atau kata sandi salah"));
    }
    sqlx::query("UPDATE mt_users SET users_updated_date = now() WHERE users_idf = $1")
        .bind(row.users_idf)
        .execute(&state.pool)
        .await?;
    issue(&state, row.into_user()).await
}

#[derive(sqlx::FromRow)]
struct AuthRow {
    users_idf: Uuid,
    users_fullname: Option<String>,
    users_email: Option<String>,
    user_phonenumber: Option<String>,
    users_credentials: Option<String>,
}

impl AuthRow {
    fn into_user(self) -> UserOut {
        UserOut {
            users_idf: self.users_idf,
            users_fullname: self.users_fullname,
            users_email: self.users_email,
            user_phonenumber: self.user_phonenumber,
        }
    }
}

async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<UserOut>, AppError> {
    let user_id = user_id_from_headers(&headers)?;
    let user = sqlx::query_as::<_, UserOut>(
        "SELECT users_idf, users_fullname, users_email, user_phonenumber
         FROM mt_users WHERE users_idf = $1 AND users_status = 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::unauthorized("user not found"))?;
    Ok(Json(user))
}

async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, AppError> {
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::unauthorized("missing token"))?;
    let jti = jsonwebtoken::decode::<Claims>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(state.cfg.jwt_secret.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map(|data| data.claims.jti)
    .map_err(|_| AppError::unauthorized("invalid token"))?;
    let mut redis = state.redis.clone();
    let _: () = redis::cmd("DEL")
        .arg(format!("biller:session:{jti}"))
        .query_async(&mut redis)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
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
    let mut out = String::with_capacity(value.len());
    for b in value.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn json_flag(value: &Value) -> bool {
    value.as_bool().unwrap_or_else(|| {
        value
            .as_str()
            .is_some_and(|s| s.eq_ignore_ascii_case("true"))
    })
}

async fn exchange_google_code(state: &AppState, code: &str) -> Result<GoogleProfile, AppError> {
    let body = format!(
        "code={}&client_id={}&client_secret={}&redirect_uri=postmessage&grant_type=authorization_code",
        urlencode(code),
        urlencode(&state.google_client_id),
        urlencode(&state.google_client_secret),
    );
    let token_res = state
        .otp
        .http
        .post("https://oauth2.googleapis.com/token")
        .header("content-type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|err| AppError::internal(err.to_string()))?;
    let token_status = token_res.status();
    let token_json: Value = token_res
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
        .ok_or_else(|| AppError::unauthorized("Google tidak mengembalikan id token"))?;
    let info_res = state
        .otp
        .http
        .get("https://oauth2.googleapis.com/tokeninfo")
        .query(&[("id_token", id_token)])
        .send()
        .await
        .map_err(|err| AppError::internal(err.to_string()))?;
    let info_status = info_res.status();
    let info: Value = info_res
        .json()
        .await
        .map_err(|err| AppError::internal(err.to_string()))?;
    if !info_status.is_success() {
        return Err(AppError::unauthorized("Google id token ditolak"));
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
    let sub = info
        .get("sub")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if email.is_empty() || sub.is_empty() {
        return Err(AppError::unauthorized("akun Google tidak punya email"));
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
        return Err(AppError::unauthorized("email Google belum terverifikasi"));
    }
    if let Some(user) = sqlx::query_as::<_, UserOut>(
        "SELECT users_idf, users_fullname, users_email, user_phonenumber
         FROM mt_users
         WHERE users_google_sub = $1 AND users_status = 1",
    )
    .bind(&profile.sub)
    .fetch_optional(&state.pool)
    .await?
    {
        sqlx::query("UPDATE mt_users SET users_updated_date = now() WHERE users_idf = $1")
            .bind(user.users_idf)
            .execute(&state.pool)
            .await?;
        return Ok(user);
    }

    let existing = sqlx::query_as::<_, (Uuid, Option<String>)>(
        "SELECT users_idf, users_google_sub
         FROM mt_users
         WHERE lower(users_email) = $1 AND users_status = 1
         LIMIT 1",
    )
    .bind(&profile.email)
    .fetch_optional(&state.pool)
    .await?;
    if let Some((id, google_sub)) = existing {
        if google_sub
            .as_deref()
            .is_some_and(|current| current != profile.sub)
        {
            return Err(AppError::conflict(
                "email sudah terhubung ke akun Google lain",
            ));
        }
        return Ok(sqlx::query_as::<_, UserOut>(
            "UPDATE mt_users
             SET users_google_sub = $2,
                 users_fullname = COALESCE(NULLIF(BTRIM(users_fullname), ''), $3),
                 users_updated_date = now()
             WHERE users_idf = $1
             RETURNING users_idf, users_fullname, users_email, user_phonenumber",
        )
        .bind(id)
        .bind(&profile.sub)
        .bind(&profile.name)
        .fetch_one(&state.pool)
        .await?);
    }

    let (full, first, last) = split_name(&profile.name);
    let hash = hash_password(&Uuid::new_v4().to_string())?;
    sqlx::query_as::<_, UserOut>(
        "INSERT INTO mt_users (
            users_fullname, users_firstname, users_lastname, users_email,
            users_credentials, users_google_sub, users_status, users_created_date
         ) VALUES ($1,$2,$3,$4,$5,$6,1, now())
         RETURNING users_idf, users_fullname, users_email, user_phonenumber",
    )
    .bind(&full)
    .bind(&first)
    .bind(&last)
    .bind(&profile.email)
    .bind(&hash)
    .bind(&profile.sub)
    .fetch_one(&state.pool)
    .await
    .map_err(|err| {
        if err.to_string().contains("unique") || err.to_string().contains("duplicate") {
            AppError::conflict("email sudah terdaftar")
        } else {
            AppError::from(err)
        }
    })
}

async fn google_login(
    State(state): State<AppState>,
    Json(body): Json<GoogleBody>,
) -> Result<Json<AuthOut>, AppError> {
    if state.google_client_id.is_empty() || state.google_client_secret.is_empty() {
        return Err(AppError::internal("Google OAuth belum dikonfigurasi"));
    }
    let code = body.code.trim();
    if code.is_empty() {
        return Err(AppError::bad("kode Google kosong"));
    }
    let profile = exchange_google_code(&state, code).await?;
    let user = upsert_google_user(&state, &profile).await?;
    issue(&state, user).await
}

async fn issue(state: &AppState, user: UserOut) -> Result<Json<AuthOut>, AppError> {
    let now = Utc::now();
    let jti = Uuid::new_v4().to_string();
    let subject = user
        .users_email
        .clone()
        .or_else(|| user.user_phonenumber.clone())
        .unwrap_or_default();
    let claims = Claims {
        sub: user.users_idf.to_string(),
        email: subject,
        kind: "biller".into(),
        jti: jti.clone(),
        iat: now.timestamp(),
        exp: (now + Duration::days(TOKEN_LIFETIME_DAYS)).timestamp(),
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.cfg.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::internal(e.to_string()))?;
    let mut redis = state.redis.clone();
    let _: () = redis::cmd("SET")
        .arg(format!("biller:session:{jti}"))
        .arg(user.users_idf.to_string())
        .query_async(&mut redis)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(AuthOut { token, user }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phone_matches_whatsapp_and_web_formats() {
        for raw in ["081234567890", "6281234567890", "+62 812-3456-7890", "81234567890"] {
            let local = normalize_phone(raw).unwrap();
            assert_eq!(phone_variants(&local), ["081234567890".to_string(), "6281234567890".to_string()]);
            assert_eq!(phone_intl(&local), "6281234567890");
        }
    }

    #[test]
    fn otp_digest_binds_challenge() {
        assert_ne!(otp_digest("a", "123456"), otp_digest("b", "123456"));
        assert_eq!(otp_digest("a", "123456"), otp_digest("a", "123456"));
    }
}
