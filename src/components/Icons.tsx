interface IconProps {
  className?: string
}

function iconProps(className?: string) {
  return {
    className: className ? `icon ${className}` : 'icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </svg>
  )
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 15.5V4.5" />
      <path d="m7.5 9 4.5-4.5L16.5 9" />
      <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4.5 17 4.3-4.2a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 0 2.8 0l2.9-2.8" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="m5 12.5 4.5 4.5L19 6.5" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7" />
      <path d="M10 11v5.5M14 11v5.5" />
    </svg>
  )
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M5 19.5h14" />
    </svg>
  )
}

export function CompareIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <rect x="3" y="6" width="7" height="12" rx="2" />
      <rect x="14" y="6" width="7" height="12" rx="2" />
      <path d="M12 4v16" />
    </svg>
  )
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M20 7v5h-5" />
      <path d="M19.1 16a8 8 0 1 1 .9-6.8L20 12" />
    </svg>
  )
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 4 3.5 19h17L12 4Z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.5" r=".4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r=".4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 12h16" />
      <path d="m14.5 6.5 5.5 5.5-5.5 5.5" />
    </svg>
  )
}

export function SparkIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 3.5c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" />
      <path d="M19 15.5c.2 1.7.8 2.3 2.5 2.5-1.7.2-2.3.8-2.5 2.5-.2-1.7-.8-2.3-2.5-2.5 1.7-.2 2.3-.8 2.5-2.5Z" />
    </svg>
  )
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 3.5 19 6v5.4c0 4.4-2.9 7.7-7 9.1-4.1-1.4-7-4.7-7-9.1V6l7-2.5Z" />
      <path d="m9 11.8 2 2 4-4" />
    </svg>
  )
}

export function LogoMark({ className }: IconProps) {
  return (
    <svg
      className={className ? `logo-mark ${className}` : 'logo-mark'}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="15" fill="currentColor" />
      <rect
        x="11"
        y="12"
        width="26"
        height="23"
        rx="6"
        fill="#FFF9EE"
      />
      <path
        d="M12 30.5l7.2-7.4a2.6 2.6 0 0 1 3.7 0l4.1 4.2 2.6-2.5a2.6 2.6 0 0 1 3.6 0l3.8 3.8"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="18.2" cy="19.2" r="2.3" fill="currentColor" />
    </svg>
  )
}
