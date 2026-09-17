export function Icon({
  name,
  size = 20,
  ...rest
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    analysis: (
      <>
        <path d="M4 20V10m8 10V4m8 16v-7" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />
      </>
    ),
    sales: (
      <>
        <path d="M4 17 10 11l4 3 6-9m-6 0h6v6" />
      </>
    ),
    complex: (
      <>
        <path d="m12 2 9 6-9 6-9-6 9-6Zm-9 11 9 6 9-6m-18 5 9 5 9-5" />
      </>
    ),
    meetings: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5" />
      </>
    ),
    handshake: (
      <>
        <path d="m11 17 2 2a1 1 0 1 0 3-3" />
        <path d="M11 4H3a1 1 0 0 0-1 1v8.172a2 2 0 0 0 .586 1.414L8.5 20.5a1 1 0 1 0 3-3" />
        <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.654.394a2 2 0 0 0 1.031.286H21a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1h-1" />
      </>
    ),
    process: (
      <>
        <path d="M3 12h4l3-7 4 14 3-7h4" />
      </>
    ),
    target: (
      <>
        <circle className="icon-target-ring" cx="12" cy="12" r="8" />
        <circle className="icon-target-core" cx="12" cy="12" r="3" />
        <path className="icon-target-crosshair" d="M12 2v4m0 12v4M2 12h4m12 0h4" />
      </>
    ),
    offer: (
      <>
        <circle className="icon-offer-person" cx="9" cy="8" r="3" />
        <path className="icon-offer-person" d="M3 20v-2a6 6 0 0 1 12 0v2" />
        <path className="icon-offer-spark" d="m18 3 .8 2.2L21 6l-2.2.8L18 9l-.8-2.2L15 6l2.2-.8Z" />
        <path className="icon-offer-spark" d="m20 13 .5 1.5L22 15l-1.5.5L20 17l-.5-1.5L18 15l1.5-.5Z" />
      </>
    ),
    appeals: (
      <>
        <path d="M21 11a8 8 0 0 1-8 8H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v4Z" />
        <path d="M7 8h10M7 12h7" />
      </>
    ),
    payroll: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 9h18m-5 5h2M7 2v3" />
      </>
    ),
    filter: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="currentColor" />
        <circle cx="15" cy="17" r="2" fill="currentColor" />
      </>
    ),
    arrow: <path d="M6 18 18 6M6 6h12v12" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m5 9 7 7 7-7" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.5" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    reset: (
      <>
        <path d="M3 10a9 9 0 1 1 1 8M3 4v6h6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name] || paths.info}
    </svg>
  );
}
