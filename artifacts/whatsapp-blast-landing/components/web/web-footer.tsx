import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const LINKS = {
  product: [
    { href: '/docs', label: 'Docs' },
    { href: '/docs/otp/send', label: 'OTP API' },
    { href: '/harga/di/orarepot', label: 'Pricing' },
  ],
  developers: [
    { href: '/docs/quickstart', label: 'Quickstart' },
    { href: '/docs/authentication', label: 'Authentication' },
    { href: '/docs/webhooks', label: 'Webhooks' },
    { href: 'https://api.orarepot.com', label: 'api.orarepot.com' },
  ],
  company: [
    { href: '/sign-in', label: 'Sign in' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/', label: 'Home' },
  ],
};

/**
 * Metronic SaaS landing footer (metronic-tailwind-nextjs-landings/saas).
 */
export function WebFooter() {
  return (
    <footer className="bg-background relative overflow-hidden">
      <div className="container px-6 mx-auto pt-14 pb-6 border-b border-border/50">
        <div className="flex flex-col lg:flex-row justify-between items-start">
          <div className="lg:w-1/3 mb-12 lg:mb-0">
            <Link href="/" className="flex items-center mb-3">
              <img
                src="/logo-orarepot.svg"
                alt="Ora Repot"
                className="h-8 w-auto max-w-[168px] object-contain object-left"
              />
            </Link>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
              WhatsApp OTP API for merchants. One bearer token, HMAC webhooks,
              deposit-backed send.
            </p>
          </div>

          <div className="w-full grow lg:w-2/3 flex justify-end">
            <div className="w-full lg:w-auto flex justify-between flex-wrap lg:grid lg:grid-cols-3 gap-8 lg:gap-16">
              {Object.entries(LINKS).map(([category, items]) => (
                <div key={category}>
                  <h3 className="font-medium text-base mb-4 capitalize text-muted-foreground/80">
                    {category}
                  </h3>
                  <ul className="text-sm space-y-2">
                    {items.map((item) => (
                      <li key={item.href}>
                        {item.href.startsWith('http') ? (
                          <a
                            href={item.href}
                            className="text-accent-foreground hover:text-primary transition-colors hover:underline"
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link
                            href={item.href}
                            className="text-accent-foreground hover:text-primary transition-colors hover:underline"
                          >
                            {item.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator className="my-6 bg-border/50" />

        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Ora Repot. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
