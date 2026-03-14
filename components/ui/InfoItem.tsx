import type { ReactNode } from 'react'

type InfoItemProps = {
  label: string
  value?: ReactNode
  accent?: boolean
  className?: string
  labelClassName?: string
  valueClassName?: string
}

export default function InfoItem({
  label,
  value,
  accent = false,
  className = '',
  labelClassName = '',
  valueClassName = '',
}: InfoItemProps) {
  return (
    <div className={['space-y-1.5', className].join(' ')}>
      <div
        className={[
          'text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]',
          labelClassName,
        ].join(' ')}
      >
        {label}
      </div>

      <div
        className={[
          accent
            ? 'text-[14px] font-medium text-[#154226]'
            : 'text-[14px] font-medium text-[#1B1F23]',
          valueClassName,
        ].join(' ')}
      >
        {value || '-'}
      </div>
    </div>
  )
}