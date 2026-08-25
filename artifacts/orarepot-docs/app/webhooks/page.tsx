import type { Metadata } from 'next';
import { Article, CodeBlock } from '@/components/docs-shell';

export const metadata: Metadata = { title: 'Webhooks' };

export default function Page() {
  return (
    <Article
      section="OTP"
      title="Webhooks"
      lead="Ora Repot POSTs to your HTTPS URL. Events: otp.sent and otp.failed. Verify HMAC-SHA256."
    >
      <p>
        Set the URL in Dashboard → OTP Settings. The signing secret is shown when
        you save or rotate.
      </p>
      <h2 id="headers">Headers</h2>
      <CodeBlock>{`X-OraRepot-Signature: sha256=<hex>
X-OraRepot-Event: otp.sent`}</CodeBlock>
      <h2 id="body">Body</h2>
      <CodeBlock title="otp.sent">
        {`{
  "id": "evt_01J…",
  "event": "otp.sent",
  "request_id": "req_01J…",
  "to": "+628123456789",
  "template": "otp_login",
  "created_at": "2026-08-25T03:00:00.000Z"
}`}
      </CodeBlock>
    </Article>
  );
}
