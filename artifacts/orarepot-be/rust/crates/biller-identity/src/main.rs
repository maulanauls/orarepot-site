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
}

struct OtpConfig {
    http: reqwest::Client,
    notify_url: Option<String>,
    notify_token: Option<String>,
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
            dev_log: nonempty("OTP_DEV_LOG").is_some_and(|v| v == "1"),
        })
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
    let client = redis::Client::open(redis_url)?;
    let redis = client.get_multiplexed_async_connection().await?;
    let otp = OtpConfig::from_env()?;
    if otp.notify_url.is_none() {
        if otp.dev_log {
            tracing::warn!("OTP_NOTIFY_URL unset: OTP codes are written to the log (dev only)");
        } else {
            tracing::warn!("OTP_NOTIFY_URL unset: WhatsApp accounts cannot be claimed on the web");
        }
    }
    let state = AppState {
        pool,
        cfg: AppCfg::from_env(),
        redis,
        otp: Arc::new(otp),
    };
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/biller/auth/register", post(register))
        .route("/biller/auth/enter", post(enter))
        .route("/biller/auth/enter/verify", post(enter_verify))
        .route("/biller/auth/login", post(login))
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
    email: String,
    phone: String,
    password: String,
}

async fn enter(
    State(state): State<AppState>,
    Json(body): Json<EnterBody>,
) -> Result<Json<Value>, AppError> {
    let email = body.email.trim().to_lowercase();
    let phone = normalize_phone(&body.phone).ok_or_else(|| AppError::bad("nomor telepon tidak valid"))?;
    if !email.contains('@') || !email.split('@').nth(1).is_some_and(|host| host.contains('.')) {
        return Err(AppError::bad("email tidak valid"));
    }
    if body.password.len() < 8 {
        return Err(AppError::bad("kata sandi minimal 8 karakter"));
    }
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
    .bind(phone_variants(&phone).to_vec())
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
        return start_claim(&state, row, email, &body.password).await;
    }
    let taken: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mt_users WHERE lower(users_email) = $1)",
    )
    .bind(&email)
    .fetch_one(&state.pool)
    .await?;
    if taken {
        return Err(AppError::conflict("email sudah terdaftar"));
    }
    let auth = register(
        State(state),
        Json(RegisterBody {
            full_name: email.clone(),
            identifier: String::new(),
            email,
            phone,
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
    let attach_email = match row.users_email.as_deref() {
        Some(current) if current.eq_ignore_ascii_case(&email) => None,
        Some(_) => return Err(AppError::unauthorized("email tidak cocok dengan akun nomor ini")),
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
    if let Err(err) = send_otp(state, &chat_id, &code).await {
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

async fn send_otp(state: &AppState, chat_id: &str, code: &str) -> Result<(), AppError> {
    let otp = &state.otp;
    let Some(url) = otp.notify_url.as_deref() else {
        if otp.dev_log {
            tracing::warn!(chat_id, code, "OTP (dev log, not sent)");
            return Ok(());
        }
        return Err(AppError::internal("pengiriman kode WhatsApp belum aktif"));
    };
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
    if Uuid::parse_str(challenge).is_err() || code.len() != 6 {
        return Err(AppError::bad("kode harus 6 angka"));
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
