import type { Metadata } from 'next';
import { DocsArticle, DocsCodeBlock } from '@/components/docs/docs-article';

export const metadata: Metadata = { title: 'Templates' };

export default function Page() {
  return (
    <DocsArticle
      section="Sending & receiving"
      title="Templates"
      lead="Outside the 24-hour customer window, WhatsApp only accepts templates. OTP uses category AUTHENTICATION."
    >
      <p>
        Create templates in Dashboard → Template OTP. Status must be ACTIVE before
        the API will send. The code placeholder is {'{{1}}'}.
      </p>
      <h2 id="send">Send with a template name</h2>
      <DocsCodeBlock>{`{ "to": "+628123456789", "template": "otp_login" }`}</DocsCodeBlock>
    </DocsArticle>
  );
}
