import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"

/** "65,00 €" oder "65.00" -> 6500 */
function priceStringToCents(s: string): number {
  const cleaned = String(s).replace(/[^\d,.-]/g, "").replace(",", ".")
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return 0
  return Math.round(num * 100)
}

type CustomerRow = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  country: string | null
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 })
  }

  let customerId: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    customerId = typeof body.customerId === "string" && body.customerId.trim() ? body.customerId.trim() : null
  } catch {
    // no body
  }

  if (!customerId) {
    return NextResponse.json({ error: "Bitte einen Kunden als Rechnungsempfänger auswählen." }, { status: 400 })
  }

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, name, first_name, last_name, company, street, postal_code, city, country")
    .eq("id", customerId)
    .eq("user_id", user.id)
    .single<CustomerRow>()

  if (custErr || !customer) {
    return NextResponse.json({ error: "Kunde nicht gefunden oder kein Zugriff." }, { status: 404 })
  }

  const buyerName = customer.name?.trim() || [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Kunde / Kundin"

  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", user.id)
    .maybeSingle<{ settings: Record<string, unknown> | null }>()

  const s = (settingsRow?.settings ?? {}) as Record<string, unknown>
  const prefix = (s.invoicePrefix as string) ?? "HUF-"
  const introText = (s.invoiceTextTop as string) ?? null
  const footerText = (s.invoiceTextBottom as string) ?? null
  const services = (s.services as { label: string; price: string }[]) ?? []
  const firstService = services[0]
  const label = firstService?.label ?? "Barhufbearbeitung (1 Pferd, 4 Hufe)"
  const priceStr = firstService?.price ?? "65,00 €"
  const amountCents = priceStringToCents(priceStr)
  const unitPriceCents = amountCents

  const today = new Date().toISOString().slice(0, 10)
  const due = new Date()
  due.setDate(due.getDate() + 7)
  const paymentDueDate = due.toISOString().slice(0, 10)

  const invoiceNumber = `${prefix}TEST-${Date.now().toString(36).toUpperCase()}`

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      customer_id: customer.id,
      invoice_number: invoiceNumber,
      invoice_date: today,
      payment_due_date: paymentDueDate,
      status: "draft",
      intro_text: introText,
      footer_text: footerText,
      buyer_name: buyerName,
      buyer_company: customer.company?.trim() || null,
      buyer_street: customer.street?.trim() || null,
      buyer_zip: customer.postal_code?.trim() || null,
      buyer_city: customer.city?.trim() || null,
      buyer_country: customer.country?.trim() || null,
    })
    .select("id")
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ error: invErr?.message ?? "Rechnung konnte nicht erstellt werden" }, { status: 500 })
  }

  const { error: itemErr } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    position: 1,
    description: label,
    quantity: 1,
    unit_price_cents: unitPriceCents,
    amount_cents: amountCents,
    tax_rate_percent: 0,
  })

  if (itemErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id)
    return NextResponse.json({ error: itemErr.message }, { status: 500 })
  }

  return NextResponse.json({ invoiceId: invoice.id })
}
