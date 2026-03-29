import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { respondRecordPdf } from '@/lib/pdf/recordPdfHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string; recordId: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const { id: horseId, recordId } = await params
  return respondRecordPdf(request, supabase, user.id, horseId, recordId)
}
