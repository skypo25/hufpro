import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { runSeed } from "@/lib/seed/seed-data"

/**
 * POST /api/seed – Legt realistische Testdaten für den aktuell eingeloggten User an.
 * Keine Fotos, nur Tabellen: Kunden, Pferde, Termine, Hufdokumentationen, Rechnungen.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const result = await runSeed(supabase, user.id)

  if (result.error) {
    return NextResponse.json(
      { error: result.error, partial: result },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: "Testdaten wurden angelegt.",
    ...result,
  })
}
