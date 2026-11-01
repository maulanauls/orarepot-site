use axum::{extract::State, http::HeaderMap, Json};
use chrono::{Duration, Utc};
use orarepot_common::{decode_store_jwt, sha256_hex, sign_store_jwt, AppError};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{hash_password, verify_password, AppState};

#[derive(Deserialize)]
pub struct StoreRegisterBody {
    merchant_id: Uuid,
    full_name: String,
    password: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    phone: String,
}

#[derive(Deserialize)]
pub struct StoreLoginBody {
    merchant_id: Uuid,
    password: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    identifier: String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct CustomerOut {
    id: Uuid,
    merchant_id: Uuid,
    role: String,
    email: Option<String>,
    full_name: String,
    phone_e164: Option<String>,
}

#[derive(Serialize)]
pub struct StoreAuthOut {
    token: String,
    customer: CustomerOut,
}

const CUSTOMER_RETURNING: &str = "id, merchant_id, role, email::text AS email, full_name, phone_e164";

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<StoreRegisterBody>,
) -> Result<Json<StoreAuthOut>, AppError> {
    let full_name = body.full_name.trim();
    if full_name.is_empty() || body.password.len() < 8 {
        return Err(AppError::bad("nama dan kata sandi (min 8) wajib diisi"));
    }
    let email = normalize_email(&body.email);
    let phone = normalize_phone(&body.phone);
    if email.is_none() && phone.is_none() {
        return Err(AppError::bad("email atau nomor WhatsApp wajib diisi"));
    }
    let hash = hash_password(&body.password)?;
    let row = sqlx::query_as::<_, CustomerOut>(&format!(
        "INSERT INTO mt_store_customers (merchant_id, email, phone_e164, password_hash, full_name)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING {CUSTOMER_RETURNING}"
    ))
    .bind(body.merchant_id)
    .bind(&email)
    .bind(&phone)
    .bind(&hash)
    .bind(full_name)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
            AppError::conflict("akun customer ini sudah terdaftar di toko tersebut")
        } else {
            AppError::from(e)
        }
    })?;
    issue(&state, row).await
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<StoreLoginBody>,
) -> Result<Json<StoreAuthOut>, AppError> {
    let identifier = {
        let email = body.email.trim();
        if email.is_empty() {
            body.identifier.trim().to_string()
        } else {
            email.to_string()
        }
    };
    if identifier.is_empty() || body.password.is_empty() {
        return Err(AppError::unauthorized("email atau kata sandi salah"));
    }
    let row = find_customer(&state.pool, body.merchant_id, &identifier).await?;
    let Some((customer, password_hash)) = row else {
        return Err(AppError::unauthorized("email atau kata sandi salah"));
    };
    if !verify_password(&body.password, &password_hash) {
        return Err(AppError::unauthorized("email atau kata sandi salah"));
    }
    sqlx::query("UPDATE mt_store_customers SET last_login_at = now(), updated_at = now() WHERE id = $1")
        .bind(customer.id)
        .execute(&state.pool)
        .await?;
    issue(&state, customer).await
}

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<CustomerOut>, AppError> {
    let token = bearer(&headers)?;
    let claims = decode_store_jwt(&state.cfg, token)?;
    let customer_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::unauthorized("invalid token"))?;
    let merchant_id = Uuid::parse_str(&claims.merchant_id).map_err(|_| AppError::unauthorized("invalid token"))?;
    let token_hash = sha256_hex(token);
    let session_ok: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM cm_store_sessions
            WHERE customer_id = $1 AND token_hash = $2
              AND revoked_at IS NULL AND expires_at > now()
         )",
    )
    .bind(customer_id)
    .bind(&token_hash)
    .fetch_one(&state.pool)
    .await?;
    if !session_ok {
        return Err(AppError::unauthorized("session expired"));
    }
    let row = sqlx::query_as::<_, CustomerOut>(&format!(
        "SELECT {CUSTOMER_RETURNING}
         FROM mt_store_customers
         WHERE id = $1 AND merchant_id = $2 AND status = 'active'"
    ))
    .bind(customer_id)
    .bind(merchant_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::unauthorized("customer not found"))?;
    Ok(Json(row))
}

async fn issue(state: &AppState, customer: CustomerOut) -> Result<Json<StoreAuthOut>, AppError> {
    let subject = customer
        .email
        .clone()
        .or_else(|| customer.phone_e164.clone())
        .unwrap_or_default();
    let token = sign_store_jwt(&state.cfg, customer.id, &subject, customer.merchant_id)?;
    sqlx::query(
        "INSERT INTO cm_store_sessions (customer_id, token_hash, expires_at)
         VALUES ($1,$2,$3)",
    )
    .bind(customer.id)
    .bind(sha256_hex(&token))
    .bind(Utc::now() + Duration::hours(12))
    .execute(&state.pool)
    .await?;
    Ok(Json(StoreAuthOut { token, customer }))
}

#[derive(sqlx::FromRow)]
struct CustomerAuthRow {
    id: Uuid,
    merchant_id: Uuid,
    role: String,
    email: Option<String>,
    full_name: String,
    phone_e164: Option<String>,
    password_hash: String,
}

impl CustomerAuthRow {
    fn split(self) -> (CustomerOut, String) {
        (
            CustomerOut {
                id: self.id,
                merchant_id: self.merchant_id,
                role: self.role,
                email: self.email,
                full_name: self.full_name,
                phone_e164: self.phone_e164,
            },
            self.password_hash,
        )
    }
}

async fn find_customer(
    pool: &PgPool,
    merchant_id: Uuid,
    identifier: &str,
) -> Result<Option<(CustomerOut, String)>, AppError> {
    let row = if identifier.contains('@') {
        sqlx::query_as::<_, CustomerAuthRow>(
            "SELECT id, merchant_id, role, email::text AS email, full_name, phone_e164, password_hash
             FROM mt_store_customers
             WHERE merchant_id = $1 AND email = $2 AND status = 'active'",
        )
        .bind(merchant_id)
        .bind(identifier.to_lowercase())
        .fetch_optional(pool)
        .await?
    } else {
        let Some(phone) = crate::to_e164(identifier) else {
            return Ok(None);
        };
        sqlx::query_as::<_, CustomerAuthRow>(
            "SELECT id, merchant_id, role, email::text AS email, full_name, phone_e164, password_hash
             FROM mt_store_customers
             WHERE merchant_id = $1 AND phone_e164 = $2 AND status = 'active'",
        )
        .bind(merchant_id)
        .bind(phone)
        .fetch_optional(pool)
        .await?
    };
    Ok(row.map(CustomerAuthRow::split))
}

fn normalize_email(raw: &str) -> Option<String> {
    let value = raw.trim().to_lowercase();
    if value.contains('@') && value.contains('.') {
        Some(value)
    } else {
        None
    }
}

fn normalize_phone(raw: &str) -> Option<String> {
    if raw.trim().is_empty() || raw.contains('@') {
        return None;
    }
    crate::to_e164(raw)
}

fn bearer(headers: &HeaderMap) -> Result<&str, AppError> {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|v| !v.is_empty())
        .ok_or_else(|| AppError::unauthorized("missing token"))
}
