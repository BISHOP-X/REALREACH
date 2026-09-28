import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authCapabilities, configured, db, friendlyError } from './client';
import { createGoogleAttempt, loadGoogleIdentity } from './googleIdentity';

const clientId = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env.VITE_GOOGLE_CLIENT_ID ?? '';

export function GoogleSignIn({ mode, front, disabled, onBusy }: {
  mode: 'login' | 'signup'; front: string; disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef({ front, disabled, onBusy });
  latest.current = { front, disabled, onBusy };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let alive = true;
    let exchanging = false;
    let observer: ResizeObserver | undefined;
    setReady(false);
    setError('');
    setStatus('');
    void (async () => {
      if (!configured || !clientId.endsWith('.apps.googleusercontent.com')) {
        throw new Error('Google sign-in is not configured on this deployment. Please use email.');
      }
      const [identity, attempt, capabilities] = await Promise.all([
        loadGoogleIdentity(), createGoogleAttempt(), authCapabilities(),
      ]);
      if (!alive) return;
      if (!capabilities.google) throw new Error('Google sign-in is temporarily unavailable. Please use email or retry.');
      identity.initialize({
        client_id: clientId, nonce: attempt.hashedNonce,
        ux_mode: 'popup', auto_select: false, context: mode === 'signup' ? 'signup' : 'signin',
        callback: response => {
          if (!alive || exchanging || latest.current.disabled) return;
          exchanging = true;
          latest.current.onBusy(true);
          setStatus('Securing your RealReach session…');
          void (async () => {
            try {
              // Preserve the existing onboarding hint; this is never an authorization role.
              if (mode === 'signup') sessionStorage.setItem('rr-onboarding-front', latest.current.front);
              const { data, error } = await attempt.exchange(response.credential, request => db().auth.signInWithIdToken(request));
              if (error) throw error;
              if (!data.session) throw new Error('Google sign-in did not create a session. Please retry.');
              if (alive) navigate('/account', { replace: true });
            } catch (error) {
              if (alive) {
                setError(friendlyError(error));
                setStatus('');
                setReady(false);
                element.replaceChildren();
              }
            } finally {
              if (alive) latest.current.onBusy(false);
            }
          })();
        },
      });
      let lastWidth = 0;
      const render = () => {
        if (!alive || exchanging) return;
        const width = Math.min(400, Math.floor(element.getBoundingClientRect().width));
        if (width < 1 || width === lastWidth) return;
        lastWidth = width;
        element.replaceChildren();
        identity.renderButton(element, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
          shape: 'rectangular', logo_alignment: 'left', width,
          // GIS popup cancellation doesn't provide a reliable callback. Do not lock
          // the form while it is open; closing it leaves both sign-in methods usable.
          click_listener: () => {
            if (alive) setStatus('Finish in the Google window. Closed it? You can try again or use email.');
          },
        });
      };
      render();
      observer = new ResizeObserver(render);
      observer.observe(element);
      setReady(true);
    })().catch(error => { if (alive) setError(friendlyError(error)); });
    return () => { alive = false; observer?.disconnect(); element.replaceChildren(); };
  }, [mode, navigate, revision]);

  return <div className="r-google-area">
    <div ref={container} className="r-google-official" inert={disabled || !ready} aria-label="Google sign-in" />
    {!ready && !error && <p className="r-google-status" role="status">Loading secure Google sign-in…</p>}
    {error && <div className="r-notice is-error" role="alert">{error}<button className="r-text-button" type="button" disabled={disabled} onClick={() => setRevision(value => value + 1)}>Retry Google sign-in</button></div>}
    {status && <p className="r-google-status" role="status">{status}</p>}
  </div>;
}
