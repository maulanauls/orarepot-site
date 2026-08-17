'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

type Mode = 'signin' | 'register';

export function AuthShell({
  mode,
  title,
  subtitle,
}: {
  mode: Mode;
  title: string;
  subtitle: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      mode === 'signin'
        ? 'Form masuk siap dihubungkan ke backend autentikasi.'
        : 'Form registrasi siap dihubungkan ke backend autentikasi.',
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-form-pane">
        <Link href="/" className="auth-close" aria-label="Kembali ke beranda">
          ×
        </Link>
        <div className="auth-form-wrap">
          <img src="/logo-orarepot.png" alt="Ora Repot" className="auth-logo" />
          <h1>{title}</h1>
          <p>{subtitle}</p>

          <form className="auth-form" onSubmit={onSubmit}>
            {mode === 'register' && (
              <label>
                Nama lengkap
                <input required name="name" placeholder="Nama Anda" />
              </label>
            )}
            <label>
              Email atau WhatsApp
              <input required name="identifier" placeholder="email@bisnis.com / 08xx" />
            </label>
            <label>
              Kata sandi
              <span className="password-field">
                <input
                  required
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Tampilkan kata sandi"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            {mode === 'register' && (
              <label>
                Konfirmasi kata sandi
                <input required name="confirm" type="password" placeholder="••••••••" minLength={6} />
              </label>
            )}

            {mode === 'signin' && (
              <div className="auth-row">
                <label className="remember">
                  <input type="checkbox" name="remember" /> Ingat akun saya
                </label>
                <button type="button" className="linkish">
                  Lupa kata sandi?
                </button>
              </div>
            )}

            <button type="submit" className="auth-submit">
              {mode === 'signin' ? 'Masuk' : 'Daftar sekarang'} <ArrowRight size={16} />
            </button>
          </form>

          <div className="auth-divider">
            <span>Atau lanjutkan dengan</span>
          </div>

          <button
            type="button"
            className="google-btn"
            onClick={() => setMessage('Google sign-in siap dihubungkan (OAuth).')}
          >
            <GoogleMark />
            Google
          </button>

          <p className="auth-switch">
            {mode === 'signin' ? (
              <>
                Belum punya akun? <Link href="/register/diorarepot">Daftar</Link>
              </>
            ) : (
              <>
                Sudah punya akun? <Link href="/sign-in">Masuk</Link>
              </>
            )}
          </p>

          {message && <p className="auth-note">{message}</p>}
        </div>
      </section>

      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-visual-glow" />
        <div className="auth-visual-copy">
          <p className="eyebrow">ORAREPOT</p>
          <h2>AI Assistant untuk merchant WhatsApp.</h2>
          <ul>
            <li>Jaga customer relationship otomatis</li>
            <li>Broadcast & OTP resmi Meta</li>
            <li>Pulsa & voucher dalam satu ekosistem</li>
          </ul>
        </div>
        <div className="auth-chat-preview">
          <div className="bubble in">Stok masih ada, Kak?</div>
          <div className="bubble out">Masih ready. Mau saya buatkan invoice sekarang?</div>
        </div>
      </aside>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M9 7.2v3.5h4.9c-.2 1.1-1.5 3.3-4.9 3.3A5.4 5.4 0 1 1 9 3.6c1.5 0 2.6.7 3.2 1.2l2.2-2.1A8.4 8.4 0 1 0 9 17.3c4.9 0 8.1-3.4 8.1-8.2 0-.6-.1-1-.2-1.5H9z"
      />
    </svg>
  );
}
