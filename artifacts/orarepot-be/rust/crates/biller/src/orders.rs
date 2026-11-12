use axum::{
    extract::{Path, State},
    http::{header::AUTHORIZATION, HeaderMap},
    Json,
};
use chrono::{DateTime, FixedOffset, NaiveDateTime, TimeZone, Utc};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use orarepot_common::AppError;
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Postgres, Transaction};
use std::time::Duration;
use uuid::Uuid;

use crate::{kind_of, AppState};

/// Marks rows written by this service so the expiry sweeper only touches web orders.
const WEB_NOTE: &str = "orappob-web";
const HOLD_MEMO: &str = "orappob-web hold";
const REFUND_MEMO: &str = "orappob-web refund";

pub struct PayConfig {
    pub jwt_secret: String,
    pub midtrans_url: Option<String>,
    pub midtrans_key: Option<String>,
    pub digiflazz_username: Option<String>,
    pub digiflazz_key: Option<String>,
    pub paid_callback_url: Option<String>,
    pub http: reqwest::Client,
}

impl PayConfig {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let read = |name: &str| std::env::var(name).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        Ok(Self {
            jwt_secret: std::env::var("JWT_SECRET")?,
            midtrans_url: read("MIDTRANS_URL"),
            midtrans_key: read("MIDTRANS_SERVER_KEY"),
            digiflazz_username: read("DIGIFLAZZ_USERNAME"),
            digiflazz_key: read("DIGIFLAZZ_KEY"),
            paid_callback_url: read("PAID_CALLBACK_URL"),
            http: reqwest::Client::builder().timeout(Duration::from_secs(20)).build()?,
        })
    }
}

#[derive(Deserialize)]
struct Claims {
    sub: String,
    kind: String,
}

fn user_of(state: &AppState, headers: &HeaderMap) -> Result<Uuid, AppError> {
    let token = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::unauthorized("masuk dulu untuk melanjutkan"))?;
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.pay.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| AppError::unauthorized("sesi habis, masuk lagi"))?;
    if data.claims.kind != "biller" {
        return Err(AppError::unauthorized("sesi habis, masuk lagi"));
    }
    Uuid::parse_str(&data.claims.sub).map_err(|_| AppError::unauthorized("sesi habis, masuk lagi"))
}

#[derive(Debug, sqlx::FromRow)]
struct ProductRow {
    lookup_idf: Uuid,
    lookup_name: Option<String>,
    lookup_brand: Option<String>,
    business_module_idf: Option<Uuid>,
    business_module_name: Option<String>,
    module_name: Option<String>,
    usable: bool,
    available: bool,
    selling_price: i64,
}

async fn load_product<'e, E>(executor: E, lookup_idf: Uuid) -> Result<Option<ProductRow>, AppError>
where
    E: sqlx::Executor<'e, Database = Postgres>,
{
    sqlx::query_as::<_, ProductRow>(
        r#"
        WITH item AS (
            SELECT * FROM mt_lookup WHERE lookup_idf = $1
        ),
        picked AS (
            SELECT m.corporate_idf, m.corporate_business_module_name
            FROM mt_corporate_business_module m
            JOIN item ON item.business_module_idf = m.business_module_idf
            WHERE m.corporate_business_parent_module_idf IS NOT NULL
            LIMIT 1
        ),
        corp AS (
            SELECT
                COALESCE(c.corporate_default_margin_type, 'PERCENTAGE') AS basis,
                COALESCE(c.corporate_default_margin_rate, 0) AS rate
            FROM mt_corporate c
            JOIN picked p ON p.corporate_idf = c.corporate_idf
        )
        SELECT
            item.lookup_idf,
            item.lookup_name,
            item.lookup_brand,
            item.business_module_idf,
            item.business_module_name,
            COALESCE(p.corporate_business_module_name, item.business_module_cat, item.business_module_name) AS module_name,
            (COALESCE(item.lookup_monitor, false) AND NOT COALESCE(item.lookup_maintenance, false)) AS usable,
            COALESCE(item.lookup_integration_status, true) AS available,
            CEIL(
                CASE
                    WHEN UPPER(COALESCE(cs.commission_basis, corp.basis, 'PERCENTAGE')) = 'FIXED'
                        THEN item.lookup_value::numeric + COALESCE(cs.commissions_value, corp.rate, 0)
                    WHEN UPPER(COALESCE(cs.commission_basis, corp.basis, 'PERCENTAGE')) = 'PERCENTAGE'
                        THEN item.lookup_value::numeric
                            + (item.lookup_value::numeric * COALESCE(cs.commissions_value, corp.rate, 0) / 100)
                    ELSE item.lookup_value::numeric * 1.03
                END
            )::bigint AS selling_price
        FROM item
        LEFT JOIN picked p ON true
        LEFT JOIN LATERAL (
            SELECT commission_basis, commissions_value
            FROM mt_commissions_settings
            WHERE lookup_idf = item.lookup_idf
              AND corporate_idf = p.corporate_idf
              AND commissions_type = 'SELLING_PRICE'
            LIMIT 1
        ) cs ON true
        LEFT JOIN corp ON true
        WHERE item.lookup_value ~ '^[0-9]+(\.[0-9]+)?$'
        "#,
    )
    .bind(lookup_idf)
    .fetch_optional(executor)
    .await
    .map_err(AppError::from)
}

const PROVIDER_PREFIXES: &[(&str, &[&str])] = &[
    ("TELKOMSEL", &["62811", "62812", "62813", "62821", "62822", "62823", "62852", "62853"]),
    ("INDOSAT", &["62814", "62815", "62816", "62855", "62856", "62857", "62858"]),
    ("TRI", &["62895", "62896", "62897", "62898", "62899"]),
    ("XL", &["62817", "62818", "62819", "62859", "62877", "62878"]),
    ("AXIS", &["62831", "62832", "62833", "62838"]),
    ("SMARTFREN", &["62881", "62882", "62883", "62884", "62885", "62886", "62887", "62888", "62889"]),
    ("BYU", &["62851"]),
];

fn provider_key(brand: &str) -> Option<&'static str> {
    let key: String = brand.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_uppercase();
    match key.as_str() {
        "TELKOMSEL" | "SIMPATI" | "TSEL" => Some("TELKOMSEL"),
        "INDOSAT" | "IM3" | "MENTARI" | "INDOSATOOREDOO" => Some("INDOSAT"),
        "TRI" | "THREE" => Some("TRI"),
        "XL" | "XLAXIATA" => Some("XL"),
        "AXIS" => Some("AXIS"),
        "SMARTFREN" => Some("SMARTFREN"),
        "BYU" => Some("BYU"),
        _ => None,
    }
}

fn local_phone(raw: &str) -> Option<String> {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    let local = if let Some(rest) = digits.strip_prefix("62") {
        format!("0{rest}")
    } else if digits.starts_with('8') {
        format!("0{digits}")
    } else {
        digits
    };
    (local.starts_with("08") && (10..=13).contains(&local.len())).then_some(local)
}

fn is_mobile_legends(brand: &str) -> bool {
    brand.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_uppercase() == "MOBILELEGENDS"
}

/// Same rules as the WhatsApp SELECT_PRICE_MENU step, returning the value stored in `customer_target`.
fn normalize_target(kind: &str, brand: &str, raw: &str) -> Result<String, AppError> {
    let compact: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
    match kind {
        "game" if is_mobile_legends(brand) => {
            let ok = compact
                .split_once('(')
                .and_then(|(user, rest)| rest.strip_suffix(')').map(|zone| (user, zone)))
                .filter(|(user, zone)| {
                    !user.is_empty() && !zone.is_empty() && user.chars().all(|c| c.is_ascii_digit()) && zone.chars().all(|c| c.is_ascii_digit())
                })
                .is_some();
            if ok {
                Ok(compact)
            } else {
                Err(AppError::bad("Format User ID tidak sesuai. Contoh: 12345(1234)"))
            }
        }
        "game" => {
            if (4..=20).contains(&compact.len()) && compact.chars().all(|c| c.is_ascii_alphanumeric()) {
                Ok(compact)
            } else {
                Err(AppError::bad("User ID game tidak valid."))
            }
        }
        "pln" => {
            let digits: String = compact.chars().filter(|c| c.is_ascii_digit()).collect();
            if (10..=13).contains(&digits.len()) {
                Ok(digits)
            } else {
                Err(AppError::bad("ID pelanggan PLN harus 10 sampai 13 digit."))
            }
        }
        _ => {
            let phone = local_phone(&compact).ok_or_else(|| AppError::bad("Nomor HP yang kamu masukkan tidak valid."))?;
            if kind == "pulsa" || kind == "data" {
                if let Some(expected) = provider_key(brand) {
                    let intl = format!("62{}", &phone[1..]);
                    let detected = PROVIDER_PREFIXES
                        .iter()
                        .find(|(_, prefixes)| prefixes.iter().any(|p| intl.starts_with(p)))
                        .map(|(name, _)| *name);
                    if detected != Some(expected) {
                        return Err(AppError::bad(format!(
                            "Nomor yang kamu masukkan tidak cocok dengan provider {brand}. Masukkan nomor yang sesuai atau pilih provider lain."
                        )));
                    }
                }
            }
            Ok(phone)
        }
    }
}

fn jakarta() -> FixedOffset {
    FixedOffset::east_opt(7 * 3600).expect("valid offset")
}

fn invoice_number(target: &str) -> String {
    let now = Utc::now().with_timezone(&jakarta());
    let rand = rand::thread_rng().gen_range(1000..10000);
    let digits: String = target.chars().filter(|c| c.is_ascii_digit()).collect();
    let last4 = if digits.is_empty() { "0000".to_string() } else { digits[digits.len().saturating_sub(4)..].to_string() };
    format!("MKINV-{}{:03}-{rand}{last4}", now.format("%Y%m%d"), now.timestamp_subsec_millis())
}

fn ledger_ref(amount: i64) -> String {
    let now = Utc::now().with_timezone(&jakarta());
    let rand = rand::thread_rng().gen_range(0..10000);
    let tail = amount.rem_euclid(10000);
    format!("MKLED-{}{:03}-{rand}-{tail}", now.format("%Y%m%d"), now.timestamp_subsec_millis())
}

#[derive(Debug, sqlx::FromRow)]
struct OrderRow {
    billing_id: Uuid,
    billing_code: String,
    status: String,
    total: i64,
    customer_target: Option<String>,
    expires_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    notes: Option<String>,
    session_state: Option<String>,
    session_provider: Option<String>,
    lookup_idf: Option<Uuid>,
    product_name: Option<String>,
    brand: Option<String>,
    module_name: Option<String>,
    qr_url: Option<String>,
    payment_provider: Option<String>,
    payment_status: Option<String>,
    payment_amount: Option<i64>,
    charge: Option<Value>,
    txn_payload: Option<Value>,
    item_meta: Option<Value>,
    koin_held: i64,
}

const ORDER_SELECT: &str = r#"
    SELECT
        b.billing_id,
        b.billing_code,
        b.status,
        b.total_cents::bigint AS total,
        b.customer_target,
        b.expires_at,
        b.created_at,
        b.notes,
        s.transaction_session AS session_state,
        s.payment_provider AS session_provider,
        COALESCE(i.lookup_idf, s.lookup_idf) AS lookup_idf,
        COALESCE(i.item_name, s.transaction_name) AS product_name,
        s.lookup_brand AS brand,
        s.business_module_name AS module_name,
        s.transaction_link AS qr_url,
        p.provider AS payment_provider,
        p.transaction_status AS payment_status,
        p.gross_amount_cents::bigint AS payment_amount,
        p.request_payload AS charge,
        t.response_payload AS txn_payload,
        i.meta AS item_meta,
        COALESCE((
            SELECT SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_cents ELSE -amount_cents END)
            FROM mt_wallet_ledger
            WHERE related_billing_id = b.billing_id AND memo IN ('orappob-web hold', 'orappob-web refund')
        ), 0)::bigint AS koin_held
    FROM mt_billing b
    LEFT JOIN LATERAL (
        SELECT * FROM mt_transaction_session WHERE billing_code = b.billing_code ORDER BY transaction_created_date DESC NULLS LAST LIMIT 1
    ) s ON true
    LEFT JOIN LATERAL (
        SELECT * FROM mt_billing_item WHERE billing_id = b.billing_id LIMIT 1
    ) i ON true
    LEFT JOIN LATERAL (
        SELECT * FROM mt_payment WHERE billing_id = b.billing_id ORDER BY requested_at DESC LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
        SELECT * FROM mt_transaction WHERE billing_id = b.billing_id ORDER BY requested_at DESC LIMIT 1
    ) t ON true
"#;

async fn load_order(pool: &PgPool, user: Uuid, code: &str) -> Result<OrderRow, AppError> {
    sqlx::query_as::<_, OrderRow>(&format!("{ORDER_SELECT} WHERE b.billing_code = $1 AND b.user_idf = $2"))
        .bind(code)
        .bind(user)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::not_found("pesanan tidak ditemukan"))
}

fn upper(value: &Option<String>) -> String {
    value.as_deref().unwrap_or("").trim().to_uppercase()
}

/// unpaid → waiting (QR shown) → processing (paid, Digiflazz running) → success | failed, or expired.
fn stage_of(row: &OrderRow) -> &'static str {
    match row.status.trim().to_uppercase().as_str() {
        "SUCCESS" | "SUKSES" => return "success",
        "FAILED" | "GAGAL" => return "failed",
        "EXPIRE" | "EXPIRED" => return "expired",
        "PENDING" => return "processing",
        _ => {}
    }
    let session = upper(&row.session_state);
    match session.as_str() {
        "SUCCESS" => return "success",
        "FAILED" => return "failed",
        "EXPIRE" => return "expired",
        "PAID" | "SETTLEMENT" => return "processing",
        _ => {}
    }
    let paid = upper(&row.payment_status);
    if paid == "SETTLEMENT" || paid == "CAPTURE" {
        return "processing";
    }
    if upper(&row.payment_provider) == "MIDTRANS" {
        return if matches!(paid.as_str(), "EXPIRE" | "CANCEL" | "DENY" | "FAILURE") { "expired" } else { "waiting" };
    }
    if row.expires_at.is_some_and(|at| at < Utc::now()) {
        return "expired";
    }
    "unpaid"
}

fn qr_from_charge(charge: &Value) -> (Option<String>, Option<String>) {
    let url = charge
        .get("actions")
        .and_then(Value::as_array)
        .and_then(|actions| {
            actions
                .iter()
                .find(|a| a.get("name").and_then(Value::as_str) == Some("generate-qr-code"))
                .or_else(|| actions.first())
        })
        .and_then(|a| a.get("url"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let raw = charge.get("qr_string").and_then(Value::as_str).map(str::to_string);
    (url, raw)
}

fn midtrans_expiry(charge: &Value) -> Option<DateTime<Utc>> {
    let raw = charge.get("expiry_time").and_then(Value::as_str)?;
    let naive = NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S").ok()?;
    jakarta().from_local_datetime(&naive).single().map(|at| at.with_timezone(&Utc))
}

fn fulfilment_data(row: &OrderRow) -> Option<&Value> {
    row.txn_payload
        .as_ref()
        .and_then(|v| v.get("data"))
        .or_else(|| row.item_meta.as_ref().and_then(|v| v.get("data")))
        .filter(|v| v.get("ref_id").is_some() || v.get("sn").is_some())
}

#[derive(Serialize)]
pub struct PayOption {
    method: String,
    title: String,
    label: String,
    koin: i64,
    qris: i64,
    available: bool,
}

#[derive(Serialize)]
pub struct OrderOut {
    billing_code: String,
    stage: &'static str,
    status: String,
    product_name: Option<String>,
    brand: Option<String>,
    module_name: Option<String>,
    lookup_idf: Option<Uuid>,
    target: Option<String>,
    total: i64,
    payment_method: Option<String>,
    koin_used: i64,
    qris_amount: Option<i64>,
    qr_url: Option<String>,
    qr_string: Option<String>,
    expires_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    sn: Option<String>,
    message: Option<String>,
    web: bool,
    wallet_balance: i64,
    payment_options: Vec<PayOption>,
}

#[derive(sqlx::FromRow)]
struct SettingRow {
    setting_value: String,
    setting_label: Option<String>,
    setting_purpose: String,
}

fn rupiah(value: i64) -> String {
    let digits = value.abs().to_string();
    let mut out = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    format!("Rp {out}")
}

async fn payment_options(pool: &PgPool, total: i64, balance: i64) -> Result<Vec<PayOption>, AppError> {
    let rows = sqlx::query_as::<_, SettingRow>(
        "SELECT setting_value, setting_label, setting_purpose FROM mt_settings WHERE setting_name = 'PAYMENT' ORDER BY setting_value = 'QRIS', setting_key",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .filter(|row| row.setting_value == "MENUKU_KOIN" || row.setting_value == "QRIS")
        .map(|row| {
            let (koin, qris, replace) = if row.setting_value == "MENUKU_KOIN" {
                if balance >= total {
                    (total, 0, format!("{} Koin", rupiah(total).trim_start_matches("Rp ")))
                } else {
                    let rest = total - balance;
                    (balance, rest, format!("({} Koin) + QRIS ({})", rupiah(balance).trim_start_matches("Rp "), rupiah(rest)))
                }
            } else {
                (0, total, rupiah(total))
            };
            PayOption {
                available: row.setting_value == "QRIS" || balance > 0,
                title: row.setting_label.unwrap_or_else(|| row.setting_value.clone()),
                label: row.setting_purpose.replace("{REPLACE}", &replace).trim().to_string(),
                method: row.setting_value,
                koin,
                qris,
            }
        })
        .collect())
}

async fn wallet_balance(pool: &PgPool, user: Uuid) -> Result<i64, AppError> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(SUM(balance_cents), 0)::bigint FROM mt_wallet_account WHERE user_id = $1 AND is_active = true",
    )
    .bind(user)
    .fetch_one(pool)
    .await?)
}

async fn present(pool: &PgPool, user: Uuid, row: OrderRow) -> Result<OrderOut, AppError> {
    let stage = stage_of(&row);
    let balance = wallet_balance(pool, user).await?;
    let options = if stage == "unpaid" { payment_options(pool, row.total, balance).await? } else { Vec::new() };
    let (charge_url, qr_string) = row.charge.as_ref().map(qr_from_charge).unwrap_or((None, None));
    let data = fulfilment_data(&row);
    let sn = data.and_then(|d| d.get("sn")).and_then(Value::as_str).map(str::to_string).filter(|v| !v.is_empty());
    let message = data.and_then(|d| d.get("message")).and_then(Value::as_str).map(str::to_string);
    let is_midtrans = upper(&row.payment_provider) == "MIDTRANS";
    let session_provider = upper(&row.session_provider);
    let payment_method = if row.koin_held > 0 {
        Some("MENUKU_KOIN+MIDTRANS".to_string())
    } else if session_provider.is_empty() {
        row.payment_provider.clone().filter(|_| row.charge.is_some())
    } else {
        Some(session_provider)
    };
    Ok(OrderOut {
        stage,
        status: row.status.clone(),
        product_name: row.product_name,
        brand: row.brand,
        module_name: row.module_name,
        lookup_idf: row.lookup_idf,
        target: row.customer_target,
        total: row.total,
        payment_method,
        koin_used: row.koin_held.max(0),
        qris_amount: if is_midtrans { row.payment_amount } else { None },
        qr_url: if stage == "waiting" { row.qr_url.or(charge_url) } else { None },
        qr_string: if stage == "waiting" { qr_string } else { None },
        expires_at: row.expires_at,
        created_at: row.created_at,
        sn,
        message,
        web: row.notes.as_deref() == Some(WEB_NOTE),
        wallet_balance: balance,
        payment_options: options,
        billing_code: row.billing_code,
    })
}

#[derive(Deserialize)]
pub struct CreateOrder {
    lookup_idf: Uuid,
    target: String,
}

pub async fn create_order(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateOrder>,
) -> Result<Json<OrderOut>, AppError> {
    let user = user_of(&state, &headers)?;
    let product = load_product(&state.pool, body.lookup_idf)
        .await?
        .ok_or_else(|| AppError::not_found("Produk tidak ditemukan."))?;
    if !product.usable {
        return Err(AppError::bad("Produk sedang gangguan. Pilih nominal lain."));
    }
    if !product.available {
        return Err(AppError::bad("Stok produk sedang kosong. Pilih nominal lain."));
    }
    let brand = product.lookup_brand.clone().unwrap_or_default();
    let kind = kind_of(product.module_name.as_deref().unwrap_or(""));
    let target = normalize_target(kind, &brand, &body.target)?;
    let code = invoice_number(&target);
    let name = product.lookup_name.clone().unwrap_or_else(|| brand.clone());

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        r#"
        INSERT INTO mt_billing (user_idf, billing_code, status, amount_cents, total_cents, currency, customer_target, notes, expires_at, created_at, updated_at)
        VALUES ($1, $2, 'INQUIRY', $3, $3, 'IDR', $4, $5, now() + interval '30 minutes', now(), now())
        "#,
    )
    .bind(user)
    .bind(&code)
    .bind(product.selling_price)
    .bind(&target)
    .bind(WEB_NOTE)
    .execute(&mut *tx)
    .await?;
    // transaction_number stays NULL: the WhatsApp bot looks sessions up by sender number.
    sqlx::query(
        r#"
        INSERT INTO mt_transaction_session (
            transaction_number, transaction_session, lookup_idf, transaction_name, transaction_amount,
            business_module_idf, business_module_name, lookup_brand, transaction_bill_number,
            transaction_step, billing_code, user_id, transaction_signature
        )
        VALUES (NULL, 'INQUIRY', $1, $2, $3, $4, $5, $6, $7, 'INQUIRY_TRANSACTION', $8, $9,
            CASE WHEN $10::text IS NULL OR $11::text IS NULL THEN NULL ELSE md5($10 || $11 || $8) END)
        "#,
    )
    .bind(product.lookup_idf)
    .bind(&name)
    .bind(product.selling_price)
    .bind(product.business_module_idf)
    .bind(product.business_module_name.as_deref().or(product.module_name.as_deref()))
    .bind(&brand)
    .bind(&target)
    .bind(&code)
    .bind(user)
    .bind(state.pay.digiflazz_username.as_deref())
    .bind(state.pay.digiflazz_key.as_deref())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let row = load_order(&state.pool, user, &code).await?;
    Ok(Json(present(&state.pool, user, row).await?))
}

pub async fn get_order(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> Result<Json<OrderOut>, AppError> {
    let user = user_of(&state, &headers)?;
    let mut row = load_order(&state.pool, user, &code).await?;
    if stage_of(&row) == "waiting" {
        if refresh_midtrans(&state, &row).await? {
            row = load_order(&state.pool, user, &code).await?;
        }
    }
    Ok(Json(present(&state.pool, user, row).await?))
}

#[derive(Serialize)]
pub struct OrderList {
    orders: Vec<OrderOut>,
}

pub async fn list_orders(State(state): State<AppState>, headers: HeaderMap) -> Result<Json<OrderList>, AppError> {
    let user = user_of(&state, &headers)?;
    let rows = sqlx::query_as::<_, OrderRow>(&format!(
        "{ORDER_SELECT} WHERE b.user_idf = $1 ORDER BY b.created_at DESC LIMIT 20"
    ))
    .bind(user)
    .fetch_all(&state.pool)
    .await?;
    let balance = wallet_balance(&state.pool, user).await?;
    let mut orders = Vec::with_capacity(rows.len());
    for row in rows {
        let mut out = present_light(row);
        out.wallet_balance = balance;
        orders.push(out);
    }
    Ok(Json(OrderList { orders }))
}

fn present_light(row: OrderRow) -> OrderOut {
    let stage = stage_of(&row);
    OrderOut {
        stage,
        status: row.status.clone(),
        payment_method: if row.koin_held > 0 { Some("MENUKU_KOIN+MIDTRANS".into()) } else { row.session_provider.clone().filter(|v| !v.is_empty()) },
        koin_used: row.koin_held.max(0),
        qris_amount: None,
        qr_url: None,
        qr_string: None,
        sn: fulfilment_data(&row).and_then(|d| d.get("sn")).and_then(Value::as_str).map(str::to_string).filter(|v| !v.is_empty()),
        message: None,
        web: row.notes.as_deref() == Some(WEB_NOTE),
        wallet_balance: 0,
        payment_options: Vec::new(),
        product_name: row.product_name,
        brand: row.brand,
        module_name: row.module_name,
        lookup_idf: row.lookup_idf,
        target: row.customer_target,
        total: row.total,
        expires_at: row.expires_at,
        created_at: row.created_at,
        billing_code: row.billing_code,
    }
}

#[derive(Serialize)]
pub struct WalletOut {
    balance: i64,
}

pub async fn wallet(State(state): State<AppState>, headers: HeaderMap) -> Result<Json<WalletOut>, AppError> {
    let user = user_of(&state, &headers)?;
    Ok(Json(WalletOut { balance: wallet_balance(&state.pool, user).await? }))
}

#[derive(Deserialize)]
pub struct PayBody {
    method: String,
}

#[derive(sqlx::FromRow)]
struct LockedBilling {
    billing_id: Uuid,
    total: i64,
}

#[derive(sqlx::FromRow)]
struct WalletRow {
    wallet_id: Uuid,
    balance: i64,
}

pub async fn pay_order(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(code): Path<String>,
    Json(body): Json<PayBody>,
) -> Result<Json<OrderOut>, AppError> {
    let user = user_of(&state, &headers)?;
    let method = body.method.trim().to_uppercase();
    if method != "MENUKU_KOIN" && method != "QRIS" {
        return Err(AppError::bad("Metode pembayaran tidak dikenal."));
    }
    let current = load_order(&state.pool, user, &code).await?;
    match stage_of(&current) {
        "unpaid" => {}
        "waiting" => return Ok(Json(present(&state.pool, user, current).await?)),
        "expired" => return Err(AppError::conflict("Pesanan sudah kedaluwarsa. Buat pesanan baru.")),
        _ => return Err(AppError::conflict("Pesanan ini sudah dibayar.")),
    }
    let lookup_idf = current.lookup_idf.ok_or_else(|| AppError::internal("pesanan tanpa produk"))?;

    let mut tx = state.pool.begin().await?;
    let billing = sqlx::query_as::<_, LockedBilling>(
        "SELECT billing_id, total_cents::bigint AS total FROM mt_billing WHERE billing_code = $1 AND user_idf = $2 AND status = 'INQUIRY' FOR UPDATE",
    )
    .bind(&code)
    .bind(user)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::conflict("Pesanan ini sudah diproses."))?;
    let has_payment: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM mt_payment WHERE billing_id = $1)")
        .bind(billing.billing_id)
        .fetch_one(&mut *tx)
        .await?;
    if has_payment {
        return Err(AppError::conflict("Pesanan ini sudah diproses."));
    }
    let product = load_product(&mut *tx, lookup_idf)
        .await?
        .ok_or_else(|| AppError::not_found("Produk tidak ditemukan."))?;
    if !product.usable || !product.available {
        return Err(AppError::bad("Produk sedang tidak tersedia. Pilih nominal lain."));
    }

    let wallet = sqlx::query_as::<_, WalletRow>(
        "SELECT wallet_id, balance_cents::bigint AS balance FROM mt_wallet_account WHERE user_id = $1 AND is_active = true ORDER BY created_at LIMIT 1 FOR UPDATE",
    )
    .bind(user)
    .fetch_optional(&mut *tx)
    .await?;
    let balance = wallet.as_ref().map(|w| w.balance.max(0)).unwrap_or(0);
    let total = billing.total;

    if method == "MENUKU_KOIN" && balance <= 0 {
        return Err(AppError::bad("Saldo koin kamu 0. Pilih QRIS."));
    }

    if method == "MENUKU_KOIN" && balance >= total {
        let callback = state
            .pay
            .paid_callback_url
            .clone()
            .ok_or_else(|| AppError::internal("pembayaran koin belum dikonfigurasi"))?;
        let meta = json!({ "channel": WEB_NOTE, "payment_provider": "MENUKU_KOIN", "order_id": code, "gross_amount": total });
        write_payment_rows(&mut tx, &billing, &product, &meta, "MENUKU_KOIN", "koin", total, "pending", None).await?;
        sqlx::query(
            "UPDATE mt_transaction_session SET payment_provider = 'MENUKU_KOIN', transaction_session = 'PAID', transaction_step = 'PAYMENT_METHOD_SELECTED' WHERE billing_code = $1",
        )
        .bind(&code)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        let payload = json!({
            "transaction_status": "settlement",
            "status_code": "200",
            "payment_type": "koin",
            "order_id": code,
            "billing_code": code,
            "gross_amount": total.to_string(),
            "transaction_amount": total,
            "coin_pay_amount_cents": total,
            "wallet_balance_cents": balance,
            "payment_provider": "MENUKU_KOIN",
            "user_idf": user,
            "lookup_idf": product.lookup_idf,
            "transaction_bill_number": current.customer_target,
            "transaction_name": product.lookup_name,
            "lookup_brand": product.lookup_brand,
            "requested_at": Utc::now().to_rfc3339(),
        });
        if let Err(err) = state.pay.http.post(&callback).json(&payload).send().await.and_then(|r| r.error_for_status()) {
            tracing::warn!(billing_code = %code, error = %err, "koin paid callback failed");
            if err.is_connect() || err.is_builder() || err.is_request() && !err.is_timeout() {
                undo_koin(&state.pool, billing.billing_id, &code).await?;
                return Err(AppError::internal("Pembayaran koin belum terkirim. Coba lagi."));
            }
        }
        let row = load_order(&state.pool, user, &code).await?;
        return Ok(Json(present(&state.pool, user, row).await?));
    }

    let koin = if method == "MENUKU_KOIN" { balance.min(total) } else { 0 };
    let qris = total - koin;
    let charge = midtrans_charge(&state, &code, qris).await?;
    let (qr_url, _) = qr_from_charge(&charge);
    let expiry = midtrans_expiry(&charge);
    let (payment_id, ppob_txn_id) = write_payment_rows(
        &mut tx,
        &billing,
        &product,
        &charge,
        "MIDTRANS",
        "qris",
        qris,
        charge.get("transaction_status").and_then(Value::as_str).unwrap_or("pending"),
        charge.get("transaction_id").and_then(Value::as_str),
    )
    .await?;
    if koin > 0 {
        let wallet = wallet.as_ref().ok_or_else(|| AppError::internal("dompet tidak ditemukan"))?;
        sqlx::query("UPDATE mt_wallet_account SET balance_cents = balance_cents - $2, updated_at = now() WHERE wallet_id = $1")
            .bind(wallet.wallet_id)
            .bind(koin)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            r#"
            INSERT INTO mt_wallet_ledger (wallet_id, txn_time, entry_type, amount_cents, related_billing_id, related_payment_id, related_ppob_txn_id, memo, balance_after_cents, ref_no, created_at)
            VALUES ($1, now(), 'DEBIT', $2, $3, $4, $5, $6, $7, $8, now())
            "#,
        )
        .bind(wallet.wallet_id)
        .bind(koin)
        .bind(billing.billing_id)
        .bind(payment_id)
        .bind(ppob_txn_id)
        .bind(HOLD_MEMO)
        .bind(wallet.balance - koin)
        .bind(ledger_ref(koin))
        .execute(&mut *tx)
        .await?;
    }
    // Split orders stay QRIS for the n8n consumer: the koin part is already debited here,
    // and its MENUKU_KOIN branch would deduct the full price again.
    sqlx::query(
        r#"
        UPDATE mt_transaction_session
        SET payment_provider = 'QRIS', transaction_step = 'PAYMENT_LINK', transaction_link = $2,
            transaction_expiration_date = ($3::timestamptz AT TIME ZONE 'UTC')
        WHERE billing_code = $1
        "#,
    )
    .bind(&code)
    .bind(qr_url)
    .bind(expiry)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE mt_billing SET expires_at = COALESCE($2, now() + interval '15 minutes'), updated_at = now() WHERE billing_id = $1")
        .bind(billing.billing_id)
        .bind(expiry)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let row = load_order(&state.pool, user, &code).await?;
    Ok(Json(present(&state.pool, user, row).await?))
}

#[allow(clippy::too_many_arguments)]
async fn write_payment_rows(
    tx: &mut Transaction<'_, Postgres>,
    billing: &LockedBilling,
    product: &ProductRow,
    meta: &Value,
    provider: &str,
    payment_type: &str,
    amount: i64,
    status: &str,
    external_ref: Option<&str>,
) -> Result<(Uuid, Uuid), AppError> {
    sqlx::query(
        r#"
        INSERT INTO mt_billing_item (billing_id, lookup_idf, item_name, item_desc, qty, unit_price_cents, line_total_cents, meta)
        SELECT $1, l.lookup_idf, COALESCE(l.lookup_name, l.lookup_code, 'Produk'), l.lookup_description, 1, l.lookup_value::numeric, $2, $3
        FROM mt_lookup l WHERE l.lookup_idf = $4
        "#,
    )
    .bind(billing.billing_id)
    .bind(billing.total)
    .bind(meta)
    .bind(product.lookup_idf)
    .execute(&mut **tx)
    .await?;
    let payment_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO mt_payment (billing_id, midtrans_order_id, provider, payment_type, gross_amount_cents, transaction_status, transaction_id, requested_at, request_payload)
        SELECT $1, b.billing_code, $2, $3, $4, $5, $6, now(), $7 FROM mt_billing b WHERE b.billing_id = $1
        RETURNING payment_id
        "#,
    )
    .bind(billing.billing_id)
    .bind(provider)
    .bind(payment_type)
    .bind(amount)
    .bind(status)
    .bind(external_ref)
    .bind(meta)
    .fetch_one(&mut **tx)
    .await?;
    let ppob_txn_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO mt_transaction (billing_id, lookup_idf, external_ref, status, request_payload, requested_at)
        VALUES ($1, $2, $3, $4, $5, now())
        RETURNING ppob_txn_id
        "#,
    )
    .bind(billing.billing_id)
    .bind(product.lookup_idf)
    .bind(external_ref)
    .bind(status)
    .bind(meta)
    .fetch_one(&mut **tx)
    .await?;
    Ok((payment_id, ppob_txn_id))
}

async fn undo_koin(pool: &PgPool, billing_id: Uuid, code: &str) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    for sql in [
        "DELETE FROM mt_transaction WHERE billing_id = $1",
        "DELETE FROM mt_payment WHERE billing_id = $1",
        "DELETE FROM mt_billing_item WHERE billing_id = $1",
    ] {
        sqlx::query(sql).bind(billing_id).execute(&mut *tx).await?;
    }
    sqlx::query(
        "UPDATE mt_transaction_session SET payment_provider = NULL, transaction_session = 'INQUIRY', transaction_step = 'INQUIRY_TRANSACTION' WHERE billing_code = $1",
    )
    .bind(code)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

async fn midtrans_charge(state: &AppState, code: &str, amount: i64) -> Result<Value, AppError> {
    let (url, key) = match (&state.pay.midtrans_url, &state.pay.midtrans_key) {
        (Some(url), Some(key)) => (url, key),
        _ => return Err(AppError::internal("QRIS belum dikonfigurasi")),
    };
    let response = state
        .pay
        .http
        .post(format!("{}/v2/charge", url.trim_end_matches('/')))
        .basic_auth(key, Some(""))
        .json(&json!({
            "payment_type": "qris",
            "transaction_details": { "order_id": code, "gross_amount": amount },
            "qris": { "acquirer": "gopay" }
        }))
        .send()
        .await
        .map_err(|err| AppError::internal(format!("QRIS gagal dibuat: {err}")))?;
    let body: Value = response.json().await.map_err(|_| AppError::internal("QRIS gagal dibuat"))?;
    let status = body.get("status_code").and_then(Value::as_str).unwrap_or("");
    if status != "200" && status != "201" {
        let msg = body.get("status_message").and_then(Value::as_str).unwrap_or("QRIS gagal dibuat");
        tracing::warn!(billing_code = %code, status, msg, "midtrans charge rejected");
        return Err(AppError::bad(format!("QRIS gagal dibuat: {msg}")));
    }
    Ok(body)
}

async fn midtrans_status(state: &AppState, code: &str) -> Option<Value> {
    let (url, key) = (state.pay.midtrans_url.as_ref()?, state.pay.midtrans_key.as_ref()?);
    let response = state
        .pay
        .http
        .get(format!("{}/v2/{}/status", url.trim_end_matches('/'), code))
        .basic_auth(key, Some(""))
        .send()
        .await
        .ok()?;
    response.json::<Value>().await.ok()
}

fn midtrans_paid(status: &Value) -> bool {
    let tx = status.get("transaction_status").and_then(Value::as_str).unwrap_or("").to_lowercase();
    let fraud = status.get("fraud_status").and_then(Value::as_str).unwrap_or("accept").to_lowercase();
    tx == "settlement" || (tx == "capture" && fraud == "accept")
}

/// Returns true when the stored state changed.
async fn refresh_midtrans(state: &AppState, row: &OrderRow) -> Result<bool, AppError> {
    let Some(status) = midtrans_status(state, &row.billing_code).await else {
        return Ok(false);
    };
    if midtrans_paid(&status) {
        mark_paid(state, row, &status).await?;
        return Ok(true);
    }
    let tx_status = status.get("transaction_status").and_then(Value::as_str).unwrap_or("").to_lowercase();
    if matches!(tx_status.as_str(), "expire" | "cancel" | "deny" | "failure") {
        expire_order(&state.pool, row.billing_id, &tx_status).await?;
        return Ok(true);
    }
    Ok(false)
}

async fn mark_paid(state: &AppState, row: &OrderRow, status: &Value) -> Result<(), AppError> {
    let changed = sqlx::query(
        r#"
        UPDATE mt_payment
        SET transaction_status = 'settlement', paid_at = now(), settled_at = now(), response_payload = $2
        WHERE billing_id = $1 AND provider = 'MIDTRANS' AND lower(COALESCE(transaction_status, '')) NOT IN ('settlement', 'capture')
        "#,
    )
    .bind(row.billing_id)
    .bind(status)
    .execute(&state.pool)
    .await?
    .rows_affected();
    if changed == 0 {
        return Ok(());
    }
    // Midtrans also notifies n8n directly; the WhatsApp bot sends this as a fallback and
    // Digiflazz deduplicates on ref_id, so a second delivery does not create a second order.
    if let Some(callback) = &state.pay.paid_callback_url {
        let payload = json!({
            "transaction_status": status.get("transaction_status").cloned().unwrap_or(json!("settlement")),
            "status_code": status.get("status_code").cloned().unwrap_or(json!("200")),
            "payment_type": status.get("payment_type").cloned().unwrap_or(json!("qris")),
            "order_id": row.billing_code,
            "billing_code": row.billing_code,
            "gross_amount": status.get("gross_amount").cloned().unwrap_or(json!(row.total.to_string())),
            "transaction_id": status.get("transaction_id").cloned().unwrap_or(json!("")),
            "fraud_status": status.get("fraud_status").cloned().unwrap_or(json!("accept")),
            "payment_provider": "QRIS",
            "requested_at": Utc::now().to_rfc3339(),
        });
        if let Err(err) = state.pay.http.post(callback).json(&payload).send().await {
            tracing::warn!(billing_code = %row.billing_code, error = %err, "paid callback failed");
        }
    }
    Ok(())
}

async fn expire_order(pool: &PgPool, billing_id: Uuid, reason: &str) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    let code: Option<String> = sqlx::query_scalar(
        "SELECT billing_code FROM mt_billing WHERE billing_id = $1 AND status = 'INQUIRY' FOR UPDATE",
    )
    .bind(billing_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(code) = code else {
        return Ok(());
    };
    sqlx::query("UPDATE mt_billing SET status = 'EXPIRE', updated_at = now() WHERE billing_id = $1")
        .bind(billing_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE mt_payment SET transaction_status = $2 WHERE billing_id = $1 AND provider = 'MIDTRANS'")
        .bind(billing_id)
        .bind(reason)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE mt_transaction SET status = 'EXPIRE', completed_at = now() WHERE billing_id = $1")
        .bind(billing_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE mt_transaction_session SET transaction_session = 'EXPIRE' WHERE billing_code = $1")
        .bind(&code)
        .execute(&mut *tx)
        .await?;

    #[derive(sqlx::FromRow)]
    struct Held {
        wallet_id: Uuid,
        held: i64,
    }
    let held = sqlx::query_as::<_, Held>(
        r#"
        SELECT wallet_id, SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_cents ELSE -amount_cents END)::bigint AS held
        FROM mt_wallet_ledger
        WHERE related_billing_id = $1 AND memo IN ('orappob-web hold', 'orappob-web refund')
        GROUP BY wallet_id
        "#,
    )
    .bind(billing_id)
    .fetch_all(&mut *tx)
    .await?;
    for row in held.into_iter().filter(|row| row.held > 0) {
        let after: i64 = sqlx::query_scalar(
            "UPDATE mt_wallet_account SET balance_cents = balance_cents + $2, updated_at = now() WHERE wallet_id = $1 RETURNING balance_cents::bigint",
        )
        .bind(row.wallet_id)
        .bind(row.held)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query(
            r#"
            INSERT INTO mt_wallet_ledger (wallet_id, txn_time, entry_type, amount_cents, related_billing_id, memo, balance_after_cents, ref_no, created_at)
            VALUES ($1, now(), 'CREDIT', $2, $3, $4, $5, $6, now())
            "#,
        )
        .bind(row.wallet_id)
        .bind(row.held)
        .bind(billing_id)
        .bind(REFUND_MEMO)
        .bind(after)
        .bind(ledger_ref(row.held))
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Settles or expires web QRIS orders whose buyer closed the page, so held koin comes back.
pub async fn sweep_expired(state: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(60));
    loop {
        tick.tick().await;
        let rows = match sqlx::query_as::<_, OrderRow>(&format!(
            r#"{ORDER_SELECT}
            WHERE b.notes = '{WEB_NOTE}' AND b.status = 'INQUIRY'
              AND b.expires_at < now() - interval '2 minutes'
              AND EXISTS (
                SELECT 1 FROM mt_payment mp
                WHERE mp.billing_id = b.billing_id AND mp.provider = 'MIDTRANS'
                  AND lower(COALESCE(mp.transaction_status, '')) NOT IN ('settlement', 'capture', 'expire', 'cancel', 'deny', 'failure')
              )
            ORDER BY b.expires_at LIMIT 20"#
        ))
        .fetch_all(&state.pool)
        .await
        {
            Ok(rows) => rows,
            Err(err) => {
                tracing::warn!(error = %err, "order sweep query failed");
                continue;
            }
        };
        for row in rows {
            if let Err(err) = refresh_midtrans(&state, &row).await {
                tracing::warn!(billing_code = %row.billing_code, error = %err, "order sweep failed");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phone_prefix_matches_brand() {
        assert_eq!(normalize_target("pulsa", "TELKOMSEL", "0812 3456 7890").unwrap(), "081234567890");
        assert_eq!(normalize_target("pulsa", "TELKOMSEL", "+62 812-3456-7890").unwrap(), "081234567890");
        assert!(normalize_target("pulsa", "XL", "081234567890").is_err());
        assert_eq!(normalize_target("data", "XL", "87812345678").unwrap(), "087812345678");
        assert_eq!(normalize_target("emoney", "DANA", "081234567890").unwrap(), "081234567890");
        assert!(normalize_target("emoney", "DANA", "12345").is_err());
    }

    #[test]
    fn game_and_pln_targets() {
        assert_eq!(normalize_target("game", "MOBILE LEGENDS", "12345 (1234)").unwrap(), "12345(1234)");
        assert!(normalize_target("game", "MOBILE LEGENDS", "12345").is_err());
        assert_eq!(normalize_target("game", "FREE FIRE", "123456789").unwrap(), "123456789");
        assert_eq!(normalize_target("pln", "PLN", "5300 1234 567").unwrap(), "53001234567");
    }

    #[test]
    fn invoice_shape() {
        let code = invoice_number("081234567890");
        assert!(code.starts_with("MKINV-"));
        assert!(code.ends_with("7890"));
    }

    #[test]
    fn rupiah_format() {
        assert_eq!(rupiah(12500), "Rp 12.500");
        assert_eq!(rupiah(1000000), "Rp 1.000.000");
    }
}
