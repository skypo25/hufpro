import { DirectoryCategoryCardIcon } from '@/components/directory/public/listing/DirectoryCategoryCardIcon'

/** Fach-Icons wie im Listing: `public/directory/{code}.svg`, Fallback Bootstrap. */
export function ProfileBentoSpecialtyIcon({ code }: { code: string }) {
  return <DirectoryCategoryCardIcon code={code} />
}
