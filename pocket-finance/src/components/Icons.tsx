import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 24, p: P) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p })

export const SearchIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </svg>
)
export const StarIcon = ({ size = 26, filled = false, ...p }: P & { filled?: boolean }) => (
  <svg {...base(size, p)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8z" />
  </svg>
)
export const ChevronDown = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
export const CloseIcon = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const ArrowUp = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
)
export const ArrowDown = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)
export const GripIcon = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M5 8h14M5 12h14M5 16h14" />
  </svg>
)
export const PencilIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
)
export const ShareIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
    <path d="M7 11H5v10h14V11h-2" />
  </svg>
)
export const CalcIcon = ({ size = 28, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.7}>
    <rect x="4.5" y="2.5" width="15" height="19" rx="2.5" />
    <rect x="7.5" y="5.5" width="9" height="4" rx="0.8" fill="currentColor" stroke="none" opacity="0.9" />
    {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={7.3 + c * 3.3} y={11.6 + r * 3.1} width="2.1" height="2" rx="0.4" fill="currentColor" stroke="none" />))}
  </svg>
)
export const SigmaIcon = ({ size = 28, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M18 4H6l7 8-7 8h12" />
  </svg>
)
export const BookmarkIcon = ({ size = 28, filled = false, ...p }: P & { filled?: boolean }) => (
  <svg {...base(size, p)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M6.5 3h11v18l-5.5-4.2L6.5 21V3z" />
  </svg>
)
export const AZIcon = ({ size = 28, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.6}>
    <text x="12" y="10" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Rubik, sans-serif">A</text>
    <path d="M6 12.4h12" />
    <text x="12" y="21.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Rubik, sans-serif">Z</text>
  </svg>
)
export const CheckIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)
