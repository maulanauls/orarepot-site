export type InviteLocale = 'id' | 'en';

type InviteEmailInput = {
  toEmail: string;
  toName?: string | null;
  role: string;
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
  acceptUrl: string,
  declineUrl: string,
) {
  if (locale === 'en') {
    const roleLabel = role === 'admin' ? 'Admin' : 'Agent';
    return {
      subject: `${roleLabel} invitation — Ora Repot`,
      text: [
        `Hello ${name},`,
        '',
        `You are invited to join an Ora Repot workspace as ${roleLabel}.`,
        `Accept: ${acceptUrl}`,
        `Decline: ${declineUrl}`,
        '',
        'Links are valid for 7 days. If you do not have an account yet, sign up first, then accept.',
      ].join('\n'),
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <p>Hello ${escapeHtml(name)},</p>
          <p>You are invited to join an <strong>Ora Repot</strong> workspace as <strong>${roleLabel}</strong>.</p>
          <p>
            <a href="${escapeHtml(acceptUrl)}"
               style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;margin-right:8px">
              Accept
            </a>
            <a href="${escapeHtml(declineUrl)}"
               style="display:inline-block;background:#fff;color:#111;padding:12px 18px;border-radius:8px;text-decoration:none;border:1px solid #ccc">
              Decline
            </a>
          </p>
          <p style="color:#555;font-size:13px">Links are valid for 7 days. Until you accept, you will not be an active team member.</p>
        </div>
      `,
    };
  }

  const roleLabel = role === 'admin' ? 'Admin' : 'Agent';
  return {
    subject: `Undangan ${roleLabel} — Ora Repot`,
    text: [
      `Halo ${name},`,
      '',
      `Anda diundang bergabung ke workspace Ora Repot sebagai ${roleLabel}.`,
      `Terima: ${acceptUrl}`,
      `Tolak: ${declineUrl}`,
      '',
      'Tautan berlaku 7 hari. Jika belum punya akun, daftar dulu lalu terima undangan.',
    ].join('\n'),
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <p>Halo ${escapeHtml(name)},</p>
        <p>Anda diundang bergabung ke workspace <strong>Ora Repot</strong> sebagai <strong>${roleLabel}</strong>.</p>
        <p>
          <a href="${escapeHtml(acceptUrl)}"
             style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;margin-right:8px">
            Terima
          </a>
          <a href="${escapeHtml(declineUrl)}"
             style="display:inline-block;background:#fff;color:#111;padding:12px 18px;border-radius:8px;text-decoration:none;border:1px solid #ccc">
            Tolak
          </a>
        </p>
        <p style="color:#555;font-size:13px">Tautan berlaku 7 hari. Sebelum diterima, Anda belum menjadi anggota aktif.</p>
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
  const locale = inviteLocale(input.locale);
  const message = copy(locale, input.role, name, input.acceptUrl, input.declineUrl);
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
