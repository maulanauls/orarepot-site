use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use orarepot_common::{insert_outbox, AppCfg, AppError};
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
    templates_url: String,
    billing_url: String,
    stub: bool,
    graph_version: String,
    phone_number_id: String,
    wa_token: String,
    otp_tpl_en_name: String,
    otp_tpl_en_lang: String,
    otp_tpl_id_name: String,
    otp_tpl_id_lang: String,
}

#[derive(Deserialize)]
struct SendBody {
    merchant_id: Uuid,
    template_id: Uuid,
    phone_e164: String,
    request_id: Option<String>,
    waba_account_id: Option<Uuid>,
    code: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct SendRow {
    id: Uuid,
    merchant_id: Uuid,
    template_id: Uuid,
    request_id: String,
    phone_e164: String,
    status: String,
    cost_idr: i64,
    error_message: Option<String>,
    provider_message_id: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
struct ListQ {
    merchant_id: Uuid,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();
    let pool = PgPool::connect(&std::env::var("DATABASE_URL")?).await?;
    let bind: SocketAddr = std::env::var("BIND")
        .unwrap_or_else(|_| "0.0.0.0:8103".into())
        .parse()?;
    let state = AppState {
        pool,
        cfg: AppCfg::from_env(),
        http: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .build()?,
        templates_url: std::env::var("TEMPLATES_URL").unwrap_or_else(|_| "http://127.0.0.1:8203".into()),
        billing_url: std::env::var("BILLING_URL").unwrap_or_else(|_| "http://127.0.0.1:8102".into()),
        stub: std::env::var("WHATSAPP_STUB").unwrap_or_else(|_| "true".into()) != "false",
        graph_version: std::env::var("META_GRAPH_VERSION").unwrap_or_else(|_| "v26.0".into()),
        phone_number_id: std::env::var("META_PHONE_NUMBER_ID")
            .unwrap_or_else(|_| "1241209412413230".into()),
        wa_token: std::env::var("META_WA_TOKEN").unwrap_or_default(),
        otp_tpl_en_name: std::env::var("META_OTP_TEMPLATE_EN")
            .unwrap_or_else(|_| "otp_merchant".into()),
        otp_tpl_en_lang: std::env::var("META_OTP_TEMPLATE_EN_LANG")
            .unwrap_or_else(|_| "en".into()),
        otp_tpl_id_name: std::env::var("META_OTP_TEMPLATE_ID")
            .unwrap_or_else(|_| "otp_merchant_id".into()),
        otp_tpl_id_lang: std::env::var("META_OTP_TEMPLATE_ID_LANG")
            .unwrap_or_else(|_| "id".into()),
    };
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/otp/sends", post(send).get(list))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());
    tracing::info!("orarepot-otp on {bind}");
    axum::serve(tokio::net::TcpListener::bind(bind).await?, app).await?;
    Ok(())
}

async fn send(State(state): State<AppState>, Json(body): Json<SendBody>) -> Result<Json<SendRow>, AppError> {
    if !body.phone_e164.starts_with('+') {
        return Err(AppError::bad("phone_e164 must be E.164"));
    }
    let request_id = body
        .request_id
        .unwrap_or_else(|| format!("req_{}", Uuid::new_v4().simple()));

    let tpl = state
        .http
        .get(format!(
            "{}/internal/templates/{}",
            state.templates_url, body.template_id
        ))
        .header("x-internal-key", &state.cfg.internal_key)
        .send()
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
    if !tpl.status().is_success() {
        return Err(AppError::bad("template not usable"));
    }
    let tpl_json: serde_json::Value = tpl.json().await.map_err(|e| AppError::internal(e.to_string()))?;
    if tpl_json.get("status").and_then(|s| s.as_str()) != Some("ACTIVE") {
        return Err(AppError::bad("template is not ACTIVE"));
    }

    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO tx_otp_sends
           (id, merchant_id, template_id, waba_account_id, request_id, phone_e164, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending')",
    )
    .bind(id)
    .bind(body.merchant_id)
    .bind(body.template_id)
    .bind(body.waba_account_id)
    .bind(&request_id)
    .bind(&body.phone_e164)
    .execute(&state.pool)
    .await?;

    let reserved = state
        .http
        .post(format!("{}/internal/reserve", state.billing_url))
        .header("x-internal-key", &state.cfg.internal_key)
        .json(&serde_json::json!({
            "merchant_id": body.merchant_id,
            "feature": "otp",
            "units": 1,
            "reference_type": "otp_send",
            "reference_id": id
        }))
        .send()
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
    if !reserved.status().is_success() {
        let err = reserved.text().await.unwrap_or_default();
        sqlx::query("UPDATE tx_otp_sends SET status = 'failed', error_message = $2 WHERE id = $1")
            .bind(id)
            .bind(&err)
            .execute(&state.pool)
            .await?;
        return Err(AppError::conflict(format!("reserve failed: {err}")));
    }
    let res_json: serde_json::Value = reserved.json().await.map_err(|e| AppError::internal(e.to_string()))?;
    let reservation_id = res_json
        .get("id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let code = body
        .code
        .clone()
        .filter(|c| !c.is_empty())
        .unwrap_or_else(|| "123456".into());
    let (tpl_name, language_code) = graph_template(&state, &tpl_json);

    let (ok, provider_id, error): (bool, Option<String>, Option<String>) = if state.stub {
        (true, Some(format!("wamid.stub.{}", id.simple())), None)
    } else if state.wa_token.is_empty() {
        (
            false,
            None,
            Some("META_WA_TOKEN is empty — cannot send via Graph API".into()),
        )
    } else {
        match send_whatsapp(
            &state.http,
            &state.graph_version,
            &state.phone_number_id,
            &state.wa_token,
            &body.phone_e164,
            &tpl_name,
            &language_code,
            &code,
        )
        .await
        {
            Ok(wamid) => (true, Some(wamid), None),
            Err(err) => (false, None, Some(err)),
        }
    };

    if ok {
        let _ = state
            .http
            .post(format!("{}/internal/capture", state.billing_url))
            .header("x-internal-key", &state.cfg.internal_key)
            .json(&serde_json::json!({ "reservation_id": reservation_id }))
            .send()
            .await;
        sqlx::query(
            "UPDATE tx_otp_sends SET status = 'success', reservation_id = $2, provider_message_id = $3
             WHERE id = $1",
        )
        .bind(id)
        .bind(reservation_id)
        .bind(&provider_id)
        .execute(&state.pool)
        .await?;
        insert_outbox(
            &state.pool,
            "orarepot.otp.sent",
            "otp_send",
            id,
            serde_json::json!({
                "id": id,
                "merchant_id": body.merchant_id,
                "phone_e164": body.phone_e164,
                "request_id": request_id,
                "status": "success"
            }),
        )
        .await?;
    } else {
        let _ = state
            .http
            .post(format!("{}/internal/release", state.billing_url))
            .header("x-internal-key", &state.cfg.internal_key)
            .json(&serde_json::json!({ "reservation_id": reservation_id }))
            .send()
            .await;
        sqlx::query(
            "UPDATE tx_otp_sends SET status = 'failed', reservation_id = $2, error_message = $3 WHERE id = $1",
        )
        .bind(id)
        .bind(reservation_id)
        .bind(&error)
        .execute(&state.pool)
        .await?;
        insert_outbox(
            &state.pool,
            "orarepot.otp.failed",
            "otp_send",
            id,
            serde_json::json!({
                "id": id,
                "merchant_id": body.merchant_id,
                "error": error
            }),
        )
        .await?;
    }

    list_one(&state.pool, id).await
}

fn graph_template(state: &AppState, tpl: &serde_json::Value) -> (String, String) {
    let name = tpl.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let lang = tpl
        .get("language_code")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if name == state.otp_tpl_id_name
        || name.ends_with("_id")
        || lang == "id"
        || lang.starts_with("id_")
    {
        (
            state.otp_tpl_id_name.clone(),
            state.otp_tpl_id_lang.clone(),
        )
    } else {
        (
            state.otp_tpl_en_name.clone(),
            state.otp_tpl_en_lang.clone(),
        )
    }
}

fn digits_only(phone_e164: &str) -> String {
    phone_e164
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect()
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

async fn list_one(pool: &PgPool, id: Uuid) -> Result<Json<SendRow>, AppError> {
    let row = sqlx::query_as::<_, SendRow>(
        "SELECT id, merchant_id, template_id, request_id, phone_e164, status::text AS status,
                cost_idr, error_message, provider_message_id, created_at
         FROM tx_otp_sends WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(Json(row))
}

async fn list(
    State(state): State<AppState>,
    Query(q): Query<ListQ>,
) -> Result<Json<Vec<SendRow>>, AppError> {
    let rows = sqlx::query_as::<_, SendRow>(
        "SELECT id, merchant_id, template_id, request_id, phone_e164, status::text AS status,
                cost_idr, error_message, provider_message_id, created_at
         FROM tx_otp_sends WHERE merchant_id = $1
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(q.merchant_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}
