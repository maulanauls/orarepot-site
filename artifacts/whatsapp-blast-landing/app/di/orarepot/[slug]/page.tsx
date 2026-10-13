import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct, products, type ProductSlug } from '@/content/products';
import { ProductPage } from '@/components/product/product-page';
import { pageMetadata, serviceJsonLd } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: 'Produk' };
  return pageMetadata({
    title: product.seoTitle,
    description: product.seoDescription,
    path: `/di/orarepot/${product.slug}`,
  });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const jsonLd = serviceJsonLd({
    name: product.seoTitle,
    description: product.seoDescription,
    path: `/di/orarepot/${product.slug}`,
  });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductPage slug={product.slug as ProductSlug} />
    </>
  );
}
