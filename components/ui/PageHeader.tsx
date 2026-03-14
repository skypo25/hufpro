import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export default function PageHeader({
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={[
        'flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between',
        className,
      ].join(' ')}
    >
      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-foreground">
          {title}
        </h1>

        {description && (
          <p className="mt-1 text-[14px] text-text-secondary">{description}</p>
        )}
      </div>

      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  )
}