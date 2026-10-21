import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  type LucideIcon,
  RefreshCw,
  X,
} from "lucide-react";
import { formatMoney } from "./marketplace.types";

export function PageIntro(
  { eyebrow, title, description, actions }: {
    eyebrow: string;
    title: string;
    description?: string;
    actions?: ReactNode;
  },
) {
  return (
    <header className="studio-intro">
      <div>
        <span className="studio-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="studio-intro-actions">{actions}</div>}
    </header>
  );
}
export function Surface(
  { title, description, children, className = "" }: {
    title?: string;
    description?: string;
    children: ReactNode;
    className?: string;
  },
) {
  return (
    <section className={`studio-surface ${className}`}>
      {title && (
        <header className="studio-surface-heading">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`studio-status status-${status.replaceAll("_", "-")}`}>
      <i />
      {status.replaceAll("_", " ")}
    </span>
  );
}
export function Money({ value }: { value: number }) {
  return <span className="studio-money">{formatMoney(value)}</span>;
}
export function EmptyPanel(
  { icon: Icon, title, description, children }: {
    icon: LucideIcon;
    title: string;
    description: string;
    children?: ReactNode;
  },
) {
  return (
    <div className="studio-empty">
      <span className="studio-empty-icon">
        <Icon size={27} strokeWidth={1.5} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children && <div className="studio-empty-actions">{children}</div>}
    </div>
  );
}
export function AsyncState(
  { loading, error, onRetry, children }: {
    loading: boolean;
    error: string;
    onRetry: () => unknown;
    children: ReactNode;
  },
) {
  if (loading) {
    return (
      <div
        className="studio-skeleton"
        role="status"
        aria-label="Loading your workspace"
      >
        <div />
        <div />
        <div />
        <span className="r-sr">Loading your workspace…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="studio-error" role="alert">
        <CircleAlert size={24} />
        <div>
          <strong>Let’s try that again.</strong>
          <p>{error}</p>
          <button
            className="studio-button secondary"
            onClick={() => void onRetry()}
          >
            <RefreshCw size={16} /> Reload
          </button>
        </div>
      </div>
    );
  }
  return children;
}
export function SubmitButton(
  { busy, children, className = "", ...props }:
    & ButtonHTMLAttributes<HTMLButtonElement>
    & { busy?: boolean },
) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`studio-button ${className}`}
      aria-busy={busy || undefined}
    >
      {children}
      {busy
        ? <LoaderCircle className="studio-spin" size={18} />
        : <ArrowRight size={18} />}
    </button>
  );
}
export function Feedback(
  { error, message }: { error?: string; message?: string },
) {
  if (!error && !message) return null;
  return (
    <div
      className={`studio-feedback ${error ? "error" : "success"}`}
      role={error ? "alert" : "status"}
    >
      {error ? <CircleAlert size={19} /> : <Check size={19} />}
      <span>{error || message}</span>
    </div>
  );
}
export function Modal(
  { open, onClose, title, description, children }: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
  },
) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className="studio-modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom
          ) onClose();
        }
      }}
    >
      <button
        className="studio-close"
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
      >
        <X size={21} />
      </button>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </dialog>
  );
}
