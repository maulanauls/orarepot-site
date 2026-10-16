use chrono::{DateTime, Utc};
use image::{ImageFormat, Luma};
use qrcode::QrCode;
use std::io::Cursor;

pub enum PaymentChannel {
    Qris { qr_string: String },
    Va {
        bank: String,
        va_number: String,
        biller_code: Option<String>,
    },
}

pub struct PaymentNotice {
    pub to_email: String,
    pub to_name: String,
    pub language: String,
    pub order_id: String,
    pub amount_idr: i64,
    pub expires_at: DateTime<Utc>,
    pub billing_url: String,
    pub channel: PaymentChannel,
}

pub fn normalize_email(raw: Option<&str>) -> String {
    let email = raw.unwrap_or("").trim().to_ascii_lowercase();
    if email.len() > 200 || email.contains(' ') || !email.contains('@') || email.starts_with('@') {
        return String::new();
    }
    email
}

pub async fn send_payment_email(
    http: &reqwest::Client,
    notice: &PaymentNotice,
) -> Result<(), String> {
    let api_key = std::env::var("MAILJET_API_KEY").unwrap_or_default();
    let secret = std::env::var("MAILJET_SECRET_KEY").unwrap_or_default();
    if api_key.trim().is_empty() || secret.trim().is_empty() {
        return Err("mailjet is not set".into());
    }
    let from_email = std::env::var("MAILJET_FROM_EMAIL")
        .unwrap_or_else(|_| "hello@orarepot.com".into());
    let from_name = std::env::var("MAILJET_FROM_NAME")
        .unwrap_or_else(|_| "Ora Repot".into());
    let english = notice.language == "en";
    let amount = format_idr(notice.amount_idr);
    let until = format_wib(notice.expires_at);
    let name = if notice.to_name.trim().is_empty() {
        notice.to_email.clone()
    } else {
        notice.to_name.trim().to_string()
    };
    let (subject, text, html, inline) = match &notice.channel {
        PaymentChannel::Qris { qr_string } => {
            let png = qr_png(qr_string).ok();
            let copy = if english {
                qris_copy_en(&name, &amount, &notice.order_id, &until, &notice.billing_url, png.is_some())
            } else {
                qris_copy_id(&name, &amount, &notice.order_id, &until, &notice.billing_url, png.is_some())
            };
            (copy.0, copy.1, copy.2, png)
        }
        PaymentChannel::Va {
            bank,
            va_number,
            biller_code,
        } => {
            let copy = if english {
                va_copy_en(
                    &name,
                    &amount,
                    &notice.order_id,
                    &until,
                    bank,
                    va_number,
                    biller_code.as_deref(),
                    &notice.billing_url,
                )
            } else {
                va_copy_id(
                    &name,
                    &amount,
                    &notice.order_id,
                    &until,
                    bank,
                    va_number,
                    biller_code.as_deref(),
                    &notice.billing_url,
                )
            };
            (copy.0, copy.1, copy.2, None)
        }
    };
    let mut message = serde_json::json!({
        "From": { "Email": from_email.trim(), "Name": from_name.trim() },
        "To": [{ "Email": notice.to_email, "Name": name }],
        "Subject": subject,
        "TextPart": text,
        "HTMLPart": html
    });
    if let Some(png) = inline {
        message["InlinedAttachments"] = serde_json::json!([{
            "ContentType": "image/png",
            "Filename": "qris.png",
            "ContentID": "qris",
            "Base64Content": base64(&png)
        }]);
    }
    let auth = base64(format!("{}:{}", api_key.trim(), secret.trim()).as_bytes());
    let res = http
        .post("https://api.mailjet.com/v3.1/send")
        .header("Authorization", format!("Basic {auth}"))
        .json(&serde_json::json!({ "Messages": [message] }))
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = res.status();
    let json: serde_json::Value = res.json().await.unwrap_or_else(|_| serde_json::json!({}));
    let message_status = json
        .pointer("/Messages/0/Status")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if !status.is_success() || message_status != "success" {
        let detail = json
            .pointer("/Messages/0/Errors/0/ErrorMessage")
            .and_then(|v| v.as_str())
            .or_else(|| json.get("ErrorMessage").and_then(|v| v.as_str()))
            .unwrap_or("mailjet rejected the message");
        return Err(format!("{detail} ({status})"));
    }
    Ok(())
}

fn qris_copy_id(
    name: &str,
    amount: &str,
    order_id: &str,
    until: &str,
    billing_url: &str,
    has_qr: bool,
) -> (String, String, String) {
    let subject = format!("Instruksi pembayaran Ora Repot — {amount}");
    let qr_line = if has_qr {
        "Scan QRIS di email ini dari e-wallet atau m-banking."
    } else {
        "Buka halaman Billing untuk melihat QRIS."
    };
    let text = format!(
        "Halo {name},\n\nPembayaran top up saldo Ora Repot masih menunggu.\n\nNominal: {amount}\nOrder: {order_id}\nBerlaku sampai: {until}\n\n{qr_line}\n\nBuka lagi: {billing_url}\n"
    );
    let qr_html = if has_qr {
        "<p style=\"text-align:center\"><img src=\"cid:qris\" width=\"280\" height=\"280\" alt=\"QRIS\"></p>"
    } else {
        ""
    };
    let html = format!(
        "<div style=\"font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111\">\
         <p>Halo {name},</p>\
         <p>Pembayaran top up saldo <strong>Ora Repot</strong> masih menunggu.</p>\
         <p>Nominal: <strong>{amount}</strong><br>Order: {order}<br>Berlaku sampai: {until}</p>\
         {qr_html}\
         <p>{qr_line}</p>\
         <p><a href=\"{url}\">Buka pembayaran</a></p>\
         </div>",
        name = escape(name),
        amount = escape(amount),
        order = escape(order_id),
        until = escape(until),
        qr_html = qr_html,
        qr_line = escape(qr_line),
        url = escape(billing_url),
    );
    (subject, text, html)
}

fn qris_copy_en(
    name: &str,
    amount: &str,
    order_id: &str,
    until: &str,
    billing_url: &str,
    has_qr: bool,
) -> (String, String, String) {
    let subject = format!("Ora Repot payment instructions — {amount}");
    let qr_line = if has_qr {
        "Scan the QRIS in this email from your e-wallet or banking app."
    } else {
        "Open the Billing page to see the QRIS."
    };
    let text = format!(
        "Hello {name},\n\nYour Ora Repot balance top-up is still waiting for payment.\n\nAmount: {amount}\nOrder: {order_id}\nValid until: {until}\n\n{qr_line}\n\nOpen again: {billing_url}\n"
    );
    let qr_html = if has_qr {
        "<p style=\"text-align:center\"><img src=\"cid:qris\" width=\"280\" height=\"280\" alt=\"QRIS\"></p>"
    } else {
        ""
    };
    let html = format!(
        "<div style=\"font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111\">\
         <p>Hello {name},</p>\
         <p>Your <strong>Ora Repot</strong> balance top-up is still waiting for payment.</p>\
         <p>Amount: <strong>{amount}</strong><br>Order: {order}<br>Valid until: {until}</p>\
         {qr_html}\
         <p>{qr_line}</p>\
         <p><a href=\"{url}\">Open payment</a></p>\
         </div>",
        name = escape(name),
        amount = escape(amount),
        order = escape(order_id),
        until = escape(until),
        qr_html = qr_html,
        qr_line = escape(qr_line),
        url = escape(billing_url),
    );
    (subject, text, html)
}

fn va_copy_id(
    name: &str,
    amount: &str,
    order_id: &str,
    until: &str,
    bank: &str,
    va_number: &str,
    biller_code: Option<&str>,
    billing_url: &str,
) -> (String, String, String) {
    let subject = format!("Instruksi pembayaran Ora Repot — {amount}");
    let bank_label = bank.to_ascii_uppercase();
    let (extra_text, extra_html) = va_fields(false, biller_code, va_number);
    let text = format!(
        "Halo {name},\n\nPembayaran top up saldo Ora Repot masih menunggu.\n\nNominal: {amount}\nOrder: {order_id}\nBank: {bank_label}\n{extra_text}Berlaku sampai: {until}\n\nTransfer sesuai nominal di atas.\nBuka lagi: {billing_url}\n"
    );
    let html = format!(
        "<div style=\"font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111\">\
         <p>Halo {name},</p>\
         <p>Pembayaran top up saldo <strong>Ora Repot</strong> masih menunggu.</p>\
         <p>Nominal: <strong>{amount}</strong><br>Order: {order}<br>Bank: <strong>{bank}</strong><br>{extra}Berlaku sampai: {until}</p>\
         <p>Transfer sesuai nominal di atas.</p>\
         <p><a href=\"{url}\">Buka pembayaran</a></p>\
         </div>",
        name = escape(name),
        amount = escape(amount),
        order = escape(order_id),
        bank = escape(&bank_label),
        extra = extra_html,
        until = escape(until),
        url = escape(billing_url),
    );
    (subject, text, html)
}

fn va_copy_en(
    name: &str,
    amount: &str,
    order_id: &str,
    until: &str,
    bank: &str,
    va_number: &str,
    biller_code: Option<&str>,
    billing_url: &str,
) -> (String, String, String) {
    let subject = format!("Ora Repot payment instructions — {amount}");
    let bank_label = bank.to_ascii_uppercase();
    let (extra_text, extra_html) = va_fields(true, biller_code, va_number);
    let text = format!(
        "Hello {name},\n\nYour Ora Repot balance top-up is still waiting for payment.\n\nAmount: {amount}\nOrder: {order_id}\nBank: {bank_label}\n{extra_text}Valid until: {until}\n\nTransfer the exact amount above.\nOpen again: {billing_url}\n"
    );
    let html = format!(
        "<div style=\"font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111\">\
         <p>Hello {name},</p>\
         <p>Your <strong>Ora Repot</strong> balance top-up is still waiting for payment.</p>\
         <p>Amount: <strong>{amount}</strong><br>Order: {order}<br>Bank: <strong>{bank}</strong><br>{extra}Valid until: {until}</p>\
         <p>Transfer the exact amount above.</p>\
         <p><a href=\"{url}\">Open payment</a></p>\
         </div>",
        name = escape(name),
        amount = escape(amount),
        order = escape(order_id),
        bank = escape(&bank_label),
        extra = extra_html,
        until = escape(until),
        url = escape(billing_url),
    );
    (subject, text, html)
}

fn va_fields(english: bool, biller_code: Option<&str>, va_number: &str) -> (String, String) {
    if let Some(code) = biller_code.filter(|code| !code.is_empty()) {
        let (company, number) = if english {
            ("Company code", "Payment number")
        } else {
            ("Kode perusahaan", "Nomor pembayaran")
        };
        return (
            format!("{company}: {code}\n{number}: {va_number}\n"),
            format!(
                "{company}: <strong>{}</strong><br>{number}: <strong>{}</strong><br>",
                escape(code),
                escape(va_number)
            ),
        );
    }
    let label = if english { "VA number" } else { "Nomor VA" };
    (
        format!("{label}: {va_number}\n"),
        format!("{label}: <strong>{}</strong><br>", escape(va_number)),
    )
}

fn qr_png(data: &str) -> Result<Vec<u8>, String> {
    let code = QrCode::new(data.as_bytes()).map_err(|err| err.to_string())?;
    let image = code
        .render::<Luma<u8>>()
        .quiet_zone(true)
        .min_dimensions(320, 320)
        .build();
    let mut bytes = Cursor::new(Vec::new());
    image
        .write_to(&mut bytes, ImageFormat::Png)
        .map_err(|err| err.to_string())?;
    Ok(bytes.into_inner())
}

fn format_idr(amount: i64) -> String {
    let raw = amount.abs().to_string();
    let mut grouped = String::new();
    for (index, ch) in raw.chars().rev().enumerate() {
        if index > 0 && index % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    let digits: String = grouped.chars().rev().collect();
    if amount < 0 {
        format!("-Rp {digits}")
    } else {
        format!("Rp {digits}")
    }
}

fn format_wib(ts: DateTime<Utc>) -> String {
    let local = ts + chrono::Duration::hours(7);
    format!("{} WIB", local.format("%d %b %Y %H:%M"))
}

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn base64(data: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    let mut index = 0;
    while index + 3 <= data.len() {
        let n = ((data[index] as u32) << 16)
            | ((data[index + 1] as u32) << 8)
            | data[index + 2] as u32;
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        out.push(TABLE[((n >> 6) & 63) as usize] as char);
        out.push(TABLE[(n & 63) as usize] as char);
        index += 3;
    }
    if index < data.len() {
        let rest = data.len() - index;
        let mut n = (data[index] as u32) << 16;
        if rest == 2 {
            n |= (data[index + 1] as u32) << 8;
        }
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        if rest == 2 {
            out.push(TABLE[((n >> 6) & 63) as usize] as char);
            out.push('=');
        } else {
            out.push('=');
            out.push('=');
        }
    }
    out
}
