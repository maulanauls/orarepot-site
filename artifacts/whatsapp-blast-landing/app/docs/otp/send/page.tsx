import type { Metadata } from 'next';
import { DocsArticle, DocsCodeBlock } from '@/components/docs/docs-article';

export const metadata: Metadata = { title: 'Send OTP' };

export default function Page() {
  return (
    <DocsArticle
      section="Sending & receiving"
      title="Send OTP"
      lead="POST /v1/otp/send. The template must be AUTHENTICATION and ACTIVE. The code fills placeholder {{1}}."
    >
      <h2 id="request">Request</h2>
      <DocsCodeBlock title="JSON">
        {`{
  "to": "+628123456789",
  "template": "otp_login",
  "code": "482193"
}`}
      </DocsCodeBlock>
      <p>
        <code>code</code> is optional — Ora Repot generates 6 digits when omitted.{' '}
        <code>to</code> must be E.164. Cost is Rp 600: wallet reserve, then capture
        after WhatsApp accepts the send.
      </p>
      <h2 id="response">Response</h2>
      <DocsCodeBlock>
        {`{
  "request_id": "req_01J…",
  "status": "success",
  "to": "+628123456789",
  "cost_idr": 600
}`}
      </DocsCodeBlock>
      <h2 id="postman">Postman</h2>
      <p>
        Import the ready-made collection into Postman, then set collection variable{' '}
        <code>apiKey</code> to your <code>orp_live_…</code> key from OTP Settings.
      </p>
      <p>
        <a href="/postman/OraRepot-OTP-API.postman_collection.json" download>
          Download Ora Repot OTP API Postman collection
        </a>
      </p>
    </DocsArticle>
  );
}
