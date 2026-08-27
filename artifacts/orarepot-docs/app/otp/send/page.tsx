import type { Metadata } from 'next';
import { Article } from '@/components/docs-shell';
import { CodeBlock } from '@/components/docs-code';

export const metadata: Metadata = { title: 'SEND OTP' };

export default function Page() {
  return (
    <Article
      section="OTP"
      title="Send OTP"
      lead="POST /v1/otp/send. The template must be AUTHENTICATION and ACTIVE. The code fills placeholder {{1}}."
    >
      <h2 id="request">Request</h2>
      <CodeBlock title="JSON" lang="json">
        {`{
  "to": "+628123456789",
  "template": "otp_login",
  "code": "482193"
}`}
      </CodeBlock>
      <p>
        <code>code</code> is optional — Ora Repot generates 6 digits when omitted.{' '}
        <code>to</code> must be E.164. Cost is Rp 600: wallet reserve, then capture
        after WhatsApp accepts the send.
      </p>
      <h2 id="response">Response</h2>
      <CodeBlock title="Response" lang="json">
        {`{
  "request_id": "req_01J…",
  "status": "success",
  "to": "+628123456789",
  "cost_idr": 600
}`}
      </CodeBlock>
    </Article>
  );
}
