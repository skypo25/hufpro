import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { deriveAppProfile } from "@/lib/appProfile"
import { runSeed } from "@/lib/seed/seed-data"

/**
 * POST /api/seed – Legt realistische Testdaten für den aktuell eingeloggten User an.
 * Modus richtet sich nach Onboarding (Beruf / Tier-Fokus). Keine Fotos.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", user.id)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)

  const result = await runSeed(supabase, user.id, profile)

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
