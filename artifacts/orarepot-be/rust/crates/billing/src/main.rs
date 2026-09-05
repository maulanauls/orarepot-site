use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use orarepot_common::{insert_outbox, require_internal, AppCfg, AppError};
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

#[derive(Serialize, sqlx::FromRow)]
struct WalletBalance {
    merchant_id: Uuid,
    remaining_idr: i64,
    deposit_idr: i64,
    used_otp_idr: i64,
    used_broadcast_idr: i64,
    used_ai_idr: i64,
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
    let state = AppState {
        pool,
        cfg: AppCfg::from_env(),
    };
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/billing/wallets", post(create_wallet))
        .route("/billing/wallets/{merchant_id}", get(get_wallet))
        .route("/billing/invoices/{merchant_id}", get(list_invoices))
        .route("/billing/topups", post(topup))
        .route("/internal/reserve", post(reserve))
        .route("/internal/capture", post(capture))
        .route("/internal/release", post(release))
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
    Ok(Json(serde_json::json!({ "id": id, "merchant_id": body.merchant_id })))
}

async fn get_wallet(
    State(state): State<AppState>,
    Path(merchant_id): Path<Uuid>,
) -> Result<Json<WalletBalance>, AppError> {
    let row = sqlx::query_as::<_, WalletBalance>(
        "SELECT merchant_id, remaining_idr::bigint, deposit_idr::bigint,
                used_otp_idr::bigint, used_broadcast_idr::bigint, used_ai_idr::bigint
         FROM vw_wallet_balances WHERE merchant_id = $1",
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

async fn topup(
    State(state): State<AppState>,
    Json(body): Json<Topup>,
) -> Result<Json<serde_json::Value>, AppError> {
    if body.amount_idr < 10_000 {
        return Err(AppError::bad("minimum topup 10000"));
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
    let order_id = format!("TOP-{}", Uuid::new_v4().simple());
    let payment_id: Uuid = sqlx::query_scalar(
        "INSERT INTO tx_payments
           (merchant_id, order_id, amount_idr, status, customer_name, expires_at, paid_at)
         VALUES ($1,$2,$3,'paid',$4, now() + interval '30 minutes', now())
         RETURNING id",
    )
    .bind(body.merchant_id)
    .bind(&order_id)
    .bind(body.amount_idr)
    .bind(&body.customer_name)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO tx_wallet_ledger
           (wallet_id, merchant_id, entry_type, reason, amount_idr, reference_type, reference_id)
         VALUES ($1,$2,'credit','topup',$3,'payment',$4)",
    )
    .bind(wallet_id)
    .bind(body.merchant_id)
    .bind(body.amount_idr)
    .bind(payment_id)
    .execute(&mut *tx)
    .await?;
    let inv: String = format!("INV-{}", &order_id[4..12]);
    sqlx::query(
        "INSERT INTO tx_invoices (merchant_id, payment_id, number, label, amount_idr, status, paid_at)
         VALUES ($1,$2,$3,$4,$5,'paid', now())",
    )
    .bind(body.merchant_id)
    .bind(payment_id)
    .bind(&inv)
    .bind(format!("Topup {order_id}"))
    .bind(body.amount_idr)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "payment_id": payment_id,
        "order_id": order_id,
        "status": "paid",
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
    let wallet_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM mt_wallets WHERE merchant_id = $1 FOR UPDATE",
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
         WHERE merchant_id = $1 AND status = 'held' AND expires_at > now()",
    )
    .bind(body.merchant_id)
    .fetch_one(&mut *tx)
    .await?;
    if remaining - held < amount {
        return Err(AppError::conflict("insufficient balance"));
    }
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO tx_wallet_reservations
           (merchant_id, wallet_id, feature, amount_idr, units, reference_type, reference_id, expires_at)
         VALUES ($1,$2,$3::feature_code,$4,$5,$6,$7, now() + interval '10 minutes')
         RETURNING id",
    )
    .bind(body.merchant_id)
    .bind(wallet_id)
    .bind(&body.feature)
    .bind(amount)
    .bind(body.units)
    .bind(&body.reference_type)
    .bind(body.reference_id)
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
        serde_json::json!({ "id": id, "merchant_id": body.merchant_id, "amount_idr": amount }),
    )
    .await?;
    Ok(Json(ReservationOut {
        id,
        amount_idr: amount,
        status: "held".into(),
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
    let row = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String, i64, i32, String)>(
        "SELECT id, merchant_id, wallet_id, feature::text, amount_idr, units, status::text
         FROM tx_wallet_reservations WHERE id = $1 FOR UPDATE",
    )
    .bind(body.reservation_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::not_found("reservation"))?;
    if row.6 != "held" {
        return Err(AppError::conflict("reservation not held"));
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
    Ok(Json(serde_json::json!({ "status": "captured", "ledger_id": ledger_id })))
}

async fn release(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CaptureBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_internal(&headers, &state.cfg)?;
    let n = sqlx::query(
        "UPDATE tx_wallet_reservations SET status = 'released'
         WHERE id = $1 AND status = 'held'",
    )
    .bind(body.reservation_id)
    .execute(&state.pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::conflict("reservation not held"));
    }
    insert_outbox(
        &state.pool,
        "orarepot.wallet.released",
        "reservation",
        body.reservation_id,
        serde_json::json!({ "id": body.reservation_id }),
    )
    .await?;
    Ok(Json(serde_json::json!({ "status": "released" })))
}
