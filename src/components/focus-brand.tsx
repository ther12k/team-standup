export function FocusBrand({ subtitle }: { subtitle?: string }) {
  return <div className="flex items-center gap-3">
    <img src="/assets/teamstandup/brand/logo-horizontal.svg" alt="Team Standup" className="h-9 w-auto" />
    {subtitle && <span className="ml-1 hidden border-l border-line pl-4 text-[11px] text-ink-soft sm:inline">{subtitle}</span>}
  </div>;
}
