import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'Daftar',
  description: 'Buat akun Ora Repot untuk merchant WhatsApp.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthShell
      mode="register"
      title="Daftar"
      subtitle="Buat akun diorarepot dan mulai pakai AI Assistant untuk merchant WhatsApp."
    />
  );
}
