'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

const userNav: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/ai', label: 'AI Assistant', icon: Bot },
      { href: '/dashboard/broadcast', label: 'Broadcast', icon: Radio },
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'OTP',
    items: [
      { href: '/dashboard/otp', label: 'OTP Overview', icon: ShieldCheck },
      { href: '/dashboard/otp/kirim', label: 'Kirim OTP', icon: MessageSquare },
      { href: '/dashboard/otp/logs', label: 'OTP Logs', icon: FileText },
      { href: '/dashboard/otp/settings', label: 'OTP Settings', icon: Settings },
    ],
  },
  {
    items: [
      { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const adminNav: NavGroup[] = [
  {
    title: 'Admin',
    items: [
      { href: '/admin', label: 'Admin Overview', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { href: '/admin/otp', label: 'OTP Global', icon: ShieldCheck },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href;
}

export function DashboardSidebar({
  mode = 'user',
}: {
  mode?: 'user' | 'admin';
}) {
  const pathname = usePathname();
  const groups = mode === 'admin' ? adminNav : userNav;

  return (
    <aside className="mt-sidebar">
      <div className="mt-sidebar-header">
        <Link href="/" className="mt-sidebar-logo">
          <img src="/logo-orarepot.svg" alt="Ora Repot" className="mt-logo-full" />
          <img src="/logo-orarepot-icon.svg" alt="" className="mt-logo-mini" />
        </Link>
      </div>

      <div className="mt-sidebar-scroll">
        <nav className="mt-menu" aria-label="Dashboard">
          {groups.map((group, gi) => (
            <div key={gi} className="mt-menu-group">
              {group.title && <div className="mt-menu-label">{group.title}</div>}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn('mt-menu-item', active && 'active')}
                  >
                    <Icon className="mt-menu-icon" size={16} />
                    <span className="mt-menu-title">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-sidebar-footer">
        {mode === 'user' ? (
          <Link href="/admin" className="mt-menu-item">
            <Users className="mt-menu-icon" size={16} />
            <span className="mt-menu-title">Admin panel</span>
          </Link>
        ) : (
          <Link href="/dashboard" className="mt-menu-item">
            <LayoutDashboard className="mt-menu-icon" size={16} />
            <span className="mt-menu-title">User dashboard</span>
          </Link>
        )}
        <Link href="/sign-in" className="mt-menu-item danger">
          <LogOut className="mt-menu-icon" size={16} />
          <span className="mt-menu-title">Keluar</span>
        </Link>
      </div>
    </aside>
  );
}
