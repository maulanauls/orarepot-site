import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'Masuk',
  description: 'Masuk ke akun Ora Repot.',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthShell
      mode="signin"
      title="Masuk"
      subtitle="Masuk untuk mengelola AI Assistant, messaging, dan transaksi digital Anda."
    />
  );
}
