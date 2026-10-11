const STEPS = [
  {
    n: '01',
    title: 'Aplikasi memanggil API',
    body: 'Saat pengguna login, daftar, atau membayar, sistem kamu mengirim nomor tujuan, nama template, dan kode 4–8 digit.',
  },
  {
    n: '02',
    title: 'Template resmi Meta',
    body: 'Kode tidak dikirim sebagai chat biasa. Pesannya memakai template OTP yang sudah disetujui di WhatsApp Business API.',
  },
  {
    n: '03',
    title: 'Sampai di WhatsApp',
    body: 'Pelanggan menerima kode di percakapan WhatsApp, lengkap dengan tombol salin, tanpa perlu membuka SMS.',
  },
  {
    n: '04',
    title: 'Status kembali ke kamu',
    body: 'API membalas terkirim atau gagal. Riwayatnya juga tercatat di dashboard, dan webhook memberi tahu aplikasi kamu.',
  },
];

const USES = [
  {
    title: 'Login akun',
    body: 'Konfirmasi identitas sebelum pengguna masuk ke akun atau data sensitif.',
  },
  {
    title: 'Pendaftaran baru',
    body: 'Pastikan nomor WhatsApp yang didaftarkan benar-benar milik pengguna itu.',
  },
  {
    title: 'Reset kata sandi',
    body: 'Kirim kode yang kedaluwarsa sebelum mengizinkan penggantian sandi.',
  },
  {
    title: 'Otorisasi pembayaran',
    body: 'Minta kode sekali pakai sebelum transaksi bernilai tinggi diproses.',
  },
];

export function WabaOtpSection() {
  return (
    <section className="otp-section" aria-labelledby="otp-heading">
      <div className="container">
        <div className="otp-layout">
          <div>
            <span className="section-kicker">WhatsApp OTP API</span>
            <h2 id="otp-heading" className="section-heading">
              Kode verifikasi dikirim lewat WhatsApp, dari satu panggilan API
            </h2>
            <p className="section-lead">
              Aplikasi kamu yang membuat kodenya. Ora Repot yang mengantarkan kode itu lewat
              Official WhatsApp Business API, lalu mengembalikan status pengirimannya.
            </p>
            <ol className="otp-steps">
              {STEPS.map((step) => (
                <li key={step.n}>
                  <span>{step.n}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <figure className="otp-phone" aria-label="Contoh pesan OTP di WhatsApp">
            <div className="otp-phone-bar">
              <span className="otp-phone-dot" />
              <strong>Ora Repot</strong>
              <em>WhatsApp</em>
            </div>
            <div className="otp-phone-thread">
              <div className="otp-bubble">
                <p className="otp-bubble-label">Kode verifikasi</p>
                <p className="otp-code">482 913</p>
                <p>
                  Pakai kode ini untuk masuk ke akun kamu. Jangan bagikan kode ini kepada siapa pun.
                </p>
                <p className="otp-meta">Berlaku 5 menit</p>
              </div>
              <div className="otp-copy">Salin kode</div>
            </div>
            <figcaption>Contoh pesan template OTP yang diterima pelanggan.</figcaption>
          </figure>
        </div>

        <div className="otp-uses">
          {USES.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <ul className="otp-facts">
          <li>Jalur resmi WhatsApp Business API, bukan gateway tidak resmi.</li>
          <li>Kode dibuat oleh aplikasi kamu, 4 sampai 8 digit.</li>
          <li>Template bisa bahasa Indonesia atau Inggris.</li>
          <li>Status terkirim atau gagal kembali lewat API dan webhook.</li>
        </ul>
      </div>
    </section>
  );
}
