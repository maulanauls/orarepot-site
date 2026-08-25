import { APP_URL } from '@/lib/hosts';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer mt-auto">
      <div className="container-fluid">
        <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-3 py-5">
          <div className="flex order-2 md:order-1 gap-2 font-normal text-sm">
            <span className="text-muted-foreground">{currentYear} &copy;</span>
            <a href={APP_URL} className="text-secondary-foreground hover:text-primary">
              Ora Repot
            </a>
          </div>
          <nav className="flex order-1 md:order-2 gap-4 font-normal text-sm text-muted-foreground">
            <a href={`${APP_URL}/products`} className="hover:text-primary">
              Produk
            </a>
            <a href={`${APP_URL}/harga/di/orarepot`} className="hover:text-primary">
              Harga
            </a>
            <a href={`${APP_URL}/sign-in`} className="hover:text-primary">
              Masuk
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
