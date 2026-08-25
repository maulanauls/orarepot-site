import type { Metadata } from 'next';
import { Article, CodeBlock } from '@/components/docs-shell';

export const metadata: Metadata = { title: 'Authentication' };

export default function Page() {
  return (
    <Article
      section="OTP"
      title="Authentication"
      lead="Every request to api.orarepot.com uses a bearer token issued in OTP Settings. There is no OAuth dance."
    >
      <h2 id="header">Header</h2>
      <CodeBlock>{`Authorization: Bearer orp_live_<secret>`}</CodeBlock>
      <h2 id="rules">Rules</h2>
      <ul>
        <li>The full key is shown once at creation time.</li>
        <li>Revoke it in the dashboard if it leaks.</li>
        <li>Keep it on your server — never in a merchant customer’s browser.</li>
        <li>
          Public host is <code>api.orarepot.com</code>, not{' '}
          <code>orarepot.com/api</code>.
        </li>
      </ul>
    </Article>
  );
}
