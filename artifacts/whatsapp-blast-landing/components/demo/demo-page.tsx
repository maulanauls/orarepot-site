'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ServiceTab = 'otp' | 'bot';

/** Ganti nomor ini ke WhatsApp bot demo Ora Repot */
const DEMO_BOT_NUMBER = '6281234567890';
const DEMO_BOT_DISPLAY = '0812-3456-7890';
const DEMO_OTP = '482915';

function resolveTab(minat: string | null): ServiceTab {
  if (minat === 'ai' || minat === 'bot') return 'bot';
  return 'otp';
}

function waDemoLink(message: string) {
  return `https://wa.me/${DEMO_BOT_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function DemoPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ServiceTab>(() => resolveTab(searchParams.get('minat')));

  useEffect(() => {
    setTab(resolveTab(searchParams.get('minat')));
  }, [searchParams]);

  return (
    <main className="demo-login-page">
      <section className="demo-login-shell">
        <div className="demo-login-pane">
          <Link href="/" className="auth-close" aria-label="Kembali ke beranda">
            ×
          </Link>

          <div className="demo-login-wrap">
            <img src="/logo-orarepot.svg" alt="Ora Repot" className="auth-logo" />

            <div className="demo-service-tabs" role="tablist" aria-label="Layanan demo">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'otp'}
                className={cn(tab === 'otp' && 'active')}
                onClick={() => setTab('otp')}
              >
                <ShieldCheck size={15} /> OTP Demo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'bot'}
                className={cn(tab === 'bot' && 'active')}
                onClick={() => setTab('bot')}
              >
                <Bot size={15} /> WhatsApp Bot
              </button>
            </div>

            {tab === 'otp' ? <OtpDemoPanel /> : <WhatsAppBotPanel />}

            <p className="auth-switch">
              Tertarik pakai di bisnis Anda?{' '}
              <Link href="/register/diorarepot">Daftar gratis</Link>
              {' · '}
              <Link href="/sign-in">Masuk</Link>
            </p>
          </div>
        </div>

        <aside className="demo-login-visual" aria-hidden="true">
          <div className="demo-visual-glow" />
          <div className="demo-visual-copy">
            <p className="eyebrow">Product services</p>
            <h2>
              {tab === 'otp'
                ? 'Coba kirim OTP resmi seperti di produksi.'
                : 'Chat langsung ke bot WhatsApp demo.'}
            </h2>

            {tab === 'otp' ? (
              <div className="demo-howto">
                <article>
                  <span>1</span>
                  <div>
                    <strong>Isi nomor tujuan</strong>
                    <p>Masukkan WhatsApp yang akan menerima kode OTP demo.</p>
                  </div>
                </article>
                <article>
                  <span>2</span>
                  <div>
                    <strong>Kirim OTP</strong>
                    <p>Simulasi pengiriman OTP lewat jalur WhatsApp Business.</p>
                  </div>
                </article>
                <article>
                  <span>3</span>
                  <div>
                    <strong>Verifikasi kode</strong>
                    <p>Masukkan 6 digit — sama seperti login / checkout merchant.</p>
                  </div>
                </article>
              </div>
            ) : (
              <div className="demo-howto">
                <article>
                  <span>1</span>
                  <div>
                    <strong>Buka WhatsApp</strong>
                    <p>Klik tombol chat — langsung ke nomor bot demo Ora Repot.</p>
                  </div>
                </article>
                <article>
                  <span>2</span>
                  <div>
                    <strong>Kirim pesan</strong>
                    <p>Tanya stok, harga, atau ongkir seperti pelanggan toko.</p>
                  </div>
                </article>
                <article>
                  <span>3</span>
                  <div>
                    <strong>Lihat AI balas</strong>
                    <p>Rasakan Agentic AI customer relationship secara live.</p>
                  </div>
                </article>
              </div>
            )}

            <ul className="demo-points">
              <li>
                <ShieldCheck size={16} /> OTP untuk verifikasi aman
              </li>
              <li>
                <Bot size={16} /> Bot AI di WhatsApp asli
              </li>
              <li>
                <MessageCircle size={16} /> Siap daftar setelah coba
              </li>
              <li>
                <Smartphone size={16} /> Tanpa instal aplikasi ekstra
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}

function OtpDemoPanel() {
  const [phase, setPhase] = useState<'compose' | 'verify' | 'success'>('compose');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const masked = useMemo(() => {
    const d = phone.replace(/\D/g, '');
    if (d.length < 4) return phone || '08xx';
    return `${d.slice(0, 4)}••••${d.slice(-3)}`;
  }, [phone]);

  useEffect(() => {
    if (phase !== 'verify' || seconds <= 0) return;
    const id = window.setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [phase, seconds]);

  function sendOtp(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError('');
    window.setTimeout(() => {
      setSending(false);
      setPhase('verify');
      setOtp(['', '', '', '', '', '']);
      setSeconds(30);
      window.setTimeout(() => refs.current[0]?.focus(), 40);
    }, 600);
  }

  function onDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }

  function verify(event: FormEvent) {
    event.preventDefault();
    if (otp.join('') !== DEMO_OTP) {
      setError(`Kode salah. Untuk demo gunakan ${DEMO_OTP}.`);
      return;
    }
    setPhase('success');
  }

  if (phase === 'success') {
    return (
      <>
        <div className="demo-success-badge">
          <Check size={22} strokeWidth={3} />
        </div>
        <h1>OTP terverifikasi</h1>
        <p>
          Demo OTP ke <strong>{masked}</strong> berhasil. Siap integrasikan ke login, checkout, atau
          verifikasi merchant Anda.
        </p>
        <div className="demo-done-actions">
          <Link className="auth-submit" href="/register/diorarepot">
            Daftar untuk pakai OTP asli <ArrowRight size={16} />
          </Link>
          <button type="button" className="linkish" onClick={() => setPhase('compose')}>
            Coba kirim OTP lagi
          </button>
        </div>
      </>
    );
  }

  if (phase === 'verify') {
    return (
      <>
        <h1>Masukkan OTP</h1>
        <p>
          Kode demo dikirim ke <strong>{masked}</strong>.
          <br />
          <span className="demo-otp-hint">
            Kode demo: <b>{DEMO_OTP}</b>
          </span>
        </p>
        <form className="auth-form" onSubmit={verify}>
          <div className="demo-otp-inputs" role="group" aria-label="Kode OTP">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  refs.current[index] = el;
                }}
                className="demo-otp-box"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => onDigit(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !otp[index] && index > 0) {
                    refs.current[index - 1]?.focus();
                  }
                }}
                aria-label={`Digit OTP ${index + 1}`}
              />
            ))}
          </div>
          {error && <p className="auth-note error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={otp.join('').length < 6}>
            Verifikasi OTP <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-switch">
          {seconds > 0 ? (
            <>Kirim ulang dalam 00:{String(seconds).padStart(2, '0')}</>
          ) : (
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setSeconds(30);
                setOtp(['', '', '', '', '', '']);
              }}
            >
              Kirim ulang OTP
            </button>
          )}
          {' · '}
          <button type="button" className="linkish" onClick={() => setPhase('compose')}>
            Ganti nomor
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <h1>OTP Demo</h1>
      <p>Uji layanan kirim OTP WhatsApp. Isi nomor tujuan, kirim kode, lalu verifikasi.</p>
      <form className="auth-form" onSubmit={sendOtp}>
        <label>
          Nomor WhatsApp tujuan
          <input
            required
            type="tel"
            placeholder="08xx xxxx xxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <button type="submit" className="auth-submit" disabled={sending}>
          {sending ? 'Mengirim OTP…' : 'Kirim OTP demo'} <ArrowRight size={16} />
        </button>
      </form>
    </>
  );
}

function WhatsAppBotPanel() {
  const [copied, setCopied] = useState(false);
  const presetMessage =
    'Halo Ora Repot, saya mau coba demo WhatsApp Bot AI Assistant.';

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(DEMO_BOT_DISPLAY);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <h1>WhatsApp Bot</h1>
      <p>
        Chat ke nomor bot demo untuk rasakan AI Assistant membalas seperti CS toko — langsung di
        WhatsApp Anda.
      </p>

      <div className="demo-wa-card">
        <div className="demo-wa-row">
          <span className="demo-wa-icon">
            <MessageCircle size={18} />
          </span>
          <div>
            <strong>Nomor bot demo</strong>
            <p>{DEMO_BOT_DISPLAY}</p>
          </div>
          <button type="button" className="demo-copy-btn" onClick={copyNumber} aria-label="Salin nomor">
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
        <p className="demo-wa-hint">
          Contoh chat: tanya stok, harga, atau ongkir. Bot akan membalas otomatis.
        </p>
      </div>

      <a
        className="auth-submit"
        href={waDemoLink(presetMessage)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Chat WhatsApp bot sekarang <ExternalLink size={15} />
      </a>

      <div className="demo-wa-steps">
        <p>
          <b>1.</b> Klik tombol di atas (atau simpan nomor bot).
        </p>
        <p>
          <b>2.</b> Kirim pesan di WhatsApp.
        </p>
        <p>
          <b>3.</b> Lihat balasan AI, lalu daftar jika cocok.
        </p>
      </div>
    </>
  );
}
