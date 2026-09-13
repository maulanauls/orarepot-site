import type { Metadata } from 'next';
import { ForgotPasswordFlow } from '@/components/auth/forgot-password-flow';

export const metadata: Metadata = {
  title: 'Lupa kata sandi',
  description: 'Reset kata sandi Ora Repot dengan OTP WhatsApp.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordFlow />;
}
