import type { ReactNode } from 'react'
import SectionCard from './SectionCard'

type StatCardProps = {
  label: ReactNode
  value: ReactNode
  subtext?: ReactNode
  valueClassName?: string
  className?: string
}

export default function StatCard({
  label,
  value,
  subtext,
  valueClassName = '',
  className = '',
}: StatCardProps) {
  return (
    <SectionCard className={className} bodyClassName="px-[22px] py-5">
      <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
        {label}
      </div>

      <div
        className={[
          'dashboard-serif text-[28px] font-medium text-[#1B1F23]',
          valueClassName,
        ].join(' ')}
      >
        {value}
      </div>

      {subtext && <div className="mt-1 text-[12px] text-[#9CA3AF]">{subtext}</div>}
    </SectionCard>
  )
}