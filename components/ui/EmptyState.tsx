import type { ReactNode } from 'react'
import SectionCard from './SectionCard'

type EmptyStateProps = {
  title?: ReactNode
  description: ReactNode
  action?: ReactNode
  className?: string
}

export default function EmptyState({
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <SectionCard className={className} bodyClassName="px-6 py-10 text-center">
      {title && (
        <div className="mb-2 text-[16px] font-semibold text-[#1B1F23]">
          {title}
        </div>
      )}

      <div className="text-sm text-[#6B7280]">{description}</div>

      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </SectionCard>
  )
}