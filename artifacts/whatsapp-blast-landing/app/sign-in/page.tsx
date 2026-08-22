import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Ora Repot account.',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return <AuthShell mode="signin" />;
}
