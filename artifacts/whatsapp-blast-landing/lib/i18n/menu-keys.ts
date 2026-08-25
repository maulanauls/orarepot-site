import { DOCS_BASE_URL } from '@/lib/hosts';

/** Map menu path / heading → i18n key under `menu.*` */
export const MENU_I18N: Record<string, string> = {
  '/dashboard': 'menu.overview',
  '/dashboard/whatsapp': 'menu.whatsapp',
  '/dashboard/ai': 'menu.ai',
  '/dashboard/broadcast': 'menu.broadcast',
  '/dashboard/analytics': 'menu.analytics',
  OTP: 'menu.otpHeading',
  '/dashboard/otp': 'menu.otpOverview',
  '/dashboard/otp/kirim': 'menu.otpSend',
  '/dashboard/otp/logs': 'menu.otpLogs',
  '/dashboard/otp/templates': 'menu.otpTemplates',
  '/dashboard/otp/settings': 'menu.otpSettings',
  '/dashboard/otp/verifikasi': 'menu.otpVerify',
  Account: 'menu.accountHeading',
  '/dashboard/members': 'menu.members',
  '/dashboard/billing': 'menu.billing',
  '/dashboard/settings': 'menu.settings',
  Developers: 'menu.developersHeading',
  [DOCS_BASE_URL]: 'menu.docs',
  docs: 'menu.docs',
  Admin: 'menu.adminHeading',
  '/admin': 'menu.adminOverview',
  '/admin/users': 'menu.adminUsers',
  '/admin/subscriptions': 'menu.adminSubscriptions',
  '/admin/otp': 'menu.adminOtp',
  '/admin/settings': 'menu.adminSettings',
};

export const PAGE_SUBTITLE: Record<string, string> = {
  '/dashboard': 'page.overview',
  '/dashboard/whatsapp': 'page.whatsapp',
  '/dashboard/ai': 'page.ai',
  '/dashboard/broadcast': 'page.broadcast',
  '/dashboard/analytics': 'page.analytics',
  '/dashboard/otp': 'page.otpOverview',
  '/dashboard/otp/kirim': 'page.otpSend',
  '/dashboard/otp/logs': 'page.otpLogs',
  '/dashboard/otp/templates': 'page.otpTemplates',
  '/dashboard/otp/settings': 'page.otpSettings',
  '/dashboard/otp/verifikasi': 'page.otpVerify',
  '/dashboard/members': 'page.members',
  '/dashboard/billing': 'page.billing',
  '/dashboard/settings': 'page.settings',
  '/admin': 'page.adminOverview',
  '/admin/users': 'page.adminUsers',
  '/admin/subscriptions': 'page.adminSubscriptions',
  '/admin/otp': 'page.adminOtp',
  '/admin/settings': 'page.adminSettings',
};

export function menuTitleKey(pathOrHeading?: string) {
  if (!pathOrHeading) return undefined;
  return MENU_I18N[pathOrHeading];
}
