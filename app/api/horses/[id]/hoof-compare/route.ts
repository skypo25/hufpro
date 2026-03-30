import { NextResponse } from 'next/server'
import { loadHorseHoofComparePageData } from '@/lib/hoofCompare/loadHorseHoofComparePageData'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: horseId } = await params
  const url = new URL(request.url)
  const searchParams: Record<string, string | string[] | undefined> = {}
  url.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  const result = await loadHorseHoofComparePageData(horseId, searchParams)

  if (result.status === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (result.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (result.status === 'insufficient_records') {
    return NextResponse.json(
      { error: 'insufficient_records', horseId: result.horseId },
      { status: 400 }
    )
  }

  return NextResponse.json(result.data)
}
