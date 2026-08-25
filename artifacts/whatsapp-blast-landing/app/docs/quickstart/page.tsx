import type { Metadata } from 'next';
import {
  DocsArticle,
  DocsCards,
  DocsCodeTabs,
} from '@/components/docs/docs-article';

export const metadata: Metadata = { title: 'Quickstart' };

export default function Page() {
  return (
    <DocsArticle
      section="Getting Started"
      title="Quickstart"
      lead="You need an Ora Repot merchant with an ACTIVE OTP template and enough deposit for Rp 600. Keys are issued in Dashboard → OTP Settings."
    >
      <h2 id="goal">Goal</h2>
      <p>By the end of this page you’ll have:</p>
      <ol>
        <li>Issued an API key.</li>
        <li>Sent an OTP to a WhatsApp number.</li>
        <li>
          Seen <code>otp.sent</code> on your webhook (optional).
        </li>
      </ol>
      <p>Total time: under five minutes if the template is already ACTIVE.</p>

      <h2 id="key">Issue an API key</h2>
      <p>
        In the dashboard, open OTP Settings → API Key → Create. Copy the plaintext
        value immediately — Ora Repot shows it exactly once.
      </p>
      <DocsCodeTabs
        tabs={[
          {
            label: 'shell',
            code: `# Store the key in your shell — never commit it.
export ORAREPOT_KEY=orp_live_xxxxxxxxxxxxxxxxxxxxxxxx`,
          },
        ]}
      />

      <h2 id="send">Send your first OTP</h2>
      <DocsCodeTabs
        tabs={[
          {
            label: 'cURL',
            code: `curl -sS https://api.orarepot.com/v1/otp/send \\
  -H "Authorization: Bearer $ORAREPOT_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"+628123456789","template":"otp_login"}'`,
          },
          {
            label: 'TypeScript',
            code: `const res = await fetch('https://api.orarepot.com/v1/otp/send', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.ORAREPOT_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ to: '+628123456789', template: 'otp_login' }),
})
console.log(await res.json())`,
          },
        ]}
      />
      <p>
        Expected shape: <code>{`{ request_id, status, to, cost_idr }`}</code>. Status
        starts as <code>pending</code> then <code>success</code> or{' '}
        <code>failed</code>.
      </p>

      <h2 id="next">What’s next</h2>
      <DocsCards
        items={[
          {
            title: 'Webhooks',
            body: 'Stop polling. Receive otp.sent and otp.failed as they happen.',
            href: '/docs/webhooks',
          },
          {
            title: 'Authentication',
            body: 'Key rotation, where to store secrets, host rules.',
            href: '/docs/authentication',
          },
          {
            title: 'Errors',
            body: 'insufficient_balance, template_not_active, and friends.',
            href: '/docs/errors',
          },
        ]}
      />
    </DocsArticle>
  );
}
