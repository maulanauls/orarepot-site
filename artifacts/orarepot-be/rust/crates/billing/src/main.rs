use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use orarepot_common::{insert_outbox, require_internal, AppCfg, AppError};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};
use sqlx::PgPool;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    cfg: AppCfg,
    http: reqwest::Client,
    midtrans_server_key: String,
    midtrans_production: bool,
    public_app_url: String,
}

#[derive(Serialize, sqlx::FromRow)]
struct WalletBalance {
    merchant_id: Uuid,
    remaining_idr: i64,
    deposit_idr: i64,
    used_otp_idr: i64,
    used_broadcast_idr: i64,
    used_ai_idr: i64,
    trial_otp_used: i32,
    trial_otp_limit: i32,
    trial_otp_left: i32,
}

#[derive(Deserialize)]
struct CreateWallet {
    merchant_id: Uuid,
}

#[derive(Deserialize)]
struct Topup {
    merchant_id: Uuid,
    amount_idr: i64,
    customer_name: String,
    customer_ref: Option<String>,
    language: Option<String>,
    origin: Option<String>,
}

#[derive(Deserialize)]
struct ReserveBody {
    merchant_id: Uuid,
    feature: String,
    units: i32,
    reference_type: String,
    reference_id: Uuid,
}

#[derive(Serialize)]
struct ReservationOut {
    id: Uuid,
    amount_idr: i64,
    status: String,
    trial: bool,
}

#[derive(Deserialize)]
struct CreditBody {
    merchant_id: Uuid,
    amount_idr: i64,
    note: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();
    let pool = PgPool::connect(&std::env::var("DATABASE_URL")?).await?;
    let bind: SocketAddr = std::env::var("BIND")
        .unwrap_or_else(|_| "0.0.0.0:8102".into())
        .parse()?;
    let midtrans_production = matches!(
        std::env::var("MIDTRANS_IS_PRODUCTION")
            .unwrap_or_else(|_| "false".into())
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes"
    );
    let state = AppState {
        pool,
        cfg: AppCfg::from_env(),
        http: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()?,
        midtrans_server_key: std::env::var("MIDTRANS_SERVER_KEY").unwrap_or_default(),
        midtrans_production,
        public_app_url: std::env::var("PUBLIC_APP_URL")
            .unwrap_or_else(|_| "https://orarepot.com".into()),
    };
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/billing/wallets", post(create_wallet))
        .route("/billing/wallets/{merchant_id}", get(get_wallet))
        .route("/billing/invoices/{merchant_id}", get(list_invoices))
        .route("/billing/topups", post(topup))
        .route("/billing/payments/midtrans", post(midtrans_callback))
        .route("/billing/payments/{order_id}", get(get_payment))
        .route("/internal/reserve", post(reserve))
        .route("/internal/capture", post(capture))
        .route("/internal/release", post(release))
        .route("/internal/credit", post(internal_credit))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());
    tracing::info!("orarepot-billing on {bind}");
    axum::serve(tokio::net::TcpListener::bind(bind).await?, app).await?;
    Ok(())
}

async fn create_wallet(
    State(state): State<AppState>,
    Json(body): Json<CreateWallet>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO mt_wallets (merchant_id) VALUES ($1)
         ON CONFLICT (merchant_id) DO UPDATE SET merchant_id = EXCLUDED.merchant_id
         RETURNING id",
    )
    .bind(body.merchant_id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({
        "id": id,
        "merchant_id": body.merchant_id,
        "trial_otp_limit": 3
    })))
}

async fn get_wallet(
    State(state): State<AppState>,
    Path(merchant_id): Path<Uuid>,
) -> Result<Json<WalletBalance>, AppError> {
    let row = sqlx::query_as::<_, WalletBalance>(
        "SELECT v.merchant_id, v.remaining_idr::bigint, v.deposit_idr::bigint,
                v.used_otp_idr::bigint, v.used_broadcast_idr::bigint, v.used_ai_idr::bigint,
                w.trial_otp_used, w.trial_otp_limit,
                GREATEST(w.trial_otp_limit - w.trial_otp_used, 0) AS trial_otp_left
         FROM vw_wallet_balances v
         JOIN mt_wallets w ON w.merchant_id = v.merchant_id
         WHERE v.merchant_id = $1",
    )
    .bind(merchant_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("wallet"))?;
    Ok(Json(row))
}

#[derive(Serialize, sqlx::FromRow)]
struct InvoiceRow {
    id: Uuid,
    number: String,
    label: String,
    amount_idr: i64,
    status: String,
    issued_on: chrono::NaiveDate,
}

async fn list_invoices(
    State(state): State<AppState>,
    Path(merchant_id): Path<Uuid>,
) -> Result<Json<Vec<InvoiceRow>>, AppError> {
    let rows = sqlx::query_as::<_, InvoiceRow>(
        "SELECT id, number, label, amount_idr, status::text AS status, issued_on
         FROM tx_invoices WHERE merchant_id = $1
         ORDER BY issued_on DESC, created_at DESC LIMIT 50",
    )
    .bind(merchant_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow)]
struct PaymentRow {
    id: Uuid,
    merchant_id: Uuid,
    order_id: String,
    amount_idr: i64,
    status: String,
    snap_token: Option<String>,
    snap_redirect_url: Option<String>,
    paid_at: Option<chrono::DateTime<chrono::Utc>>,
}

async fn get_payment(
    State(state): State<AppState>,
    Path(order_id): Path<String>,
) -> Result<Json<PaymentRow>, AppError> {
    let row = sqlx::query_as::<_, PaymentRow>(
        "SELECT id, merchant_id, order_id, amount_idr, status::text AS status,
                snap_token, snap_redirect_url, paid_at
         FROM tx_payments WHERE order_id = $1",
    )
    .bind(&order_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("payment"))?;
    Ok(Json(row))
}

async fn topup(
    State(state): State<AppState>,
    Json(body): Json<Topup>,
) -> Result<Json<serde_json::Value>, AppError> {
    if body.amount_idr < 10_000 {
        return Err(AppError::bad("minimum topup 10000"));
    }
    let customer_ref = body
        .customer_ref
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("ORAREPOT");
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO mt_wallets (merchant_id) VALUES ($1)
         ON CONFLICT (merchant_id) DO UPDATE SET merchant_id = EXCLUDED.merchant_id",
    )
    .bind(body.merchant_id)
    .execute(&mut *tx)
    .await?;
    let order_id = format!("ORP-{}", Uuid::new_v4().simple());
    let payment_id: Uuid = sqlx::query_scalar(
        "INSERT INTO tx_payments
           (merchant_id, order_id, amount_idr, status, customer_name, customer_ref, expires_at)
         VALUES ($1,$2,$3,'pending',$4,$5, now() + interval '60 minutes')
         RETURNING id",
    )
    .bind(body.merchant_id)
    .bind(&order_id)
    .bind(body.amount_idr)
    .bind(&body.customer_name)
    .bind(customer_ref)
    .fetch_one(&mut *tx)
    .await?;
    let inv = format!("INV-{}", &order_id[4..12]);
    sqlx::query(
        "INSERT INTO tx_invoices (merchant_id, payment_id, number, label, amount_idr, status)
         VALUES ($1,$2,$3,$4,$5,'pending')",
    )
    .bind(body.merchant_id)
    .bind(payment_id)
    .bind(&inv)
    .bind(format!("Topup {order_id}"))
    .bind(body.amount_idr)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let origin = body
        .origin
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(state.public_app_url.trim_end_matches('/'));
    let language = match body.language.as_deref() {
        Some("en") => "en",
        _ => "id",
    };

    let mut snap_token: Option<String> = None;
    let mut redirect_url: Option<String> = None;
    let mut used_order_id = order_id.clone();

    if !state.midtrans_server_key.is_empty() {
        match create_snap(
            &state,
            &used_order_id,
            body.amount_idr,
            &body.customer_name,
            customer_ref,
            origin,
            language,
        )
        .await
        {
            Ok(snap) => {
                used_order_id = snap.order_id;
                snap_token = Some(snap.token);
                redirect_url = snap.redirect_url;
            }
            Err(err) => {
                tracing::warn!(order_id = %order_id, error = %err, "midtrans snap failed");
                return Err(AppError::internal(err));
            }
        }
        if used_order_id != order_id {
            sqlx::query("UPDATE tx_payments SET order_id = $2 WHERE id = $1")
                .bind(payment_id)
                .bind(&used_order_id)
                .execute(&state.pool)
                .await?;
        }
        sqlx::query(
            "UPDATE tx_payments SET snap_token = $2, snap_redirect_url = $3 WHERE id = $1",
        )
        .bind(payment_id)
        .bind(&snap_token)
        .bind(&redirect_url)
        .execute(&state.pool)
        .await?;
    }

    Ok(Json(serde_json::json!({
        "payment_id": payment_id,
        "order_id": used_order_id,
        "status": "pending",
        "amount_idr": body.amount_idr,
        "snap_token": snap_token,
        "redirect_url": redirect_url
    })))
}

struct SnapOut {
    token: String,
    redirect_url: Option<String>,
    order_id: String,
}

fn snap_api_url(production: bool) -> &'static str {
    if production {
        "https://app.midtrans.com/snap/v1/transactions"
    } else {
        "https://app.sandbox.midtrans.com/snap/v1/transactions"
    }
}

fn with_language(url: Option<String>, language: &str) -> Option<String> {
    url.map(|u| {
        let join = if u.contains('?') { '&' } else { '?' };
        format!("{u}{join}language={language}")
    })
}

fn is_duplicate_order(message: &str) -> bool {
    let text = message.to_lowercase();
    text.contains("order_id")
        && (text.contains("taken")
            || text.contains("exists")
            || text.contains("used")
            || text.contains("sudah")
            || text.contains("duplicate"))
}

async fn post_snap(
    state: &AppState,
    order_id: &str,
    amount: i64,
    customer_name: &str,
    customer_ref: &str,
    origin: &str,
    language: &str,
) -> Result<(u16, serde_json::Value), String> {
    let item_name = if language == "en" {
        "Ora Repot Deposit"
    } else {
        "Deposit Ora Repot"
    };
    let payload = serde_json::json!({
        "transaction_details": { "order_id": order_id, "gross_amount": amount },
        "item_details": [{
            "id": "orarepot-deposit",
            "name": item_name,
            "price": amount,
            "quantity": 1
        }],
        "customer_details": {
            "first_name": customer_name,
            "last_name": customer_ref
        },
        "callbacks": {
            "finish": format!("{origin}/pay/finish"),
            "error": format!("{origin}/pay/error"),
            "unfinish": format!("{origin}/pay/error")
        }
    });
    let res = state
        .http
        .post(snap_api_url(state.midtrans_production))
        .basic_auth(&state.midtrans_server_key, Some(""))
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok((status, json))
}

async fn create_snap(
    state: &AppState,
    order_id: &str,
    amount: i64,
    customer_name: &str,
    customer_ref: &str,
    origin: &str,
    language: &str,
) -> Result<SnapOut, String> {
    let (status, json) = post_snap(
        state,
        order_id,
        amount,
        customer_name,
        customer_ref,
        origin,
        language,
    )
    .await?;
    if (200..300).contains(&status) {
        if let Some(token) = json.get("token").and_then(|v| v.as_str()) {
            return Ok(SnapOut {
                token: token.to_string(),
                redirect_url: with_language(
                    json.get("redirect_url")
                        .and_then(|v| v.as_str())
                        .map(str::to_string),
                    language,
                ),
                order_id: order_id.to_string(),
            });
        }
    }
    let message = snap_error_message(&json);
    if is_duplicate_order(&message) {
        let retry_id = format!("{order_id}-{}", &Uuid::new_v4().simple().to_string()[..8]);
        let (retry_status, retry_json) = post_snap(
            state,
            &retry_id,
            amount,
            customer_name,
            customer_ref,
            origin,
            language,
        )
        .await?;
        if (200..300).contains(&retry_status) {
            if let Some(token) = retry_json.get("token").and_then(|v| v.as_str()) {
                return Ok(SnapOut {
                    token: token.to_string(),
                    redirect_url: with_language(
                        retry_json
                            .get("redirect_url")
                            .and_then(|v| v.as_str())
                            .map(str::to_string),
                        language,
                    ),
                    order_id: retry_id,
                });
            }
        }
        return Err(snap_error_message(&retry_json));
    }
    Err(message)
}

fn snap_error_message(json: &serde_json::Value) -> String {
    let mut parts = Vec::new();
    if let Some(msg) = json.get("status_message").and_then(|v| v.as_str()) {
        parts.push(msg.to_string());
    }
    if let Some(arr) = json.get("error_messages").and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(s) = item.as_str() {
                parts.push(s.to_string());
            }
        }
    }
    if parts.is_empty() {
        "Midtrans Snap error".into()
    } else {
        parts.join(" ")
    }
}

fn signature_of(order_id: &str, status_code: &str, gross_amount: &str, server_key: &str) -> String {
    let mut hasher = Sha512::new();
    hasher.update(format!("{order_id}{status_code}{gross_amount}{server_key}"));
    hex::encode(hasher.finalize())
}

fn amount_matches(expected: i64, gross: &str) -> bool {
    gross
        .parse::<f64>()
        .ok()
        .map(|n| n.round() as i64 == expected)
        .unwrap_or(false)
}

fn should_credit(transaction_status: &str, fraud_status: Option<&str>) -> bool {
    match transaction_status {
        "settlement" => true,
        "capture" => fraud_status.map(|s| s == "accept").unwrap_or(true),
        _ => false,
    }
}

fn terminal_status(transaction_status: &str) -> Option<&'static str> {
    match transaction_status {
        "expire" => Some("expired"),
        "cancel" => Some("canceled"),
        "deny" | "failure" => Some("failed"),
        _ => None,
    }
}

async fn midtrans_callback(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    if state.midtrans_server_key.is_empty() {
        return Err(AppError::internal("MIDTRANS_SERVER_KEY is not set"));
    }
    let order_id = payload
        .get("order_id")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let status_code = payload
        .get("status_code")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let gross_amount = payload
        .get("gross_amount")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let signature = payload
        .get("signature_key")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let transaction_status = payload
        .get("transaction_status")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    if order_id.is_empty() || signature.is_empty() {
        return Err(AppError::bad("invalid midtrans payload"));
    }
    let expected = signature_of(
        order_id,
        status_code,
        gross_amount,
        &state.midtrans_server_key,
    );
    if !signature.eq_ignore_ascii_case(&expected) {
        return Err(AppError::unauthorized("invalid midtrans signature"));
    }

    let payment = sqlx::query_as::<_, (Uuid, Uuid, i64, String)>(
        "SELECT id, merchant_id, amount_idr, status::text FROM tx_payments WHERE order_id = $1",
    )
    .bind(order_id)
    .fetch_optional(&state.pool)
    .await?;
    let Some((payment_id, merchant_id, amount_idr, current_status)) = payment else {
        tracing::warn!(order_id, "midtrans callback for unknown order");
        return Ok(Json(serde_json::json!({ "ok": true, "ignored": "unknown_order" })));
    };

    sqlx::query(
        "UPDATE tx_payments SET
            midtrans_transaction_id = COALESCE($2, midtrans_transaction_id),
            midtrans_payment_type = COALESCE($3, midtrans_payment_type),
            midtrans_payload = $4
         WHERE id = $1",
    )
    .bind(payment_id)
    .bind(payload.get("transaction_id").and_then(|v| v.as_str()))
    .bind(payload.get("payment_type").and_then(|v| v.as_str()))
    .bind(&payload)
    .execute(&state.pool)
    .await?;

    if current_status == "paid" {
        return Ok(Json(serde_json::json!({
            "ok": true,
            "order_id": order_id,
            "status": "paid"
        })));
    }

    let fraud = payload.get("fraud_status").and_then(|v| v.as_str());
    if should_credit(transaction_status, fraud) {
        if !amount_matches(amount_idr, gross_amount) {
            tracing::warn!(
                order_id,
                amount_idr,
                gross_amount,
                "midtrans amount mismatch"
            );
            return Err(AppError::bad("gross_amount mismatch"));
        }
        apply_paid(&state.pool, payment_id, merchant_id, amount_idr).await?;
        return Ok(Json(serde_json::json!({
            "ok": true,
            "order_id": order_id,
            "status": "paid"
        })));
    }

    if let Some(next) = terminal_status(transaction_status) {
        sqlx::query(
            "UPDATE tx_payments SET status = $2::payment_status
             WHERE id = $1 AND status = 'pending'",
        )
        .bind(payment_id)
        .bind(next)
        .execute(&state.pool)
        .await?;
        sqlx::query(
            "UPDATE tx_invoices SET status = 'void'
             WHERE payment_id = $1 AND status = 'pending'",
        )
        .bind(payment_id)
        .execute(&state.pool)
        .await?;
        return Ok(Json(serde_json::json!({
            "ok": true,
            "order_id": order_id,
            "status": next
        })));
    }

    Ok(Json(serde_json::json!({
        "ok": true,
        "order_id": order_id,
        "status": "pending"
    })))
}

async fn apply_paid(
    pool: &PgPool,
    payment_id: Uuid,
    merchant_id: Uuid,
    amount_idr: i64,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    let n = sqlx::query(
        "UPDATE tx_payments SET status = 'paid', paid_at = now()
         WHERE id = $1 AND status <> 'paid'",
    )
    .bind(payment_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if n == 0 {
        tx.commit().await?;
        return Ok(());
    }
    let wallet_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mt_wallets (merchant_id) VALUES ($1)
         ON CONFLICT (merchant_id) DO UPDATE SET merchant_id = EXCLUDED.merchant_id
         RETURNING id",
    )
    .bind(merchant_id)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO tx_wallet_ledger
           (wallet_id, merchant_id, entry_type, reason, amount_idr, reference_type, reference_id)
         VALUES ($1,$2,'credit','topup',$3,'payment',$4)
         ON CONFLICT DO NOTHING",
    )
    .bind(wallet_id)
    .bind(merchant_id)
    .bind(amount_idr)
    .bind(payment_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE tx_invoices SET status = 'paid', paid_at = now()
         WHERE payment_id = $1 AND status <> 'paid'",
    )
    .bind(payment_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    insert_outbox(
        pool,
        "orarepot.payment.paid",
        "payment",
        payment_id,
        serde_json::json!({
            "id": payment_id,
            "merchant_id": merchant_id,
            "amount_idr": amount_idr
        }),
    )
    .await?;
    Ok(())
}

async fn internal_credit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreditBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_internal(&headers, &state.cfg)?;
    if body.amount_idr < 1 {
        return Err(AppError::bad("amount required"));
    }
    let mut tx = state.pool.begin().await?;
    let wallet_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mt_wallets (merchant_id) VALUES ($1)
         ON CONFLICT (merchant_id) DO UPDATE SET merchant_id = EXCLUDED.merchant_id
         RETURNING id",
    )
    .bind(body.merchant_id)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO tx_wallet_ledger
           (wallet_id, merchant_id, entry_type, reason, amount_idr, note)
         VALUES ($1,$2,'credit','topup',$3,$4)",
    )
    .bind(wallet_id)
    .bind(body.merchant_id)
    .bind(body.amount_idr)
    .bind(body.note.unwrap_or_else(|| "internal credit".into()))
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE mt_wallets SET trial_otp_used = trial_otp_limit WHERE id = $1",
    )
    .bind(wallet_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "ok": true,
        "merchant_id": body.merchant_id,
        "amount_idr": body.amount_idr
    })))
}

async fn rate_for(pool: &PgPool, feature: &str) -> Result<i64, AppError> {
    sqlx::query_scalar("SELECT unit_cost_idr FROM mt_feature_rates WHERE feature = $1::feature_code")
        .bind(feature)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::bad("unknown feature"))
}

async fn reserve(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ReserveBody>,
) -> Result<Json<ReservationOut>, AppError> {
    require_internal(&headers, &state.cfg)?;
    let unit_cost = rate_for(&state.pool, &body.feature).await?;
    let amount = unit_cost * body.units as i64;
    let mut tx = state.pool.begin().await?;
    let wallet = sqlx::query_as::<_, (Uuid, i32, i32)>(
        "SELECT id, trial_otp_used, trial_otp_limit FROM mt_wallets WHERE merchant_id = $1 FOR UPDATE",
    )
    .bind(body.merchant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::not_found("wallet"))?;
    let remaining: i64 = sqlx::query_scalar(
        "SELECT remaining_idr::bigint FROM vw_wallet_balances WHERE merchant_id = $1",
    )
    .bind(body.merchant_id)
    .fetch_one(&mut *tx)
    .await?;
    let held: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount_idr),0)::bigint FROM tx_wallet_reservations
         WHERE merchant_id = $1 AND status = 'held' AND expires_at > now() AND is_trial = false",
    )
    .bind(body.merchant_id)
    .fetch_one(&mut *tx)
    .await?;
    let use_trial = remaining - held < amount
        && body.feature == "otp"
        && wallet.1 + body.units <= wallet.2;
    if remaining - held < amount && !use_trial {
        return Err(AppError::conflict("insufficient balance"));
    }
    if use_trial {
        sqlx::query(
            "UPDATE mt_wallets SET trial_otp_used = trial_otp_used + $2 WHERE id = $1",
        )
        .bind(wallet.0)
        .bind(body.units)
        .execute(&mut *tx)
        .await?;
    }
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO tx_wallet_reservations
           (merchant_id, wallet_id, feature, amount_idr, units, reference_type, reference_id, is_trial, expires_at)
         VALUES ($1,$2,$3::feature_code,$4,$5,$6,$7,$8, now() + interval '10 minutes')
         RETURNING id",
    )
    .bind(body.merchant_id)
    .bind(wallet.0)
    .bind(&body.feature)
    .bind(amount)
    .bind(body.units)
    .bind(&body.reference_type)
    .bind(body.reference_id)
    .bind(use_trial)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            AppError::conflict("reservation already exists")
        } else {
            AppError::from(e)
        }
    })?;
    tx.commit().await?;
    insert_outbox(
        &state.pool,
        "orarepot.wallet.reserved",
        "reservation",
        id,
        serde_json::json!({
            "id": id,
            "merchant_id": body.merchant_id,
            "amount_idr": amount,
            "trial": use_trial
        }),
    )
    .await?;
    Ok(Json(ReservationOut {
        id,
        amount_idr: if use_trial { 0 } else { amount },
        status: "held".into(),
        trial: use_trial,
    }))
}

#[derive(Deserialize)]
struct CaptureBody {
    reservation_id: Uuid,
}

async fn capture(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CaptureBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_internal(&headers, &state.cfg)?;
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String, i64, i32, String, bool)>(
        "SELECT id, merchant_id, wallet_id, feature::text, amount_idr, units, status::text, is_trial
         FROM tx_wallet_reservations WHERE id = $1 FOR UPDATE",
    )
    .bind(body.reservation_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::not_found("reservation"))?;
    if row.6 != "held" {
        return Err(AppError::conflict("reservation not held"));
    }
    if row.7 {
        sqlx::query("UPDATE tx_wallet_reservations SET status = 'captured' WHERE id = $1")
            .bind(row.0)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Ok(Json(serde_json::json!({
            "status": "captured",
            "trial": true,
            "ledger_id": serde_json::Value::Null
        })));
    }
    let reason = match row.3.as_str() {
        "otp" => "otp_send",
        "broadcast" => "broadcast_send",
        _ => "ai_usage",
    };
    let ledger_id: Uuid = sqlx::query_scalar(
        "INSERT INTO tx_wallet_ledger
           (wallet_id, merchant_id, entry_type, reason, feature, amount_idr, units, reference_type, reference_id)
         VALUES ($1,$2,'debit',$3::ledger_reason,$4::feature_code,$5,$6,'reservation',$7)
         RETURNING id",
    )
    .bind(row.2)
    .bind(row.1)
    .bind(reason)
    .bind(&row.3)
    .bind(row.4)
    .bind(row.5)
    .bind(row.0)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE tx_wallet_reservations SET status = 'captured', ledger_id = $2 WHERE id = $1",
    )
    .bind(row.0)
    .bind(ledger_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    insert_outbox(
        &state.pool,
        "orarepot.wallet.captured",
        "reservation",
        row.0,
        serde_json::json!({ "id": row.0, "ledger_id": ledger_id, "amount_idr": row.4 }),
    )
    .await?;
    Ok(Json(
        serde_json::json!({ "status": "captured", "trial": false, "ledger_id": ledger_id }),
    ))
}

async fn release(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CaptureBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_internal(&headers, &state.cfg)?;
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query_as::<_, (Uuid, Uuid, i32, bool)>(
        "UPDATE tx_wallet_reservations SET status = 'released'
         WHERE id = $1 AND status = 'held'
         RETURNING id, merchant_id, units, is_trial",
    )
    .bind(body.reservation_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::conflict("reservation not held"))?;
    if row.3 {
        sqlx::query(
            "UPDATE mt_wallets
             SET trial_otp_used = GREATEST(trial_otp_used - $2, 0)
             WHERE merchant_id = $1",
        )
        .bind(row.1)
        .bind(row.2)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    insert_outbox(
        &state.pool,
        "orarepot.wallet.released",
        "reservation",
        body.reservation_id,
        serde_json::json!({ "id": body.reservation_id, "trial": row.3 }),
    )
    .await?;
    Ok(Json(serde_json::json!({ "status": "released", "trial": row.3 })))
}
