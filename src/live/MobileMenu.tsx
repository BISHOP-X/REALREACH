import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react';
import { Logo } from './Brand';
import './mobile-menu.css';

export function MobileMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const panel = dialog.current;
    if (!panel || !open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.showModal();
    panel.querySelector<HTMLButtonElement>('.rr-menu-close')?.focus();
    const desktop = window.matchMedia('(min-width: 801px)');
    const closeOnDesktop = () => { if (desktop.matches) panel.close(); };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
      panel.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => { setOpen(false); dialog.current?.close(); };
  return <>
    <button type="button" className="menu-button" aria-label="Open menu"
      aria-haspopup="dialog" aria-controls="rr-mobile-menu" aria-expanded={open}
      onClick={() => setOpen(true)}><Menu size={22}/></button>
    <dialog ref={dialog} id="rr-mobile-menu" className="rr-mobile-panel"
      aria-label="Main menu" onClose={() => setOpen(false)}
      onCancel={event => { event.preventDefault(); close(); }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const links = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button');
        const first = links[0], last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <div className="rr-menu-header">
        <div onClick={close}><Logo/></div>
        <button type="button" className="rr-menu-close" aria-label="Close menu" onClick={close}><X size={23}/></button>
      </div>
      <div className="rr-menu-body">
        <span className="rr-menu-eyebrow">MAKE YOUR NEXT MOVE</span>
        <nav aria-label="Mobile navigation" className="rr-menu-links">
          <a href="#how" onClick={close}><span>How it works</span><ArrowUpRight size={23}/></a>
          <a href="#businesses" onClick={close}><span>For businesses</span><ArrowUpRight size={23}/></a>
          <a href="#workers" onClick={close}><span>I want to earn</span><ArrowUpRight size={23}/></a>
          <Link to="/help" onClick={close}><span>Help & support</span><ArrowUpRight size={23}/></Link>
        </nav>
        <div className="rr-menu-actions">
          <Link to="/signup" onClick={close} className="rr-menu-primary">Get started <ArrowRight size={20}/></Link>
          <Link to="/login" onClick={close} className="rr-menu-login">Already a member? <strong>Log in <ArrowRight size={16}/></strong></Link>
        </div>
        <div className="rr-menu-foot"><span>REAL PEOPLE. REAL REACH.</span><div><Link to="/privacy" onClick={close}>Privacy</Link><Link to="/terms" onClick={close}>Terms</Link></div></div>
      </div>
    </dialog>
  </>;
}
