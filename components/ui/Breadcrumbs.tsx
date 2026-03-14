import Link from 'next/link'

type BreadcrumbItem = {
  label: string
  href?: string
}

type BreadcrumbsProps = {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="text-[#154226] hover:underline">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}

            {!isLast && <span>›</span>}
          </div>
        )
      })}
    </div>
  )
}