'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';

type Cell = boolean | string;

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  desc: string;
  popular?: boolean;
};

type FeatureGroup = {
  title: string;
  rows: { label: string; values: [Cell, Cell, Cell] }[];
};

const plans: Plan[] = [
  {
    id: 'otp',
    name: 'OTP',
    price: '50.000',
    period: 'Per akun / bulan',
    desc: 'Paket dasar untuk verifikasi pelanggan lewat jalur resmi Meta.',
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    price: '150.000',
    period: 'Per akun / bulan',
    desc: 'Paket lengkap untuk kampanye WhatsApp yang mendukung efisiensi bisnis.',
    popular: true,
  },
  {
    id: 'full',
    name: 'Full',
    price: '175.000',
    period: 'Per akun / bulan',
    desc: 'Paket unggulan yang menggabungkan broadcast dan OTP dalam satu langganan.',
  },
];

const featureGroups: FeatureGroup[] = [
  {
    title: 'WhatsApp Business',
    rows: [
      { label: 'Official WABA Meta', values: [true, true, true] },
      { label: 'WhatsApp Business API', values: [true, true, true] },
      { label: 'Anti-banned lebih aman', values: [true, true, true] },
      { label: 'Dashboard akun', values: [true, true, true] },
    ],
  },
  {
    title: 'Messaging',
    rows: [
      { label: 'Broadcast kampanye', values: [false, true, true] },
      { label: 'Unlimited broadcast*', values: [false, true, true] },
      { label: 'OTP verifikasi resmi', values: [true, false, true] },
      { label: 'Laporan terkirim & terbaca', values: ['Dasar', 'Lengkap', 'Lengkap'] },
    ],
  },
  {
    title: 'Operasional',
    rows: [
      { label: 'Bantuan setup awal', values: [true, true, true] },
      { label: 'Integrasi aplikasi', values: [true, 'Opsional', true] },
      { label: 'Template pesan', values: ['Terbatas', 'Tidak terbatas', 'Tidak terbatas'] },
      { label: 'Multi-kampanye', values: [false, true, true] },
    ],
  },
  {
    title: 'Dukungan',
    rows: [
      { label: 'Live chat & WhatsApp support', values: [true, true, true] },
      { label: 'Onboarding dibantu tim', values: [false, true, true] },
      { label: 'Account manager', values: [false, false, true] },
      { label: 'Prioritas respon', values: ['Standar', 'Prioritas', 'Prioritas tinggi'] },
    ],
  },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="moka-check" aria-label="Termasuk">
        <Check size={18} strokeWidth={3} />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="moka-empty" aria-label="Tidak termasuk">
        <Minus size={16} />
      </span>
    );
  }
  return <span className="moka-text">{value}</span>;
}

export function PricingSection({ showIntro = true }: { showIntro?: boolean }) {
  return (
    <section className="section pricing-section moka-pricing" id="harga">
      <div className="container">
        {showIntro && (
          <div className="moka-pricing-intro">
            <span className="section-kicker">Harga messaging</span>
            <h2 className="section-heading">Harga paket Ora Repot</h2>
            <p className="section-lead">
              Pilih paket yang paling sesuai kebutuhan bisnis. Tanpa biaya tersembunyi.
            </p>
          </div>
        )}

        <div className="moka-plan-cards">
          <div className="moka-plan-spacer" aria-hidden="true">
            <h3>Fitur</h3>
            <p>Bandingkan paket messaging WABA secara detail.</p>
          </div>
          {plans.map((plan) => (
            <article key={plan.id} className={`moka-plan-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && <span className="moka-popular">Popular</span>}
              <h3>{plan.name}</h3>
              <div className="moka-price">
                <sup>Rp</sup>
                {plan.price}
              </div>
              <span className="moka-period">{plan.period}</span>
              <p>{plan.desc}</p>
              <Link href="/demo/di/orarepot?minat=waba" className="moka-cta">
                Coba sekarang
              </Link>
            </article>
          ))}
        </div>

        <div className="moka-table-wrap">
          <table className="moka-table">
            <thead>
              <tr>
                <th scope="col">Fitur</th>
                {plans.map((plan) => (
                  <th key={plan.id} scope="col" className={plan.popular ? 'popular-col' : undefined}>
                    <span className="moka-th-name">{plan.name}</span>
                    <span className="moka-th-price">Rp{plan.price}</span>
                    <Link href="/demo/di/orarepot?minat=waba" className="moka-cta compact">
                      Coba sekarang
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureGroups.map((group) => (
                <Fragment key={group.title}>
                  <tr className="moka-group-row">
                    <th scope="rowgroup" colSpan={4}>
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row, rowIndex) => (
                    <tr
                      key={`${group.title}-${row.label}`}
                      className={rowIndex % 2 === 1 ? 'moka-alt' : undefined}
                    >
                      <th scope="row">{row.label}</th>
                      {row.values.map((value, index) => (
                        <td
                          key={`${row.label}-${plans[index].id}`}
                          className={plans[index].popular ? 'popular-col' : undefined}
                        >
                          <CellValue value={value} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="pricing-foot">
          Semua paket termasuk bantuan setup awal.
          <span className="pricing-disclaimer">
            *Pengiriman mengikuti kebijakan Meta; tidak ada jaminan bebas banned 100% untuk semua kondisi.
          </span>
        </p>
      </div>
    </section>
  );
}
