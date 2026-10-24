"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Inbox, Info, X } from "lucide-react";
import type { Accent, TaskStatus } from "@/lib/types";
import { statusMeta } from "@/lib/tasks";

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export const ACCENT_CLASSES: Record<Accent, { bg: string; text: string; ring: string }> = {
  teal: { bg: "bg-teal-100", text: "text-teal-800", ring: "ring-teal-200" },
  sky: { bg: "bg-sky-100", text: "text-sky-800", ring: "ring-sky-200" },
  violet: { bg: "bg-violet-100", text: "text-violet-800", ring: "ring-violet-200" },
  amber: { bg: "bg-amber-100", text: "text-amber-900", ring: "ring-amber-200" },
  rose: { bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-200" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-200" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-800", ring: "ring-indigo-200" },
  orange: { bg: "bg-orange-100", text: "text-orange-900", ring: "ring-orange-200" },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  name,
  accent = "teal",
  size = "md",
  className,
}: {
  name: string;
  accent?: Accent;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const palette = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.teal;
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ring-1",
        palette.bg,
        palette.text,
        palette.ring,
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "xs";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white border border-brand shadow-sm hover:bg-brand-dark hover:border-brand-dark disabled:bg-brand/50 disabled:border-transparent",
  secondary:
    "bg-white text-ink border border-line shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "bg-transparent text-ink-soft border border-transparent hover:bg-black/[0.04] hover:text-ink",
  danger: "bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 disabled:opacity-50",
  soft: "bg-brand-soft text-brand-dark border border-teal-200/70 hover:bg-teal-100",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: "h-7 px-2 gap-1 text-[12px] rounded-lg",
  sm: "h-9 px-3 gap-1.5 text-[13px] rounded-xl",
  md: "h-10 px-4 gap-2 text-sm rounded-xl",
};

export function Button({
  variant = "secondary",
  size = "sm",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors disabled:cursor-not-allowed",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("card", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: TaskStatus;
  size?: "sm" | "xs";
  className?: string;
}) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "xs" ? "px-1.5 py-0 text-[10px] leading-4" : "px-2 py-0.5 text-[11px] leading-5",
        meta.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-soft/80", className)}>{children}</p>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "brand" | "amber" | "rose" | "sky";
  icon?: ReactNode;
}) {
  const tones = {
    neutral: "bg-white border-line text-ink",
    brand: "bg-brand-soft border-teal-200/70 text-brand-dark",
    amber: "bg-amber-50 border-amber-200/70 text-amber-900",
    rose: "bg-rose-50 border-rose-200/70 text-rose-900",
    sky: "bg-sky-50 border-sky-200/70 text-sky-900",
  } as const;
  return (
    <div className={cn("rounded-xl border p-3 sm:p-3.5", tones[tone])}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70">{label}</p>
        {icon ? <span className="opacity-60">{icon}</span> : null}
      </div>
      <p className="mt-1 text-xl font-semibold leading-tight tabular-nums sm:text-2xl">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug opacity-70">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink shadow-[inset_0_1px_1px_rgba(18,32,27,0.03)] transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-400";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[11px] font-medium text-rose-600">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] leading-snug text-ink-soft/80">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-20 resize-y leading-relaxed", className)} {...props} />;
}

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7c6e' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(inputClass, "cursor-pointer appearance-none pr-8", className)}
      style={{
        backgroundImage: SELECT_CHEVRON,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.6rem center",
        backgroundSize: "15px",
        ...props.style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function ChipButton({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-brand bg-brand text-white shadow-sm"
          : "border-line bg-white text-ink-soft hover:border-slate-300 hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-8 text-center", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-ink-soft">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs leading-relaxed text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

const MODAL_SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof MODAL_SIZES;
  bodyClassName?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
    ) ?? []).filter(el => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      if (!panelRef.current?.contains(document.activeElement)) {
        const input = panelRef.current?.querySelector<HTMLElement>('input:not([readonly]), textarea, select');
        (input ?? focusables()[0] ?? panelRef.current)?.focus();
      }
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const targets = focusables();
      const first = targets[0]; const last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); panelRef.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px] animate-fade"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-white shadow-[0_24px_70px_rgba(16,33,29,0.22)] animate-rise sm:rounded-2xl",
          MODAL_SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-tight text-ink">{title}</h2>
            {description ? <div id={descriptionId} className="mt-0.5 text-xs leading-relaxed text-ink-soft">{description}</div> : null}
          </div>
          <Button variant="ghost" size="xs" onClick={onClose} aria-label="Tutup dialog" className="-mr-1 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-slate-50/70 px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{ notify: (message: string, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg animate-rise",
              item.tone === "success" && "border-teal-200 bg-white text-ink",
              item.tone === "error" && "border-rose-200 bg-rose-50 text-rose-900",
              item.tone === "info" && "border-sky-200 bg-white text-ink",
            )}
          >
            <span className="mt-0.5">
              {item.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
              ) : item.tone === "error" ? (
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              ) : (
                <Info className="h-4 w-4 text-sky-600" />
              )}
            </span>
            <p className="flex-1 leading-snug">{item.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return context;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // lanjut ke fallback
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  text,
  label = "Salin",
  copiedLabel = "Tersalin",
  variant = "primary",
  size = "sm",
  className,
  onCopied,
  disabled,
  icon = true,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onCopied?: () => void;
  disabled?: boolean;
  icon?: boolean;
}) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          onCopied?.();
          notify("Teks disalin. Tempel di WhatsApp grup tim.", "success");
        } else {
          notify("Gagal menyalin otomatis. Pilih teks pada pratinjau lalu salin manual.", "error");
        }
      }}
    >
      {icon ? copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" /> : null}
      {copied ? copiedLabel : label}
    </Button>
  );
}

export function PageLoading({ label = "Memuat data demo…" }: { label?: string }) {
  return (
    <div className="space-y-4">
      <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl border border-line bg-white" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-44 animate-pulse rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <p className="text-center text-xs text-ink-soft">{label}</p>
    </div>
  );
}
