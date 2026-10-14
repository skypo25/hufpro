import type { BodyMapAnimal, BodyMapView } from '@/lib/modules/bodyMapTemplates'

type Props = {
  animal: BodyMapAnimal
  view: BodyMapView
  className?: string
}

/** Einfache austauschbare Platzhalter — keine anatomischen Regionen. */
export default function BodyMapPlaceholderSvg({ animal, view, className }: Props) {
  const label =
    animal === 'horse' ? 'Pferd' : animal === 'dog' ? 'Hund' : 'Katze'
  const viewLabel =
    view === 'left' ? 'Links' : view === 'right' ? 'Rechts' : view === 'front' ? 'Vorne' : 'Hinten'

  const fill = animal === 'horse' ? '#C4B5A0' : animal === 'dog' ? '#B8C4CE' : '#D4C4B0'
  const stroke = '#5B5248'

  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      role="img"
      aria-label={`${label} Platzhalter ${viewLabel}`}
    >
      <rect width="400" height="300" fill="#F8F7F4" />
      <text x="12" y="22" fontSize="12" fill="#9CA3AF" fontFamily="system-ui,sans-serif">
        Platzhalter · {label} · {viewLabel}
      </text>

      {animal === 'horse' ? (
        view === 'front' || view === 'back' ? (
          <>
            <ellipse cx="200" cy="90" rx="36" ry="42" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="170" y="120" width="60" height="100" rx="12" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="175" y="215" width="18" height="50" rx="4" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="207" y="215" width="18" height="50" rx="4" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        ) : (
          <g transform={view === 'right' ? 'translate(400,0) scale(-1,1)' : undefined}>
            <ellipse cx="280" cy="95" rx="40" ry="32" fill={fill} stroke={stroke} strokeWidth="2" />
            <ellipse cx="180" cy="140" rx="90" ry="50" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="120" y="175" width="16" height="70" rx="4" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="155" y="180" width="16" height="65" rx="4" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="200" y="180" width="16" height="65" rx="4" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="235" y="175" width="16" height="70" rx="4" fill={fill} stroke={stroke} strokeWidth="2" />
            <path d="M100 140 Q70 120 60 150" fill="none" stroke={stroke} strokeWidth="3" />
          </g>
        )
      ) : animal === 'dog' ? (
        view === 'front' || view === 'back' ? (
          <>
            <circle cx="200" cy="100" r="34" fill={fill} stroke={stroke} strokeWidth="2" />
            <ellipse cx="200" cy="175" rx="45" ry="55" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="175" y="220" width="14" height="40" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="211" y="220" width="14" height="40" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
          </>
        ) : (
          <g transform={view === 'right' ? 'translate(400,0) scale(-1,1)' : undefined}>
            <circle cx="270" cy="120" r="28" fill={fill} stroke={stroke} strokeWidth="2" />
            <ellipse cx="180" cy="150" rx="70" ry="40" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="130" y="180" width="12" height="50" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="160" y="185" width="12" height="45" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="200" y="185" width="12" height="45" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
            <rect x="230" y="180" width="12" height="50" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
            <path d="M110 150 Q90 140 85 165" fill="none" stroke={stroke} strokeWidth="3" />
          </g>
        )
      ) : view === 'front' || view === 'back' ? (
        <>
          <circle cx="200" cy="95" r="30" fill={fill} stroke={stroke} strokeWidth="2" />
          <ellipse cx="200" cy="170" rx="38" ry="48" fill={fill} stroke={stroke} strokeWidth="2" />
          <rect x="178" y="210" width="12" height="45" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
          <rect x="210" y="210" width="12" height="45" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
          <path d="M175 75 L165 50 M225 75 L235 50" stroke={stroke} strokeWidth="3" fill="none" />
        </>
      ) : (
        <g transform={view === 'right' ? 'translate(400,0) scale(-1,1)' : undefined}>
          <circle cx="260" cy="115" r="24" fill={fill} stroke={stroke} strokeWidth="2" />
          <ellipse cx="180" cy="150" rx="55" ry="32" fill={fill} stroke={stroke} strokeWidth="2" />
          <rect x="140" y="175" width="10" height="45" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
          <rect x="165" y="180" width="10" height="40" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
          <rect x="195" y="180" width="10" height="40" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
          <rect x="220" y="175" width="10" height="45" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
          <path d="M125 150 Q110 145 105 160" fill="none" stroke={stroke} strokeWidth="2" />
          <path d="M250 95 L245 70" stroke={stroke} strokeWidth="2" />
        </g>
      )}
    </svg>
  )
}
