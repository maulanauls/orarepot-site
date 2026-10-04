export type InviteLocale = 'id' | 'en';

type InviteEmailInput = {
  toEmail: string;
  toName?: string | null;
  role: string;
  merchantName?: string | null;
  acceptUrl: string;
  declineUrl: string;
  locale?: string | null;
};

function required(name: string) {
  const value = process.env[name]?.trim() ?? '';
  if (!value) {
    const err = new Error(`${name} is not set`);
    (err as Error & { status: number }).status = 503;
    throw err;
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function appPublicUrl() {
  return (process.env.PUBLIC_APP_URL ?? 'https://orarepot.com').replace(/\/$/, '');
}

export function inviteLocale(raw?: string | null): InviteLocale {
  return raw === 'en' ? 'en' : 'id';
}

function copy(
  locale: InviteLocale,
  role: string,
  name: string,
  merchantName: string,
  acceptUrl: string,
  declineUrl: string,
) {
  const signupUrl = `${appPublicUrl()}/register/diorarepot`;
  if (locale === 'en') {
    const roleLabel = role === 'admin' ? 'Admin' : 'Agent';
    return {
      subject: `Invitation to ${merchantName} — Ora Repot`,
      text: [
        `Hello ${name},`,
        '',
        `You are invited to join ${merchantName} on Ora Repot as ${roleLabel}.`,
        'To accept, you need an Ora Repot account that uses this same email address.',
        'If you do not have one yet, create an account first, then open the accept link and sign in with this email.',
        `Create an account: ${signupUrl}`,
        `Accept: ${acceptUrl}`,
        `Decline: ${declineUrl}`,
        '',
        'Links are valid for 7 days. Until you accept, this merchant will not appear on your dashboard.',
      ].join('\n'),
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <p>Hello ${escapeHtml(name)},</p>
          <p>You are invited to join <strong>${escapeHtml(merchantName)}</strong> on <strong>Ora Repot</strong> as <strong>${roleLabel}</strong>.</p>
          <p>To accept, you need an Ora Repot account that uses <strong>this same email address</strong>. If you do not have one yet, <a href="${escapeHtml(signupUrl)}">create an account</a> first, then open the invitation and sign in with this email.</p>
          <p>
            <a href="${escapeHtml(acceptUrl)}"
               style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;margin-right:8px">
              Accept invitation
            </a>
            <a href="${escapeHtml(declineUrl)}"
               style="display:inline-block;background:#fff;color:#111;padding:12px 18px;border-radius:8px;text-decoration:none;border:1px solid #ccc">
              Decline
            </a>
          </p>
          <p style="color:#555;font-size:13px">Links are valid for 7 days. Until you accept, this merchant will not appear on your dashboard.</p>
        </div>
      `,
    };
  }

  const roleLabel = role === 'admin' ? 'Admin' : 'Agent';
  return {
    subject: `Undangan ke ${merchantName} — Ora Repot`,
    text: [
      `Halo ${name},`,
      '',
      `Anda diundang bergabung ke merchant ${merchantName} di Ora Repot sebagai ${roleLabel}.`,
      'Untuk menerima undangan, Anda harus punya akun Ora Repot dengan email yang sama.',
      'Kalau belum punya akun, daftar dulu, lalu buka tautan terima dan masuk dengan email ini.',
      `Daftar: ${signupUrl}`,
      `Terima: ${acceptUrl}`,
      `Tolak: ${declineUrl}`,
      '',
      'Tautan berlaku 7 hari. Sebelum diterima, merchant ini belum muncul di dashboard.',
    ].join('\n'),
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <p>Halo ${escapeHtml(name)},</p>
        <p>Anda diundang bergabung ke merchant <strong>${escapeHtml(merchantName)}</strong> di <strong>Ora Repot</strong> sebagai <strong>${roleLabel}</strong>.</p>
        <p>Untuk menerima undangan, Anda harus punya akun Ora Repot dengan <strong>email yang sama</strong>. Kalau belum punya, <a href="${escapeHtml(signupUrl)}">daftar dulu</a>, lalu buka undangan ini dan masuk dengan email tersebut.</p>
        <p>
          <a href="${escapeHtml(acceptUrl)}"
             style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;margin-right:8px">
            Terima undangan
          </a>
          <a href="${escapeHtml(declineUrl)}"
             style="display:inline-block;background:#fff;color:#111;padding:12px 18px;border-radius:8px;text-decoration:none;border:1px solid #ccc">
            Tolak
          </a>
        </p>
        <p style="color:#555;font-size:13px">Tautan berlaku 7 hari. Sebelum diterima, merchant ini belum muncul di dashboard.</p>
      </div>
    `,
  };
}

export async function sendMemberInviteEmail(input: InviteEmailInput) {
  const apiKey = required('MAILJET_API_KEY');
  const secret = required('MAILJET_SECRET_KEY');
  const fromEmail = process.env.MAILJET_FROM_EMAIL?.trim() || 'hello@orarepot.com';
  const fromName = process.env.MAILJET_FROM_NAME?.trim() || 'Ora Repot';
  const name = input.toName?.trim() || input.toEmail;
  const merchantName = input.merchantName?.trim() || 'Ora Repot';
  const locale = inviteLocale(input.locale);
  const message = copy(locale, input.role, name, merchantName, input.acceptUrl, input.declineUrl);
  const auth = Buffer.from(`${apiKey}:${secret}`).toString('base64');

  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: fromEmail, Name: fromName },
          To: [{ Email: input.toEmail, Name: name }],
          Subject: message.subject,
          TextPart: message.text,
          HTMLPart: message.html,
        },
      ],
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    ErrorMessage?: string;
    Messages?: { Status?: string; Errors?: { ErrorMessage?: string }[] }[];
  };
  const messageError = json.Messages?.[0]?.Errors?.[0]?.ErrorMessage;
  if (!res.ok || json.Messages?.[0]?.Status !== 'success') {
    const err = new Error(
      messageError || json.ErrorMessage || `Mailjet error (${res.status})`,
    );
    (err as Error & { status: number }).status = 502;
    throw err;
  }
}
