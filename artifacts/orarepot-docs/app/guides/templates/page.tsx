import type { Metadata } from 'next';
import { Article } from '@/components/docs-shell';
import { CodeBlock } from '@/components/docs-code';

export const metadata: Metadata = { title: 'TEMPLATES' };

export default function Page() {
  return (
    <Article
      section="OTP"
      title="Templates"
      lead="Outside the 24-hour customer window, WhatsApp only accepts templates. OTP uses category AUTHENTICATION."
    >
      <p>
        Create templates in Dashboard → Template OTP. Status must be ACTIVE before
        the API will send. The code placeholder is {'{{1}}'}.
      </p>
      <h2 id="send">Send with a template name</h2>
      <CodeBlock title="JSON" lang="json">{`{ "to": "+628123456789", "template": "otp_login" }`}</CodeBlock>
    </Article>
  );
}
