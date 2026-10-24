import { CheckCheck } from "lucide-react";

export function FocusBrand({ subtitle }: { subtitle?: string }) {
  return <div className="flex items-center gap-3">
    <span className="grid size-9 place-items-center rounded-[11px] bg-brand text-white shadow-[0_2px_4px_#0f6f5c15]"><CheckCheck size={21} strokeWidth={2.2} /></span>
    <div className="focus-brand">team<span className="-ml-2 font-normal text-ink-soft">standup</span></div>
    {subtitle && <span className="ml-2 hidden border-l border-line pl-4 text-[11px] text-ink-soft sm:inline">{subtitle}</span>}
  </div>;
}
