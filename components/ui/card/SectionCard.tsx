import { ReactNode } from 'react'
import Card from './Card'

interface SectionCardProps {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export default function SectionCard({
  title,
  action,
  children,
  className = '',
  bodyClassName = '',
}: SectionCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="dashboard-serif text-[16px] text-foreground">{title}</h3>
        {action}
      </div>

      <div className={['p-6', bodyClassName].join(' ')}>{children}</div>
    </Card>
  )
}