import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadHorseHoofComparePageData } from '@/lib/hoofCompare/loadHorseHoofComparePageData'
import HoofComparePageClient from '@/components/hoofCompare/HoofComparePageClient'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HorseHoofComparePage({ params, searchParams }: PageProps) {
  const { id: horseId } = await params
  const sp = await searchParams

  const result = await loadHorseHoofComparePageData(horseId, sp)

  if (result.status === 'unauthorized') {
    redirect('/login')
  }
  if (result.status === 'not_found') {
    redirect('/animals')
  }
  if (result.status === 'forbidden') {
    redirect(`/animals/${result.horseId}`)
  }
  if (result.status === 'insufficient_records') {
    return (
      <main className="mx-auto max-w-[640px] space-y-6 px-4 py-12">
        <h1 className="dashboard-serif text-[22px] font-medium text-[#1B1F23]">Fotovergleich</h1>
        <p className="text-[14px] leading-relaxed text-[#6B7280]">
          Für einen Vergleich werden mindestens zwei Dokumentationen benötigt.
        </p>
        <Link
          href={`/animals/${result.horseId}`}
          className="inline-flex items-center gap-2 text-[14px] font-medium text-[#52b788] hover:underline"
        >
          Zurück zum Tier
        </Link>
      </main>
    )
  }

  const d = result.data
  return (
    <HoofComparePageClient
      basePath={d.basePath}
      horseName={d.horseName}
      horseSubtitle={d.horseSubtitle}
      recordOptions={d.recordOptions}
      left={d.left}
      right={d.right}
      hoof={d.hoof}
      view={d.view}
      slotKey={d.slotKey}
      timeline={d.timeline}
      daysBetween={d.daysBetween}
    />
  )
}
