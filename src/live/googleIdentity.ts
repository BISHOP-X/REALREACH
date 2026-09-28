type TokenRequest = { provider: 'google'; token: string; nonce: string };

// One in-memory attempt per rendered button. Never persist credentials or nonces.
export async function createGoogleAttempt() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  const hashedNonce = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const createdAt = Date.now();
  let consumed = false;
  return {
    hashedNonce,
    async exchange<T>(credential: unknown, exchange: (request: TokenRequest) => Promise<T>): Promise<T> {
      if (consumed) throw new Error('This Google sign-in attempt was already used. Please try again.');
      if (Date.now() - createdAt > 10 * 60_000) throw new Error('Google sign-in expired. Please try again.');
      if (typeof credential !== 'string' || !credential) throw new Error('Google did not complete sign-in. Please try again.');
      consumed = true;
      // Supabase validates Google's signature, audience, expiry and hashed nonce.
      return exchange({ provider: 'google', token: credential, nonce });
    },
  };
}

export type GoogleIdentity = {
  initialize(options: {
    client_id: string; nonce: string; callback: (response: { credential?: string }) => void;
    ux_mode: 'popup'; auto_select: false; context: 'signin' | 'signup';
  }): void;
  renderButton(element: HTMLElement, options: {
    type: 'standard'; theme: 'outline'; size: 'large'; text: 'continue_with';
    shape: 'rectangular'; logo_alignment: 'left'; width: number;
    click_listener: () => void;
  }): void;
  disableAutoSelect(): void;
};

const getIdentity = () => (window as unknown as { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
let scriptPromise: Promise<GoogleIdentity> | null = null;

export function disableGoogleAutoSelect() { getIdentity()?.disableAutoSelect(); }

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const loaded = getIdentity();
  if (loaded) return Promise.resolve(loaded);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error('Google could not load. Check your connection or browser blocker, then retry. Email sign-in is still available.'));
    };
    const timer = window.setTimeout(fail, 15_000);
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      const identity = getIdentity();
      if (identity) resolve(identity); else fail();
    };
    document.head.appendChild(script);
  }).catch(error => { scriptPromise = null; throw error; });
  return scriptPromise;
}
