import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MetaPartnerBanner } from '@/components/home/meta-partner-banner';
import { PricingSection } from '@/components/home/pricing-section';

export function PricingPage() {
  return (
    <main className="ora-page">
      <section className="pricing-page-hero">
        <div className="container">
          <span className="section-kicker">ORAREPOT Pricing</span>
          <h1>Harga paket Ora Repot</h1>
          <p>
            Pilih paket messaging WABA yang paling sesuai kebutuhan bisnis Anda. Tanpa biaya tersembunyi.
          </p>
          <Link className="button-primary" href="/demo/di/orarepot?minat=waba">
            Coba sekarang <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <PricingSection showIntro={false} />

      <MetaPartnerBanner />

      <section className="closing">
        <div className="container closing-inner">
          <div>
            <h2>Butuh bantuan memilih paket?</h2>
            <p>
              Tim Ora Repot siap bantu sesuaikan OTP, Broadcast, atau Full dengan kebutuhan merchant Anda.
            </p>
          </div>
          <Link className="button-primary" href="/demo/di/orarepot?minat=waba">
            Coba sekarang <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </main>
  );
}
