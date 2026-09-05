use axum::{
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    pub sub: String,
    pub email: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Clone)]
pub struct AppCfg {
    pub jwt_secret: String,
    pub internal_key: String,
}

impl AppCfg {
    pub fn from_env() -> Self {
        Self {
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "change-me-in-production-orarepot-jwt".into()),
            internal_key: std::env::var("INTERNAL_KEY")
                .unwrap_or_else(|_| "change-me-in-production-internal".into()),
        }
    }
}

pub fn sign_jwt(cfg: &AppCfg, user_id: Uuid, email: &str) -> Result<String, AppError> {
    let now = Utc::now();
    let claims = JwtClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        iat: now.timestamp(),
        exp: (now + Duration::hours(12)).timestamp(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(cfg.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::internal(e.to_string()))
}

pub fn decode_jwt(cfg: &AppCfg, token: &str) -> Result<JwtClaims, AppError> {
    decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(cfg.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map(|d| d.claims)
    .map_err(|_| AppError::unauthorized("invalid token"))
}

pub fn user_id_from_headers(headers: &HeaderMap) -> Result<Uuid, AppError> {
    headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| AppError::unauthorized("missing user"))
}

pub fn require_internal(headers: &HeaderMap, cfg: &AppCfg) -> Result<(), AppError> {
    let got = headers
        .get("x-internal-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if got == cfg.internal_key {
        Ok(())
    } else {
        Err(AppError::unauthorized("internal key"))
    }
}

pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

pub async fn insert_outbox(
    pool: &PgPool,
    topic: &str,
    aggregate_type: &str,
    aggregate_id: Uuid,
    payload: serde_json::Value,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO cm_outbox (topic, aggregate_type, aggregate_id, payload) VALUES ($1,$2,$3,$4)",
    )
    .bind(topic)
    .bind(aggregate_type)
    .bind(aggregate_id)
    .bind(payload)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn bad(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }
    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }
}

impl From<sqlx::Error> for AppError {
    fn from(value: sqlx::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone()),
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m.clone()),
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m.clone()),
            AppError::Conflict(m) => (StatusCode::CONFLICT, m.clone()),
            AppError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m.clone()),
        };
        (status, Json(serde_json::json!({ "error": msg }))).into_response()
    }
}

pub fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true, "service": env!("CARGO_PKG_NAME") }))
}
