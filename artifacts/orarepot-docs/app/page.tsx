import type { Metadata } from 'next';
import { Article, Cards, CodeTabs } from '@/components/docs-shell';

export const metadata: Metadata = { title: 'Overview' };

export default function Page() {
  return (
    <Article
      section="Getting Started"
      title="Overview"
      lead="Ora Repot is the WhatsApp OTP API, packaged for merchants. Clean REST, one bearer token, HMAC webhooks, deposit-backed send."
    >
      <h2 id="why">Why Ora Repot</h2>
      <Cards
        items={[
          {
            title: 'One bearer token',
            body: 'Issue keys in OTP Settings, pass Authorization: Bearer orp_live_… — no OAuth, no PKCE.',
          },
          {
            title: 'Template-first OTP',
            body: 'Only AUTHENTICATION templates with status ACTIVE. Placeholder {{1}} is the code.',
          },
          {
            title: 'Wallet reserve / capture',
            body: 'Rp 600 per number. orarepot-otp reserves, then captures or releases after send.',
          },
          {
            title: 'Stable webhooks',
            body: 'otp.sent and otp.failed, HMAC-SHA256, retries from the developer service.',
          },
        ]}
      />

      <h2 id="send">Send an OTP in five lines</h2>
      <CodeTabs
        tabs={[
          {
            label: 'TypeScript',
            code: `const res = await fetch('https://api.orarepot.com/v1/otp/send', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.ORAREPOT_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+628123456789',
    template: 'otp_login',
  }),
})
const json = await res.json()`,
          },
          {
            label: 'cURL',
            code: `curl -X POST https://api.orarepot.com/v1/otp/send \\
  -H "Authorization: Bearer $ORAREPOT_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+628123456789",
    "template": "otp_login"
  }'`,
          },
          {
            label: 'Python',
            code: `import os, requests

requests.post(
    "https://api.orarepot.com/v1/otp/send",
    headers={"Authorization": f"Bearer {os.environ['ORAREPOT_KEY']}"},
    json={"to": "+628123456789", "template": "otp_login"},
)`,
          },
        ]}
      />
      <p>The recipient sees the WhatsApp OTP in a couple of seconds.</p>

      <h2 id="inside">What’s inside</h2>
      <Cards
        items={[
          {
            title: 'Public host',
            body: 'api.orarepot.com — never orarepot.com/api. Dashboard stays on orarepot.com.',
          },
          {
            title: 'OpenAPI later',
            body: 'Same contract as OTP Settings: send, logs, webhook deliveries, request log.',
          },
          {
            title: 'Request log',
            body: 'Every authenticated call is listed in OTP Settings → Log request.',
          },
          {
            title: 'Keys & webhooks',
            body: 'Create, revoke, rotate secret — all from the merchant dashboard.',
          },
        ]}
      />

      <h2 id="start">Where to start</h2>
      <Cards
        items={[
          {
            title: 'Quickstart',
            body: 'API key to first OTP in five minutes.',
            href: '/quickstart',
          },
          {
            title: 'Webhooks',
            body: 'Subscribe, verify HMAC, handle otp.sent / otp.failed.',
            href: '/webhooks',
          },
          {
            title: 'Send OTP',
            body: 'Request body, response, and the Rp 600 reserve.',
            href: '/otp/send',
          },
          {
            title: 'Errors',
            body: 'Stable error codes you can branch on.',
            href: '/errors',
          },
        ]}
      />
    </Article>
  );
}
