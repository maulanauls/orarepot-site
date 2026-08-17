'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { products } from '@/content/products';

export function Footer() {
  const pathname = usePathname();
  if (
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/demo')
  ) {
    return null;
  }

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span className="footer-copy">
          © {new Date().getFullYear()} Ora Repot. AI · Messaging · Digital goods.
        </span>
        <div className="footer-links">
          {products.map((product) => (
            <Link key={product.slug} href={product.href}>
              {product.label}
            </Link>
          ))}
          <Link href="/sign-in">Masuk</Link>
        </div>
      </div>
    </footer>
  );
}
