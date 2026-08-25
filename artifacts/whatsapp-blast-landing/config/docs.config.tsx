import {
  AlertTriangle,
  BookOpen,
  KeyRound,
  LayoutTemplate,
  Rocket,
  Send,
  Webhook,
} from 'lucide-react';
import { MenuConfig } from '@/config/types';

export const MENU_DOCS: MenuConfig = [
  { heading: 'Getting Started' },
  {
    title: 'Overview',
    icon: BookOpen,
    path: '/docs',
  },
  {
    title: 'Quickstart',
    icon: Rocket,
    path: '/docs/quickstart',
  },
  {
    title: 'Authentication',
    icon: KeyRound,
    path: '/docs/authentication',
  },
  { heading: 'Sending & receiving' },
  {
    title: 'Send OTP',
    icon: Send,
    path: '/docs/otp/send',
  },
  {
    title: 'Templates',
    icon: LayoutTemplate,
    path: '/docs/guides/templates',
  },
  {
    title: 'Webhooks',
    icon: Webhook,
    path: '/docs/webhooks',
  },
  {
    title: 'Errors',
    icon: AlertTriangle,
    path: '/docs/errors',
  },
];

export const DOCS_SEARCH: {
  title: string;
  desc: string;
  href: string;
}[] = [
  {
    title: 'Overview',
    desc: 'Why Ora Repot and how the OTP API fits',
    href: '/docs',
  },
  {
    title: 'Quickstart',
    desc: 'API key to first OTP in five minutes',
    href: '/docs/quickstart',
  },
  {
    title: 'Authentication',
    desc: 'Bearer token, rotation, and host rules',
    href: '/docs/authentication',
  },
  {
    title: 'Send OTP',
    desc: 'POST /v1/otp/send — body, response, Rp 600',
    href: '/docs/otp/send',
  },
  {
    title: 'Templates',
    desc: 'AUTHENTICATION templates and {{1}} placeholder',
    href: '/docs/guides/templates',
  },
  {
    title: 'Webhooks',
    desc: 'otp.sent, otp.failed, HMAC-SHA256',
    href: '/docs/webhooks',
  },
  {
    title: 'Errors',
    desc: 'Stable error codes to branch on',
    href: '/docs/errors',
  },
];
