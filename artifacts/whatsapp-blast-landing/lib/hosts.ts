/** Public hosts for dashboard copy and docs links. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.orarepot.com';

/** Same-origin Metronic docs. Override with NEXT_PUBLIC_DOCS_BASE_URL for docs.orarepot.com. */
export const DOCS_BASE_URL =
  process.env.NEXT_PUBLIC_DOCS_BASE_URL ?? '/docs';

export const OTP_SEND_PATH = '/v1/otp/send';
export const OTP_SEND_URL = `${API_BASE_URL}${OTP_SEND_PATH}`;
