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
    path: '/',
  },
  {
    title: 'Quickstart',
    icon: Rocket,
    path: '/quickstart',
  },
  {
    title: 'Authentication',
    icon: KeyRound,
    path: '/authentication',
  },
  { heading: 'Sending & receiving' },
  {
    title: 'Send OTP',
    icon: Send,
    path: '/otp/send',
  },
  {
    title: 'Templates',
    icon: LayoutTemplate,
    path: '/guides/templates',
  },
  {
    title: 'Webhooks',
    icon: Webhook,
    path: '/webhooks',
  },
  {
    title: 'Errors',
    icon: AlertTriangle,
    path: '/errors',
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
    href: '/',
  },
  {
    title: 'Quickstart',
    desc: 'API key to first OTP in five minutes',
    href: '/quickstart',
  },
  {
    title: 'Authentication',
    desc: 'Bearer token, rotation, and host rules',
    href: '/authentication',
  },
  {
    title: 'Send OTP',
    desc: 'POST /v1/otp/send — body, response, Rp 600',
    href: '/otp/send',
  },
  {
    title: 'Templates',
    desc: 'AUTHENTICATION templates and {{1}} placeholder',
    href: '/guides/templates',
  },
  {
    title: 'Webhooks',
    desc: 'otp.sent, otp.failed, HMAC-SHA256',
    href: '/webhooks',
  },
  {
    title: 'Errors',
    desc: 'Stable error codes to branch on',
    href: '/errors',
  },
];
