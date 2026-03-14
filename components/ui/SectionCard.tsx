import type { ReactNode } from 'react'

type SectionCardProps = {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  headerClassName?: string
}

export default function SectionCard({
  title,
  right,
  children,
  className = '',
  bodyClassName = '',
  headerClassName = '',
}: SectionCardProps) {
  return (
    <section
      className={[
        'huf-card',
        className,
      ].join(' ')}
    >
      {(title || right) && (
        <div
          className={[
            'flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]',
            headerClassName,
          ].join(' ')}
        >
          <div className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
            {title}
          </div>

          {right && <div>{right}</div>}
        </div>
      )}

      <div className={bodyClassName}>{children}</div>
    </section>
  )
}