const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';

type GoogleCodeResponse = {
  code?: string;
  error?: string;
  error_description?: string;
};

type GoogleCodeClient = {
  requestCode: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: 'popup';
            callback: (response: GoogleCodeResponse) => void;
            error_callback?: (error: { type: string; message?: string }) => void;
          }) => GoogleCodeClient;
        };
      };
    };
  }
}

function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google script failed')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.googleGsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script failed'));
    document.head.appendChild(script);
  });
}

export function requestGoogleCode(): Promise<string> {
  if (!CLIENT_ID) {
    return Promise.reject(new Error('Google client ID is not set'));
  }
  return loadGoogleScript().then(
    () =>
      new Promise((resolve, reject) => {
        const oauth = window.google?.accounts?.oauth2;
        if (!oauth) {
          reject(new Error('Google script failed'));
          return;
        }
        const client = oauth.initCodeClient({
          client_id: CLIENT_ID,
          scope: 'openid email profile',
          ux_mode: 'popup',
          callback: (response) => {
            if (response.code) {
              resolve(response.code);
              return;
            }
            reject(new Error(response.error_description || response.error || 'Google sign-in failed'));
          },
          error_callback: (error) => {
            reject(new Error(error.message || 'Google sign-in cancelled'));
          },
        });
        client.requestCode();
      }),
  );
}
