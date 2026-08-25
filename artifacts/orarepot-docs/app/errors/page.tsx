import type { Metadata } from 'next';
import { Article, CodeBlock } from '@/components/docs-shell';

export const metadata: Metadata = { title: 'Errors' };

export default function Page() {
  return (
    <Article
      section="OTP"
      title="Errors"
      lead="Error codes are stable. Branch on code, not on the human message."
    >
      <h2 id="shape">Envelope</h2>
      <CodeBlock>
        {`{
  "error": {
    "code": "insufficient_balance",
    "message": "Deposit tidak cukup untuk 1 OTP (Rp 600)."
  }
}`}
      </CodeBlock>
      <h2 id="codes">Codes</h2>
      <ul>
        <li>
          <code>unauthorized</code> — missing or revoked key
        </li>
        <li>
          <code>template_not_active</code> — template is not ACTIVE
        </li>
        <li>
          <code>invalid_phone</code> — not E.164
        </li>
        <li>
          <code>insufficient_balance</code> — reserve debit failed
        </li>
      </ul>
    </Article>
  );
}
