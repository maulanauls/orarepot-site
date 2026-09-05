import {
  BarChart3,
  Bot,
  CircleHelp,
  CreditCard,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquare,
  Radio,
  Settings,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { MenuConfig } from '@/config/types';
import { DOCS_BASE_URL } from '@/lib/hosts';

export const MENU_SIDEBAR: MenuConfig = [
  {
    title: 'Overview',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    title: 'AI Assistant',
    icon: Bot,
    path: '/dashboard/ai',
  },
  {
    title: 'Broadcast',
    icon: Radio,
    path: '/dashboard/broadcast',
  },
  {
    title: 'Analytics',
    icon: BarChart3,
    path: '/dashboard/analytics',
  },
  { heading: 'OTP' },
  {
    title: 'OTP Overview',
    icon: ShieldCheck,
    path: '/dashboard/otp',
  },
  {
    title: 'Kirim OTP',
    icon: MessageSquare,
    path: '/dashboard/otp/kirim',
  },
  {
    title: 'OTP Logs',
    icon: FileText,
    path: '/dashboard/otp/logs',
  },
  {
    title: 'Template OTP',
    icon: LayoutTemplate,
    path: '/dashboard/otp/templates',
  },
  {
    title: 'OTP Settings',
    icon: Settings,
    path: '/dashboard/otp/settings',
  },
  { heading: 'Account' },
  {
    title: 'Members',
    icon: Users,
    path: '/dashboard/members',
  },
  {
    title: 'Billing',
    icon: CreditCard,
    path: '/dashboard/billing',
  },
  {
    title: 'Settings',
    icon: Settings2,
    path: '/dashboard/settings',
  },
  { heading: 'Developers' },
  {
    title: 'Dokumentasi',
    icon: CircleHelp,
    path: DOCS_BASE_URL,
  },
];

export const MENU_SIDEBAR_ADMIN: MenuConfig = [
  { heading: 'Admin' },
  {
    title: 'Admin Overview',
    icon: LayoutDashboard,
    path: '/admin',
  },
  {
    title: 'Users',
    icon: Users,
    path: '/admin/users',
  },
  {
    title: 'Subscriptions',
    icon: CreditCard,
    path: '/admin/subscriptions',
  },
  {
    title: 'OTP Global',
    icon: ShieldCheck,
    path: '/admin/otp',
  },
  {
    title: 'Settings',
    icon: Settings2,
    path: '/admin/settings',
  },
];

/** Mega menu placeholders (layout-1 still imports these) */
export const MENU_MEGA: MenuConfig = [];
export const MENU_MEGA_MOBILE: MenuConfig = [];
export const MENU_ROOT: MenuConfig = [];
