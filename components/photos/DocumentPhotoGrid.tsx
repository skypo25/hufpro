'use client'

import DocumentPhotoViewer, { type DocumentPhotoItem } from './DocumentPhotoViewer'
import WholeBodyPhotoSwitcher from './WholeBodyPhotoSwitcher'

type DocumentPhotoGridProps = {
  items: DocumentPhotoItem[]
}

export default function DocumentPhotoGrid({ items }: DocumentPhotoGridProps) {
  if (items.length === 0) return null

  const wholeBodyItems = items.filter((i) => i.isWholeBody)
  const otherItems = items.filter((i) => !i.isWholeBody)

  const switcherItems = wholeBodyItems
    .slice(0, 2)
    .sort((a, b) => (a.label.includes('links') ? 0 : 1) - (b.label.includes('links') ? 0 : 1))
    .map((item) => ({ id: item.id, imageUrl: item.imageUrl, label: item.label }))

  return (
    <div className="space-y-4">
      {switcherItems.length > 0 && (
        <WholeBodyPhotoSwitcher items={switcherItems} />
      )}
      {otherItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {otherItems.map((item) => (
            <DocumentPhotoViewer key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
