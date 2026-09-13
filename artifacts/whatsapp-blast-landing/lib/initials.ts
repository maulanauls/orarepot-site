export function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const STOCK_AVATAR = '/media/avatars/300-2.png';

export function isStockAvatar(url?: string | null) {
  if (!url?.trim()) return true;
  return url.includes(STOCK_AVATAR) || url.endsWith('300-2.png');
}

const TONES = [
  'bg-emerald-600',
  'bg-sky-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-teal-700',
  'bg-indigo-600',
] as const;

export function avatarToneClass(name: string) {
  let hash = 0;
  for (const ch of name.trim() || '?') {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return TONES[hash % TONES.length];
}
