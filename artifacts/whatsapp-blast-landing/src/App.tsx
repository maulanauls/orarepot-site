import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowRight, BarChart3, Check, ChevronDown, ChevronUp, CircleCheck, Clock3, FileCheck2, LayoutDashboard, LockKeyhole, Menu, MessageCircle, MousePointer2, Send, ShieldCheck, Users, X, Zap } from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type Billing = 'monthly' | 'quarterly';
type Plan = 'broadcast' | 'otp' | 'full';

const plans = [
  {
    id: 'broadcast' as Plan, name: 'Paket Broadcast', desc: 'Untuk bisnis yang rutin menyapa banyak pelanggan.',
    monthly: '150.000', quarterly: '350.000', compare: 'Rp 450.000 / 3 bulan',
    features: ['Meta Official API', 'Unlimited broadcast', 'Anti Banned', 'Dashboard'],
  },
  {
    id: 'otp' as Plan, name: 'Paket OTP', desc: 'Verifikasi pelanggan aman dengan jalur resmi Meta.',
    monthly: '50.000', quarterly: '250.000', compare: 'Rp 300.000 / 3 bulan',
    features: ['Meta Official API', 'Dashboard', 'OTP resmi untuk verifikasi', 'Alur verifikasi terpercaya'],
  },
  {
    id: 'full' as Plan, name: 'Paket Full', desc: 'Satu paket lengkap untuk tumbuh lebih cepat.',
    monthly: '175.000', quarterly: '225.000', compare: 'Rp 525.000 / 3 bulan',
    features: ['Meta Official API', 'Dashboard', 'Unlimited broadcast', 'Anti Banned'],
  },
];

const faqs = [
  ['Apa itu Blastly?', 'Blastly adalah platform WhatsApp untuk broadcast yang lebih tertata dan OTP resmi Meta untuk menjaga proses verifikasi pelanggan tetap aman.'],
  ['Apakah broadcast Blastly anti banned?', 'Blastly memakai jalur resmi Meta dan membantu bisnis mengirim pesan dengan praktik yang lebih aman. Hindari konten spam dan kirim hanya ke pelanggan yang memang memberikan izin.'],
  ['Apa bedanya paket Broadcast dan Full?', 'Paket Broadcast berfokus pada kebutuhan kampanye pesan. Paket Full menggabungkan broadcast, OTP, dashboard, dan perlindungan operasional dalam satu langganan.'],
  ['Berapa lama proses mulai?', 'Setelah mengisi kontak, tim kami akan menghubungi Anda untuk membantu menyiapkan akun dan kebutuhan bisnis.'],
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Brand() {
  return <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); scrollTo('top'); }} data-testid="link-brand">
    <span className="brand-mark"><MessageCircle size={17} strokeWidth={2.8} /></span><span>blastly</span>
  </a>;
}

function Navbar({ onContact }: { onContact: (plan?: Plan) => void }) {
  const [open, setOpen] = useState(false);
  const go = (id: string) => { setOpen(false); scrollTo(id); };
  return <header className="topbar">
    <div className="container topbar-inner">
      <Brand />
      <nav className="nav-links" aria-label="Navigasi utama">
        <a href="#solusi" onClick={(e) => { e.preventDefault(); go('solusi'); }} data-testid="link-solusi">Solusi</a>
        <a href="#cara-kerja" onClick={(e) => { e.preventDefault(); go('cara-kerja'); }} data-testid="link-cara-kerja">Cara kerja</a>
        <a href="#harga" onClick={(e) => { e.preventDefault(); go('harga'); }} data-testid="link-harga">Harga</a>
        <a href="#faq" onClick={(e) => { e.preventDefault(); go('faq'); }} data-testid="link-faq">FAQ</a>
      </nav>
      <div className="nav-actions">
        <button className="nav-login" onClick={() => onContact()} data-testid="button-login">Masuk</button>
        <button className="nav-cta" onClick={() => onContact()} data-testid="button-nav-contact">Coba Blastly <ArrowRight size={14} /></button>
      </div>
      <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Buka menu" data-testid="button-mobile-menu">{open ? <X /> : <Menu />}</button>
    </div>
    {open && <nav className="mobile-nav" aria-label="Navigasi mobile">
      <a href="#solusi" onClick={(e) => { e.preventDefault(); go('solusi'); }} data-testid="mobile-link-solusi">Solusi</a>
      <a href="#cara-kerja" onClick={(e) => { e.preventDefault(); go('cara-kerja'); }} data-testid="mobile-link-cara-kerja">Cara kerja</a>
      <a href="#harga" onClick={(e) => { e.preventDefault(); go('harga'); }} data-testid="mobile-link-harga">Harga</a>
      <a href="#faq" onClick={(e) => { e.preventDefault(); go('faq'); }} data-testid="mobile-link-faq">FAQ</a>
      <button className="nav-cta" onClick={() => { setOpen(false); onContact(); }} data-testid="button-mobile-contact">Coba Blastly <ArrowRight size={14} /></button>
    </nav>}
  </header>;
}

function DashboardVisual() {
  return <div className="dashboard-wrap" data-testid="visual-dashboard">
    <div className="dashboard">
      <div className="dash-top"><div className="window-dots"><i /><i /><i /></div><div className="dash-user"><span>Halo, Rani</span><span className="user-avatar">R</span></div></div>
      <div className="dash-body">
        <aside className="dash-side"><p className="side-label">BLASTLY</p><div className="side-item active"><LayoutDashboard /> Ringkasan</div><div className="side-item"><Send /> Broadcast</div><div className="side-item"><Users /> Kontak</div><div className="side-item"><FileCheck2 /> OTP</div></aside>
        <main className="dash-main"><div className="dash-main-head"><div><h3>Ringkasan kampanye</h3><p>Performa pesan minggu ini</p></div><button className="dash-button" data-testid="button-dashboard-create">+ Kampanye</button></div>
          <div className="dash-stats"><div className="stat-card"><span className="stat-label">Pesan terkirim</span><strong className="stat-value">12.480</strong></div><div className="stat-card"><span className="stat-label">Terbaca</span><strong className="stat-value green">96,8%</strong></div><div className="stat-card"><span className="stat-label">Sukses OTP</span><strong className="stat-value">98,4%</strong></div></div>
          <div className="chart-card"><div className="chart-head"><span>Aktivitas broadcast</span><span>+24,6% minggu ini</span></div><div className="chart"><i className="bar" /><i className="bar" /><i className="bar" /><i className="bar" /><i className="bar" /><i className="bar" /><i className="bar" /></div><div className="chart-days"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span></div></div>
        </main>
      </div>
    </div>
    <div className="float-tag"><Zap size={16} fill="currentColor" /><div><strong>96,8%</strong><span>pesan terbaca</span></div></div>
  </div>;
}

function Hero({ onContact }: { onContact: (plan?: Plan) => void }) {
  return <section className="hero" id="top">
    <Navbar onContact={onContact} />
    <div className="container hero-grid">
      <div className="reveal"><span className="eyebrow"><i className="eyebrow-dot" /> Infrastruktur pesan bisnis</span><h1>Ngobrol lebih banyak.<br /><em>Takutnya lebih sedikit.</em></h1><p className="hero-copy">Blastly membantu bisnis Indonesia mengirim broadcast WhatsApp dengan jalur yang lebih aman — sekaligus menyediakan OTP resmi Meta untuk verifikasi pelanggan.</p><div className="hero-actions"><button className="button-primary" onClick={() => onContact()} data-testid="button-hero-contact">Mulai dari sini <ArrowRight size={16} /></button><a className="button-ghost" href="#cara-kerja" onClick={(e) => { e.preventDefault(); scrollTo('cara-kerja'); }} data-testid="link-hero-how"><MousePointer2 size={15} /> Lihat cara kerja</a></div><p className="hero-note"><ShieldCheck size={15} /> Jalur resmi Meta · Dashboard mudah dipakai · Dukungan manusia</p></div>
      <div className="reveal"><DashboardVisual /></div>
    </div>
  </section>;
}

function TrustStrip() {
  return <div className="trust-strip"><div className="container trust-row"><span className="trust-kicker">Dipercaya untuk komunikasi yang berarti</span><div className="trust-logos"><span><ShieldCheck size={14} /> Meta Official</span><span><LockKeyhole size={14} /> Secure OTP</span><span><BarChart3 size={14} /> Real-time dashboard</span></div></div></div>;
}

function ValueSection() {
  return <section className="section value-section" id="solusi"><div className="container"><div className="value-head reveal"><div><span className="section-kicker">Kenapa Blastly</span><h2 className="section-heading">Pesan terkirim.<br />Reputasi tetap terjaga.</h2></div><p className="section-lead">Broadcast yang baik bukan soal seberapa banyak dikirim, tapi seberapa siap bisnis Anda untuk dipercaya.</p></div><div className="value-grid">
    <article className="value-card reveal"><span className="value-number">01</span><span className="value-icon"><ShieldCheck size={20} /></span><h3>Lebih aman, bukan asal kirim</h3><p>Bangun ritme komunikasi yang lebih sehat dengan jalur resmi Meta dan kontrol yang jelas di setiap kampanye.</p></article>
    <article className="value-card reveal"><span className="value-number">02</span><span className="value-icon"><Zap size={20} /></span><h3>Siap menjangkau banyak orang</h3><p>Unlimited broadcast untuk promo, pengumuman, dan follow-up tanpa spreadsheet yang berantakan.</p></article>
    <article className="value-card reveal"><span className="value-number">03</span><span className="value-icon"><LayoutDashboard size={20} /></span><h3>Satu dashboard, semua terlihat</h3><p>Performa kampanye, kontak, dan OTP berada di satu tempat yang mudah dipahami tim.</p></article>
  </div></div></section>;
}

function ProofSection() {
  return <section className="section proof-section" id="cara-kerja"><div className="container split-grid"><div className="proof-art reveal"><span className="art-label">Kampanye yang terasa personal</span><h3>Pesan tepat waktu, masuk dengan cara yang tepat.</h3><div className="message-stack"><div className="message">Hai, Kak Dita. Koleksi baru kami sudah hadir.<small>Blastly · 09.42</small></div><div className="message sent">Wah, boleh lihat katalognya?<small>Dita · 09.43 · ✓✓</small></div><div className="message">Tentu. Ini link khusus untuk Kak Dita.<small>Blastly · 09.43</small></div></div></div><div className="reveal"><span className="section-kicker">Cara kerja</span><h2 className="section-heading">Dari daftar kontak<br />menjadi percakapan.</h2><ul className="proof-list"><li><i className="check"><Check size={13} strokeWidth={3} /></i><div><strong>Siapkan audiens</strong><span>Impor kontak dan kelompokkan sesuai kebutuhan kampanye Anda.</span></div></li><li><i className="check"><Check size={13} strokeWidth={3} /></i><div><strong>Tulis dengan niat baik</strong><span>Buat template yang jelas, relevan, dan nyaman dibaca pelanggan.</span></div></li><li><i className="check"><Check size={13} strokeWidth={3} /></i><div><strong>Kirim lalu pelajari</strong><span>Pantau performa di dashboard dan gunakan insight untuk langkah berikutnya.</span></div></li></ul></div></div></section>;
}

function OtpSection() {
  return <section className="section otp-section"><div className="container split-grid"><div className="otp-copy reveal"><span className="section-kicker">OTP resmi Meta</span><h2 className="section-heading">Verifikasi cepat membangun rasa aman.</h2><p className="section-lead">Jangan biarkan proses masuk yang rumit membuat pelanggan pergi. Gunakan OTP resmi Meta dengan biaya yang tetap masuk akal.</p><div className="otp-points"><div className="otp-point"><LockKeyhole size={19} /><strong>Aman untuk pelanggan</strong><span>Kode verifikasi dikirim melalui jalur resmi.</span></div><div className="otp-point"><Clock3 size={19} /><strong>Terasa instan</strong><span>Alur masuk yang singkat meningkatkan konversi.</span></div></div></div><div className="otp-panel reveal"><span className="panel-tag">Meta Official API</span><div className="phone"><div className="phone-screen"><div className="phone-notch" /><div className="phone-body"><span className="phone-brand">blastly / verify</span><h4>Masukkan kode</h4><p>Kami sudah mengirim 6 digit kode ke WhatsApp Anda.</p><div className="otp-code"><b>8</b><b>2</b><b>4</b><b>1</b><b>0</b><b>7</b></div><span className="phone-link">Kirim ulang kode dalam 00:24</span></div></div></div><span className="panel-tag bottom"><CircleCheck size={13} /> Terverifikasi</span></div></div></section>;
}

function Pricing({ billing, setBilling, onContact }: { billing: Billing; setBilling: (b: Billing) => void; onContact: (plan?: Plan) => void }) {
  return <section className="section pricing-section" id="harga"><div className="container"><div className="pricing-header reveal"><div><span className="section-kicker">Harga yang transparan</span><h2 className="section-heading">Pilih ritme yang<br />pas untuk bisnis.</h2></div><div className="billing-switch" role="tablist"><button className={billing === 'monthly' ? 'active' : ''} onClick={() => setBilling('monthly')} data-testid="button-billing-monthly">Bulanan</button><button className={billing === 'quarterly' ? 'active' : ''} onClick={() => setBilling('quarterly')} data-testid="button-billing-quarterly">3 Bulan <span className="save-pill">hemat</span></button></div></div><div className="pricing-grid">{plans.map((plan, i) => <article className={`price-card reveal ${i === 1 ? 'featured' : ''}`} key={plan.id}>{i === 1 && <span className="popular-badge">Paling dipilih</span>}<h3 className="plan-name">{plan.name}</h3><p className="plan-desc">{plan.desc}</p><div className="price"><sup>Rp</sup>{billing === 'monthly' ? plan.monthly : plan.quarterly}</div><span className="price-period">{billing === 'monthly' ? '/ bulan' : '/ 3 bulan'}</span><span className="price-compare">{billing === 'quarterly' ? plan.compare : 'Tanpa biaya tersembunyi'}</span><button className="plan-cta" onClick={() => onContact(plan.id)} data-testid={`button-plan-${plan.id}`}>Pilih paket ini <ArrowRight size={14} /></button><span className="features-title">Termasuk di dalamnya</span><ul className="feature-list">{plan.features.map((feature) => <li key={feature}><Check size={14} strokeWidth={3} /> {feature}</li>)}</ul></article>)}</div><p className="pricing-foot">Semua paket sudah termasuk bantuan setup awal. Tidak ada kontrak panjang.</p></div></section>;
}

function Testimonials() {
  return <section className="section testimonials-section"><div className="container"><span className="section-kicker">Cerita dari lapangan</span><h2 className="section-heading">Bisnis yang sibuk<br />butuh alat yang tenang.</h2><div className="quote-grid"><article className="quote-card reveal"><span className="quote-mark">“</span><p>Blastly bikin tim kami berani kirim promo tanpa deg-degan. Semua ada laporannya, dan pelanggan tetap merasa diajak ngobrol.</p><div className="quote-person"><span className="person-avatar">NA</span><div className="person"><strong>Nadia Arum</strong><span>Pemilik, Nara Beauty</span></div></div></article><article className="quote-card small reveal"><span className="quote-mark">“</span><p>Setup-nya jelas. Tim kami langsung paham cara baca hasil kampanye.</p><div className="quote-person"><span className="person-avatar">RF</span><div className="person"><strong>Rafi F.</strong><span>Growth lead</span></div></div></article><article className="quote-card small reveal"><span className="quote-mark">“</span><p>OTP resmi bikin proses checkout kami terasa jauh lebih profesional.</p><div className="quote-person"><span className="person-avatar">DS</span><div className="person"><strong>Dewi S.</strong><span>Founder, Karsa</span></div></div></article></div></div></section>;
}

function Faq() {
  const [active, setActive] = useState<number | null>(0);
  return <section className="section faq-section" id="faq"><div className="container faq-layout"><div className="reveal"><span className="section-kicker">Pertanyaan umum</span><h2 className="section-heading">Masih ingin<br />memastikan?</h2><p className="faq-intro">Pertanyaan yang paling sering kami terima dari bisnis yang sedang menata ulang komunikasi WhatsApp-nya.</p></div><div className="faq-list reveal">{faqs.map(([question, answer], i) => <div className="faq-item" key={question}><button className="faq-question" onClick={() => setActive(active === i ? null : i)} aria-expanded={active === i} data-testid={`button-faq-${i}`}><span>{question}</span>{active === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{active === i && <div className="faq-answer" data-testid={`text-faq-answer-${i}`}>{answer}</div>}</div>)}</div></div></section>;
}

function ContactModal({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const selected = plans.find((item) => item.id === plan);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-title"><button className="modal-close" onClick={onClose} aria-label="Tutup" data-testid="button-close-modal"><X size={16} /></button>{sent ? <div className="form-success"><span className="success-icon"><Check size={25} strokeWidth={3} /></span><h3>Terima kasih, ya.</h3><p>Data Anda sudah kami terima. Tim Blastly akan segera menghubungi untuk membantu langkah berikutnya.</p><button className="form-submit" onClick={onClose} data-testid="button-success-close">Selesai</button></div> : <><h2 id="contact-title">Mari mulai ngobrol.</h2><p className="modal-intro">Isi detail singkat ini. Kami akan bantu rekomendasikan langkah paling tepat{selected ? ` untuk ${selected.name}` : ''}.</p><form className="contact-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}><label className="form-label">Nama Anda<input required className="form-input" placeholder="Contoh: Sinta dari Kopi Karsa" data-testid="input-contact-name" /></label><label className="form-label">Nomor WhatsApp<input required type="tel" className="form-input" placeholder="08xx xxxx xxxx" data-testid="input-contact-phone" /></label><label className="form-label">Nama bisnis<input required className="form-input" placeholder="Nama bisnis Anda" data-testid="input-contact-business" /></label><button className="form-submit" type="submit" data-testid="button-submit-contact">Kirim dan konsultasi gratis <ArrowRight size={15} /></button></form></>}</div></div>;
}

function Home() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [contactPlan, setContactPlan] = useState<Plan | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const openContact = (plan?: Plan) => { setContactPlan(plan); setModalOpen(true); };
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('visible'); }), { threshold: .11 });
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return <main className="blastly-page"><Hero onContact={openContact} /><TrustStrip /><ValueSection /><ProofSection /><OtpSection /><Pricing billing={billing} setBilling={setBilling} onContact={openContact} /><Testimonials /><Faq /><section className="closing"><div className="container closing-inner"><div><h2>Siap mengirim pesan dengan lebih yakin?</h2><p>Mulai dengan paket yang paling masuk akal untuk bisnis Anda.</p></div><button className="button-primary" onClick={() => openContact()} data-testid="button-closing-contact">Coba Blastly sekarang <ArrowRight size={17} /></button></div></section><footer className="footer"><div className="container footer-inner"><Brand /><span className="footer-copy">© 2024 Blastly. Dibuat untuk bisnis Indonesia.</span><div className="footer-links"><a href="#harga" onClick={(e) => { e.preventDefault(); scrollTo('harga'); }} data-testid="footer-link-harga">Harga</a><a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('faq'); }} data-testid="footer-link-faq">FAQ</a><a href="#top" onClick={(e) => { e.preventDefault(); scrollTo('top'); }} data-testid="footer-link-top">Kembali ke atas ↑</a></div></div></footer>{modalOpen && <ContactModal plan={contactPlan} onClose={() => setModalOpen(false)} />}</main>;
}

function Router() {
  return <ErrorBoundary resetKey={useLocation()[0]}><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;