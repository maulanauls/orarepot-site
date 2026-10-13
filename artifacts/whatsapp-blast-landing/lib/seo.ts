import type { Metadata } from 'next';

export const SITE_URL = 'https://orarepot.com';
export const SITE_NAME = 'Ora Repot';
const SHARE_IMAGE = '/logo-orarepot-icon.png';

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  const branded = `${input.title} | ORAREPOT`;
  return {
    title: path === '/' ? { absolute: branded } : input.title,
    description: input.description,
    alternates: { canonical: path },
    openGraph: {
      title: branded,
      description: input.description,
      url,
      type: 'website',
      images: [{ url: SHARE_IMAGE, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary',
      title: branded,
      description: input.description,
      images: [SHARE_IMAGE],
    },
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}${SHARE_IMAGE}`,
    description:
      'WhatsApp OTP API, broadcast WhatsApp Business API, AI assistant, serta pulsa dan voucher digital.',
  };
}

export function serviceJsonLd(input: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    description: input.description,
    url: `${SITE_URL}${input.path}`,
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    areaServed: 'ID',
  };
}
