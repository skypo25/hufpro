import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { deriveAppProfile } from "@/lib/appProfile"
import { runSeed } from "@/lib/seed/seed-data"
import { requireAppAccess } from "@/lib/billing/requireAppAccess"

/**
 * POST /api/seed – Legt realistische Testdaten für den aktuell eingeloggten User an.
 * Nur Dev oder explizit freigeschaltet (ALLOW_SEED) — nie stillschweigend in Produktion.
 */
export async function POST() {
  const allowSeed =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SEED === "true" ||
    process.env.ALLOW_SEED === "1"

  if (!allowSeed) {
    return NextResponse.json(
      { error: "Seed in Produktion nicht erlaubt." },
      { status: 403 }
    )
  }

  const gate = await requireAppAccess({ mode: "write" })
  if (!gate.ok) return gate.response

  const supabase = await createSupabaseServerClient()
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", gate.userId)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)

  const result = await runSeed(supabase, gate.userId, profile)

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
