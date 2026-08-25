export function isDocsPath(pathname: string) {
  return pathname === '/docs' || pathname.startsWith('/docs/');
}

export function layoutHomeHref(pathname: string) {
  if (isDocsPath(pathname)) return '/docs';
  if (pathname.startsWith('/admin')) return '/admin';
  return '/dashboard';
}
