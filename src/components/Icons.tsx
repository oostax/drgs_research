type IconProps = { className?: string }

export function PulseIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22"/><path d="M11 25h7l3-9 6 17 4-10 3 2h4"/></svg>
}

export function FilterIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6"/><circle cx="14" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>
}

export function UploadIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 40 40" aria-hidden="true"><path className="upload-arrow" d="M20 27V9m0 0-7 7m7-7 7 7"/><path d="M8 28v3h24v-3"/></svg>
}

export function TrendIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M5 23l7-7 5 5 10-11"/><path d="M20 10h7v7"/></svg>
}

export function SearchIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
}

export function ProductIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="6" width="9" height="9" rx="2"/><rect className="icon-accent" x="18" y="6" width="9" height="9" rx="2"/><rect x="5" y="19" width="9" height="8" rx="2"/><rect x="18" y="19" width="9" height="8" rx="2"/></svg>
}

export function ComplexDealIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M7 11h18v15H7z"/><path d="M12 11V8c0-1.7 1.3-3 3-3h2c1.7 0 3 1.3 3 3v3"/><path className="icon-accent" d="M12 18h8M16 14v8"/></svg>
}

export function FormatIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><circle cx="8" cy="16" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="24" cy="24" r="3"/><path className="icon-accent" d="M11 16h4c4 0 3-8 6-8M11 16h4c4 0 3 8 6 8"/></svg>
}

export function StageIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M5 25h7v-6h7v-6h8"/><path className="icon-accent" d="m22 8 5 5-5 5"/></svg>
}

export function TriggerIcon({ className = '' }: IconProps) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M18 3 8 18h8l-2 11 10-16h-8z"/><circle className="icon-accent" cx="24" cy="7" r="3"/></svg>
}
