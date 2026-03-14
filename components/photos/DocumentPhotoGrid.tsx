'use client'

import DocumentPhotoViewer, { type DocumentPhotoItem } from './DocumentPhotoViewer'

type DocumentPhotoGridProps = {
  items: DocumentPhotoItem[]
}

export default function DocumentPhotoGrid({ items }: DocumentPhotoGridProps) {
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <DocumentPhotoViewer key={item.id} item={item} />
      ))}
    </div>
  )
}
