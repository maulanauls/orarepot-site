'use client';

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader-inner">
        <span className="page-loader-ring" />
        <img
          src="/logo-orarepot-icon.svg"
          alt=""
          className="page-loader-logo"
        />
      </div>
      <p className="page-loader-text">ORAREPOT</p>
    </div>
  );
}
