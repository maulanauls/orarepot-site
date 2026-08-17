'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';
import { products } from '@/content/products';

const faqs = [
  [
    'Apa itu Ora Repot?',
    'Ora Repot adalah platform SaaS untuk merchant WhatsApp: AI Assistant, broadcast & OTP resmi (WABA), serta pembelian pulsa dan voucher digital.',
  ],
  [
    'Bagaimana AI Assistant membantu merchant?',
    'AI membantu menjawab chat, follow-up prospek, dan menjaga hubungan pelanggan agar tim tidak kewalahan.',
  ],
  [
    'Apakah broadcast menggunakan WABA resmi?',
    'Ya. Broadcast dan OTP berjalan lewat Official WABA dan WhatsApp Business API dari Meta.',
  ],
  [
    'Apakah bisa beli pulsa dan voucher di Ora Repot?',
    'Bisa. Selain tools SaaS, Ora Repot juga menyediakan pulsa, voucher game, dan produk digital lainnya.',
  ],
];

export function HomePage() {
  const [faqActive, setFaqActive] = useState<number | null>(0);

  return (
    <main className="ora-page">
      <section className="hero" id="top">
        <div className="hero-plane" />
        <div className="container hero-grid">
          <div className="hero-copy-block">
            <h1>
              AI Assistant untuk
              <em> merchant WhatsApp.</em>
            </h1>
            <p className="hero-copy">
              Bantu jaga hubungan pelanggan, kirim pesan resmi, dan urus kebutuhan digital — satu platform,
              tanpa ribet.
            </p>
            <div className="hero-actions">
              <Link className="button-primary" href="/demo/di/orarepot?minat=ai">
                Coba sekarang <ArrowRight size={16} />
              </Link>
              <Link className="button-ghost" href="#produk">
                Lihat semua produk
              </Link>
            </div>
          </div>
          <div className="chat-visual" aria-hidden="true">
            <div className="chat-stage">
              <div className="chat-phone">
                <div className="chat-status">
                  <img src="/logo-orarepot-icon.png" alt="" className="chat-avatar" />
                  <div>
                    <strong>Ora Repot AI</strong>
                    <span>online · bantu jualan</span>
                  </div>
                </div>
                <div className="chat-thread">
                  <div className="bubble in">Kak, stok hoodie cream size L masih ada?</div>
                  <div className="bubble out">
                    Ada, Kak. Size L ready. Mau saya buatkan invoice + ongkir?
                    <small>AI Assistant · otomatis</small>
                  </div>
                  <div className="bubble in">Boleh, kirim sekarang ya.</div>
                  <div className="bubble out typing">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
              <div className="chat-glow" />
            </div>
          </div>
        </div>
      </section>

      <section className="section products-section" id="produk">
        <div className="container">
          <div className="section-intro" id="solusi">
            <span className="section-kicker">Satu brand, tiga kekuatan</span>
            <h2 className="section-heading">Ora Repot menyatukan AI, messaging, dan digital goods.</h2>
            <p className="section-lead">
              Dari melayani pelanggan di WhatsApp, mengirim broadcast resmi, sampai beli pulsa dan voucher —
              semuanya dalam ekosistem yang sama.
            </p>
          </div>
          <div className="pillar-rail">
            {products.map((product) => {
              const Icon = product.icon;
              return (
                <article className="pillar" key={product.slug}>
                  <div className="pillar-meta">
                    <span className="pillar-icon">
                      <Icon size={20} />
                    </span>
                    <span className="pillar-label">{product.label}</span>
                  </div>
                  <h3>{product.title}</h3>
                  <p>{product.description}</p>
                  <Link className="pillar-link" href={product.href}>
                    Pelajari {product.label} <ArrowRight size={14} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section ai-section" id="ai">
        <div className="container split-grid">
          <div>
            <span className="section-kicker">Agentic AI CRM</span>
            <h2 className="section-heading">Asisten yang jaga customer relationship merchant.</h2>
            <p className="section-lead">
              Saat toko sibuk, AI Ora Repot membantu menjawab chat dan menjaga pelanggan tetap engaged.
            </p>
            <ul className="feature-lines">
              <li>
                <Sparkles size={16} /> Balas pertanyaan produk & stok lebih cepat
              </li>
              <li>
                <MessageSquareText size={16} /> Follow-up otomatis tanpa kehilangan nada ramah
              </li>
              <li>
                <Zap size={16} /> Bekerja di jalur WhatsApp yang sudah dipakai pelanggan
              </li>
            </ul>
            <Link className="button-primary dark" href="/demo/di/orarepot?minat=ai">
              Coba sekarang <ArrowRight size={16} />
            </Link>
          </div>
          <div className="ai-panel">
            <div className="ai-panel-head">Agentic workflow</div>
            <ol className="ai-steps">
              <li>
                <strong>Dengar</strong>
                <span>Chat masuk dari pelanggan WhatsApp</span>
              </li>
              <li>
                <strong>Pahami</strong>
                <span>AI mengenali intent: stok, harga, status order</span>
              </li>
              <li>
                <strong>Bertindak</strong>
                <span>Balas, tawarkan opsi, atau eskalasi ke manusia</span>
              </li>
              <li>
                <strong>Jaga hubungan</strong>
                <span>Follow-up relevan setelah pembelian</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section messaging-section" id="messaging">
        <div className="container">
          <div className="section-intro">
            <span className="section-kicker">WABA Messaging</span>
            <h2 className="section-heading">Broadcast & OTP lewat jalur resmi Meta.</h2>
          </div>
          <div className="messaging-split">
            <article className="msg-block">
              <ShieldCheck size={22} />
              <h3>Broadcast messaging</h3>
              <p>Sapa pelanggan dan pantau performa kampanye dari satu dashboard.</p>
            </article>
            <article className="msg-block accent">
              <ShieldCheck size={22} />
              <h3>OTP WhatsApp</h3>
              <p>Verifikasi login dan transaksi lewat kode resmi Meta.</p>
            </article>
          </div>
          <div className="section-cta">
            <Link className="button-primary dark" href="/di/orarepot/waba-messaging">
              Pelajari WABA Messaging <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section digital-section" id="digital">
        <div className="container split-grid reverse">
          <div className="digital-mosaic" aria-hidden="true">
            <div className="mosaic-item">
              <Smartphone size={22} />
              <strong>Pulsa & data</strong>
              <span>Isi saldo cepat</span>
            </div>
            <div className="mosaic-item lime">
              <Gamepad2 size={22} />
              <strong>Voucher game</strong>
              <span>Top-up favorit</span>
            </div>
            <div className="mosaic-item wide">
              <Ticket size={22} />
              <strong>Produk digital lain</strong>
              <span>Satu tempat, checkout sederhana</span>
            </div>
          </div>
          <div>
            <span className="section-kicker">Digital goods</span>
            <h2 className="section-heading">Pulsa, voucher game, dan kebutuhan digital lain.</h2>
            <p className="section-lead">
              Selain tools SaaS, Ora Repot juga jadi tempat beli produk digital sehari-hari.
            </p>
            <Link className="button-primary" href="/di/orarepot/pulsa-dan-voucher-game">
              Beli produk digital <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section faq-section" id="faq">
        <div className="container faq-layout">
          <div>
            <span className="section-kicker">FAQ</span>
            <h2 className="section-heading">Satu platform, banyak pertanyaan wajar.</h2>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer], i) => (
              <div className="faq-item" key={question}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setFaqActive(faqActive === i ? null : i)}
                >
                  <span>{question}</span>
                  {faqActive === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {faqActive === i && <div className="faq-answer">{answer}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="closing">
        <div className="container closing-inner">
          <div>
            <h2>Siap jualan WhatsApp tanpa ribet?</h2>
            <p>Mulai dari demo AI Assistant, messaging resmi, atau kebutuhan digital Anda hari ini.</p>
          </div>
          <Link className="button-primary" href="/demo/di/orarepot?minat=ai">
            Coba sekarang <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </main>
  );
}
