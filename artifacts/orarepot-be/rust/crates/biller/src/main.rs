mod orders;

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use uuid::Uuid;

/// SVG distribution of the Bill Payment Logo Library — Indonesia
/// (https://www.figma.com/community/file/1325472637345495839).
const LOGO_CDN: &str = "https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons";

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    pay: Arc<orders::PayConfig>,
}

#[derive(Serialize)]
struct CatalogOut {
    categories: Vec<CategoryOut>,
}

#[derive(Serialize)]
struct CategoryOut {
    id: Uuid,
    key: String,
    label: String,
    kind: String,
    brands: Vec<BrandOut>,
}

#[derive(Serialize)]
struct BrandOut {
    name: String,
    logo_url: Option<String>,
    types: Vec<String>,
}

#[derive(Serialize)]
struct ProductsOut {
    products: Vec<ProductOut>,
}

#[derive(Serialize)]
struct ProductOut {
    lookup_idf: Uuid,
    name: String,
    code: Option<String>,
    price: i64,
    popular: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct CategoryRow {
    business_module_idf: Uuid,
    name: String,
}

#[derive(Debug, sqlx::FromRow)]
struct BrandRow {
    name: String,
    photo: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct TypeRow {
    brand: String,
    lookup_type: String,
}

#[derive(Debug, sqlx::FromRow)]
struct ProductRow {
    lookup_idf: Uuid,
    lookup_name: Option<String>,
    lookup_code: Option<String>,
    selling_price: i64,
}

#[derive(Deserialize)]
struct ProductQuery {
    module: Uuid,
    brand: String,
    #[serde(default)]
    r#type: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();
    let db = std::env::var("DATABASE_URL")?;
    let bind = std::env::var("BIND").unwrap_or_else(|_| "0.0.0.0:8105".into());
    let pool = PgPool::connect(&db).await?;
    let pay = orders::PayConfig::from_env()?;
    if pay.midtrans_url.is_none() || pay.midtrans_key.is_none() {
        tracing::warn!("MIDTRANS_URL or MIDTRANS_SERVER_KEY missing: QRIS payments are disabled");
    }
    if pay.digiflazz_username.is_none() || pay.digiflazz_key.is_none() {
        tracing::warn!("DIGIFLAZZ_USERNAME or DIGIFLAZZ_KEY missing: orders get no Digiflazz signature");
    }
    if pay.paid_callback_url.is_none() {
        tracing::warn!("PAID_CALLBACK_URL missing: full koin payments are disabled");
    }
    let state = AppState { pool, pay: Arc::new(pay) };
    tokio::spawn(orders::sweep_expired(state.clone()));
    let app = Router::new()
        .route("/health", get(|| async { orarepot_common::health() }))
        .route("/biller/catalog", get(catalog))
        .route("/biller/catalog/products", get(products))
        .route("/biller/orders", get(orders::list_orders).post(orders::create_order))
        .route("/biller/orders/{code}", get(orders::get_order))
        .route("/biller/orders/{code}/pay", post(orders::pay_order))
        .route("/biller/wallet", get(orders::wallet))
        .route("/biller/wallet/ledger", get(orders::wallet_ledger))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());
    let addr: SocketAddr = bind.parse()?;
    tracing::info!("orarepot-biller on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn catalog(State(state): State<AppState>) -> Result<Json<CatalogOut>, orarepot_common::AppError> {
    let rows = sqlx::query_as::<_, CategoryRow>(
        r#"
        SELECT DISTINCT ON (business_module_idf)
            business_module_idf,
            corporate_business_module_name AS name
        FROM mt_corporate_business_module
        WHERE corporate_business_parent_module_idf IS NOT NULL
          AND corporate_business_module_name IS NOT NULL
          AND COALESCE(corporate_business_module_status, true) = true
          AND corporate_business_module_name NOT IN ('Cek Koin', 'Referral')
        ORDER BY business_module_idf, corporate_business_module_sort NULLS LAST
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    let mut categories = Vec::with_capacity(rows.len());
    for row in rows {
        let kind = kind_of(&row.name);
        let brands = load_brands(&state.pool, row.business_module_idf).await?;
        if brands.is_empty() && kind != "pulsa" && kind != "data" && kind != "pln" && kind != "game" {
            continue;
        }
        categories.push(CategoryOut {
            id: row.business_module_idf,
            key: kind.to_string(),
            label: label_of(kind, &row.name),
            kind: kind.to_string(),
            brands,
        });
    }
    categories.sort_by_key(|item| (rank(&item.kind), item.label.clone()));
    Ok(Json(CatalogOut { categories }))
}

async fn products(
    State(state): State<AppState>,
    Query(query): Query<ProductQuery>,
) -> Result<Json<ProductsOut>, orarepot_common::AppError> {
    let brand = query.brand.trim();
    if brand.is_empty() {
        return Err(orarepot_common::AppError::bad("brand is required"));
    }
    let typed = query.r#type.as_deref().map(str::trim).filter(|value| !value.is_empty());
    let mut rows = load_products(&state.pool, query.module, brand, typed).await?;
    if rows.is_empty() && typed.is_none() {
        rows = load_products(&state.pool, query.module, brand, Some("*")).await?;
    }
    let mut best: HashMap<String, ProductRow> = HashMap::new();
    for row in rows {
        let name = row
            .lookup_name
            .clone()
            .unwrap_or_else(|| row.lookup_code.clone().unwrap_or_else(|| "Produk".into()));
        let key = name.split_whitespace().collect::<Vec<_>>().join(" ").to_uppercase();
        match best.get(&key) {
            Some(current) if current.selling_price >= row.selling_price => {}
            _ => {
                best.insert(key, row);
            }
        }
    }
    let mut products: Vec<ProductOut> = best
        .into_values()
        .map(|row| {
            let name = row
                .lookup_name
                .unwrap_or_else(|| row.lookup_code.clone().unwrap_or_else(|| "Produk".into()));
            ProductOut {
                lookup_idf: row.lookup_idf,
                name,
                code: row.lookup_code,
                price: row.selling_price,
                popular: false,
            }
        })
        .collect();
    products.sort_by(|a, b| denom_number(&a.name).cmp(&denom_number(&b.name)).then(a.name.cmp(&b.name)));
    if products.len() >= 2 {
        products[1].popular = true;
    }
    Ok(Json(ProductsOut { products }))
}

async fn load_brands(pool: &PgPool, module: Uuid) -> Result<Vec<BrandOut>, orarepot_common::AppError> {
    let brands = sqlx::query_as::<_, BrandRow>(
        r#"
        SELECT DISTINCT ON (UPPER(TRIM(COALESCE(lookup_name, lookup_code, ''))))
            TRIM(COALESCE(lookup_name, lookup_code)) AS name,
            NULLIF(TRIM(lookup_photo), '') AS photo
        FROM mt_lookup
        WHERE business_module_idf = $1
          AND lookup_value = 'BRAND'
          AND lookup_type IS NULL
          AND lookup_maintenance = false
          AND COALESCE(lookup_name, lookup_code, '') <> ''
        ORDER BY UPPER(TRIM(COALESCE(lookup_name, lookup_code, ''))), lookup_sort
        "#,
    )
    .bind(module)
    .fetch_all(pool)
    .await?;

    let types = sqlx::query_as::<_, TypeRow>(
        r#"
        SELECT DISTINCT TRIM(lookup_brand) AS brand, TRIM(lookup_type) AS lookup_type
        FROM mt_lookup
        WHERE business_module_idf = $1
          AND lookup_value = 'BRAND'
          AND lookup_brand IS NOT NULL
          AND lookup_type IS NOT NULL
          AND lookup_maintenance = false
        "#,
    )
    .bind(module)
    .fetch_all(pool)
    .await?;

    let mut grouped: HashMap<String, Vec<String>> = HashMap::new();
    for row in types {
        grouped.entry(row.brand.to_uppercase()).or_default().push(row.lookup_type);
    }
    let mut out = Vec::with_capacity(brands.len());
    for brand in brands {
        let mut types = grouped.remove(&brand.name.to_uppercase()).unwrap_or_default();
        types.sort_by(|a, b| type_rank(a).cmp(&type_rank(b)).then(a.cmp(b)));
        types.dedup();
        let photo = brand.photo.filter(|value| !value.is_empty());
        out.push(BrandOut {
            logo_url: photo.or_else(|| logo_url(&brand.name)),
            name: brand.name,
            types,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

async fn load_products(
    pool: &PgPool,
    module: Uuid,
    brand: &str,
    kind: Option<&str>,
) -> Result<Vec<ProductRow>, orarepot_common::AppError> {
    let all = kind == Some("*");
    let typed = if all { None } else { kind.map(str::to_string) };
    sqlx::query_as::<_, ProductRow>(
        r#"
        WITH picked AS (
            SELECT corporate_idf
            FROM mt_corporate_business_module
            WHERE business_module_idf = $1
              AND corporate_business_parent_module_idf IS NOT NULL
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
            l.lookup_idf,
            l.lookup_name,
            l.lookup_code,
            CEIL(
                CASE
                    WHEN UPPER(COALESCE(cs.commission_basis, corp.basis, 'PERCENTAGE')) = 'FIXED'
                        THEN l.lookup_value::numeric + COALESCE(cs.commissions_value, corp.rate, 0)
                    WHEN UPPER(COALESCE(cs.commission_basis, corp.basis, 'PERCENTAGE')) = 'PERCENTAGE'
                        THEN l.lookup_value::numeric
                            + (l.lookup_value::numeric * COALESCE(cs.commissions_value, corp.rate, 0) / 100)
                    ELSE l.lookup_value::numeric * 1.03
                END
            )::bigint AS selling_price
        FROM mt_lookup l
        LEFT JOIN picked p ON true
        LEFT JOIN LATERAL (
            SELECT commission_basis, commissions_value
            FROM mt_commissions_settings
            WHERE lookup_idf = l.lookup_idf
              AND corporate_idf = p.corporate_idf
              AND commissions_type = 'SELLING_PRICE'
            LIMIT 1
        ) cs ON true
        LEFT JOIN corp ON true
        WHERE l.business_module_idf = $1
          AND l.lookup_monitor = true
          AND l.lookup_maintenance = false
          AND UPPER(TRIM(l.lookup_brand)) = UPPER(TRIM($2))
          AND l.lookup_value ~ '^[0-9]+(\.[0-9]+)?$'
          AND (
                $4::bool
                OR (
                    $3::text IS NULL
                    AND (l.lookup_type IS NULL OR UPPER(l.lookup_type) = 'UMUM')
                )
                OR (
                    $3::text IS NOT NULL
                    AND UPPER(l.lookup_type) = UPPER($3)
                )
          )
          AND (
                $3::text IS NOT NULL
                OR $4::bool
                OR NOT EXISTS (
                    SELECT 1
                    FROM mt_lookup region
                    WHERE region.business_module_idf = l.business_module_idf
                      AND region.lookup_value = 'BRAND'
                      AND UPPER(TRIM(region.lookup_brand)) = UPPER(TRIM(l.lookup_brand))
                      AND region.lookup_type IS NOT NULL
                      AND UPPER(region.lookup_type) NOT IN ('UMUM', 'INDONESIA')
                      AND l.lookup_name ILIKE '%' || region.lookup_type || '%'
                )
          )
        "#,
    )
    .bind(module)
    .bind(brand)
    .bind(typed)
    .bind(all)
    .fetch_all(pool)
    .await
    .map_err(orarepot_common::AppError::from)
}

fn kind_of(name: &str) -> &'static str {
    let value = name.to_uppercase();
    if value.contains("GAME") {
        "game"
    } else if value.contains("PLN") {
        "pln"
    } else if value.contains("DATA") || value.contains("KUOTA") {
        "data"
    } else if value.contains("PULSA") {
        "pulsa"
    } else if value.contains("MONEY") || value.contains("WALLET") {
        "emoney"
    } else {
        "other"
    }
}

fn label_of(kind: &str, name: &str) -> String {
    match kind {
        "pulsa" => "PULSA".into(),
        "data" => "DATA".into(),
        "pln" => "PLN TOKEN".into(),
        "game" => "GAME KEY".into(),
        "emoney" => "E-MONEY".into(),
        _ => name.trim().to_uppercase(),
    }
}

fn rank(kind: &str) -> u8 {
    match kind {
        "pulsa" => 0,
        "data" => 1,
        "pln" => 2,
        "game" => 3,
        "emoney" => 4,
        _ => 5,
    }
}

fn type_rank(value: &str) -> u8 {
    match value.to_uppercase().as_str() {
        "UMUM" | "INDONESIA" => 0,
        _ => 1,
    }
}

fn denom_number(name: &str) -> i64 {
    let digits: String = name.chars().filter(|c| c.is_ascii_digit()).collect();
    digits.parse().unwrap_or(0)
}

fn logo_url(brand: &str) -> Option<String> {
    let key: String = brand
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_uppercase();
    let slug = match key.as_str() {
        "TELKOMSEL" | "TSEL" | "SIMPATI" => "telkomsel",
        "XL" | "XLAXIATA" => "xl",
        "AXIS" => "axis",
        "TRI" | "THREE" => "tri",
        "INDOSAT" | "IM3" | "MENTARI" => "im3",
        "SMARTFREN" => "smartfren",
        "BYU" => "by-u",
        "DANA" => "dana",
        "GOPAY" => "gopay",
        "OVO" => "ovo",
        "LINKAJA" => "linkaja",
        "PLN" | "PLNTOKEN" | "TOKENPLN" => "pln",
        _ => return None,
    };
    Some(format!("{LOGO_CDN}/{slug}.svg"))
}
