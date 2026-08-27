import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { MetaPartnerBanner } from '@/components/home/meta-partner-banner';
import { getProduct, type ProductSlug } from '@/content/products';

export function ProductPage({ slug }: { slug: ProductSlug }) {
  const product = getProduct(slug);

  if (!product) return null;

  const Icon = product.icon;
  const interest =
    product.slug === 'agentic-ai' ? 'ai' : product.slug === 'waba-messaging' ? 'waba' : 'digital';

  return (
    <main className="ora-page product-page">
      <section className="product-hero">
        <div className="container product-hero-grid">
          <div>
            <span className="section-kicker">{product.label}</span>
            <h1>{product.title}</h1>
            <p>{product.description}</p>
            <div className="hero-actions">
              <Link className="button-primary" href={`/demo/di/orarepot?minat=${interest}`}>
                {product.cta} <ArrowRight size={16} />
              </Link>
              <Link className="button-ghost" href="/#produk">
                Semua produk
              </Link>
            </div>
          </div>
          <div className="product-hero-panel">
            <span className="product-hero-icon">
              <Icon size={28} />
            </span>
            <ul>
              {product.highlights.map((item) => (
                <li key={item}>
                  <Check size={16} strokeWidth={3} /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container benefit-grid">
          {product.benefits.map((benefit) => (
            <article key={benefit.title} className="benefit-card">
              <h2>{benefit.title}</h2>
              <p>{benefit.body}</p>
            </article>
          ))}
        </div>
      </section>

      {product.slug === 'waba-messaging' && <MetaPartnerBanner />}

      <section className="closing">
        <div className="container closing-inner">
          <div>
            <h2>Siap mencoba {product.label}?</h2>
            <p>Isi form singkat. Tim Ora Repot akan bantu langkah berikutnya.</p>
          </div>
          <Link className="button-primary" href={`/demo/di/orarepot?minat=${interest}`}>
            Coba sekarang <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </main>
  );
}
