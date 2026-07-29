import * as React from 'react';

type P = React.SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: P): React.SVGProps<SVGSVGElement> {
  const { size: _omit, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...rest,
  };
}

export const LinkIcon = (p: P) => (
  <svg {...base(p.size ?? 18, p)}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export const CopyIcon = (p: P) => (
  <svg {...base(p.size ?? 15, p)}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base(p.size ?? 15, p)} strokeWidth={2}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base(p.size ?? 16, p)}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const FilterIcon = (p: P) => (
  <svg {...base(p.size ?? 14, p)}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const ChevronDown = (p: P) => (
  <svg {...base(p.size ?? 15, p)}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ChevronLeft = (p: P) => (
  <svg {...base(p.size ?? 14, p)} strokeWidth={2}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base(p.size ?? 15, p)} strokeWidth={2}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const TrendUp = (p: P) => (
  <svg {...base(p.size ?? 13, p)} strokeWidth={2}>
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

export const LogoutIcon = (p: P) => (
  <svg {...base(p.size ?? 15, p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const Spinner = (p: P) => (
  <svg {...base(p.size ?? 16, p)} strokeWidth={2.5} style={{ animation: 'spin 800ms linear infinite', ...(p.style ?? {}) }}>
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
  </svg>
);

// Toggle switch, knob on the right = "on" (link active).
export const ToggleOn = (p: P) => (
  <svg {...base(p.size ?? 18, p)}>
    <rect x="1" y="5" width="22" height="14" rx="7" />
    <circle cx="16" cy="12" r="3" fill="currentColor" />
  </svg>
);

// Toggle switch, knob on the left = "off" (link deactivated).
export const ToggleOff = (p: P) => (
  <svg {...base(p.size ?? 18, p)}>
    <rect x="1" y="5" width="22" height="14" rx="7" />
    <circle cx="8" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const TrashIcon = (p: P) => (
  <svg {...base(p.size ?? 15, p)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
    />
    <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4-3.1z" />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77z"
    />
  </svg>
);
