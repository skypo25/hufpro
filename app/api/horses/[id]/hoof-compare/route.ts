import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { loadHorseHoofComparePageData } from '@/lib/hoofCompare/loadHorseHoofComparePageData'
import {
  CACHE_REVALIDATE_SECONDS,
  hoofCompareTag,
  stableHoofCompareParamKey,
} from '@/lib/cache/tags'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: horseId } = await params
  const url = new URL(request.url)
  const searchParams: Record<string, string | string[] | undefined> = {}
  url.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })
  const paramKey = stableHoofCompareParamKey(searchParams)

  const result = await unstable_cache(
    async () => loadHorseHoofComparePageData(horseId, searchParams),
    ['hoof-compare', user.id, horseId, paramKey],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.hoofCompare,
      tags: [hoofCompareTag(user.id, horseId)],
    }
  )()

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
