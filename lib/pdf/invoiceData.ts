/**
 * Lädt alle für die Rechnungs-PDF nötigen Daten (§14 UStG).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { InvoicePdfData, InvoicePdfSeller, InvoicePdfBuyer, InvoicePdfItem } from "./invoiceTypes"

type SettingsRow = { settings: Record<string, unknown> | null }
type InvoiceRow = {
  id: string
  invoice_number: string
  invoice_date: string
  service_date_from: string | null
  service_date_to: string | null
  payment_due_date: string | null
  intro_text: string | null
  footer_text: string | null
  customer_id: string | null
  buyer_name: string | null
  buyer_company: string | null
  buyer_street: string | null
  buyer_zip: string | null
  buyer_city: string | null
  buyer_country: string | null
}
type InvoiceItemRow = {
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
  tax_rate_percent: number
}
type CustomerRow = {
  name: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  customer_number: number | null
}

function formatDate(d: string | null | undefined): string | null {
  if (!d) return null
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

function sellerFromSettings(s: Record<string, unknown> | null): InvoicePdfSeller {
  const o = s ?? {}
  const firstName = (o.firstName as string) ?? ""
  const lastName = (o.lastName as string) ?? ""
  const name = [firstName, lastName].filter(Boolean).join(" ") || "–"
  return {
    logoUrl: (o.logoUrl as string) ?? null,
    companyName: (o.companyName as string) ?? null,
    name,
    qualification: (o.qualification as string) ?? null,
    street: (o.street as string) ?? null,
    zip: (o.zip as string) ?? null,
    city: (o.city as string) ?? null,
    country: (o.country as string) ?? "Deutschland",
    phone: (o.phone as string) ?? null,
    email: (o.email as string) ?? null,
    website: (o.website as string) ?? null,
    taxNumber: (o.taxNumber as string) ?? null,
    taxOffice: (o.taxOffice as string) ?? null,
    ustId: (o.ustId as string) ?? null,
    kleinunternehmer: (o.kleinunternehmer as boolean) ?? true,
    kleinunternehmerText: (o.kleinunternehmerText as string) ?? null,
    bank: (o.bank as string) ?? null,
    accountHolder: (o.accountHolder as string) ?? null,
    iban: (o.iban as string) ?? null,
    bic: (o.bic as string) ?? null,
  }
}

function buyerFromCustomer(c: CustomerRow | null, fallbackName: string): InvoicePdfBuyer {
  if (!c) {
    return { name: fallbackName, company: null, street: null, zip: null, city: null, country: null }
  }
  const name = c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Kunde / Kundin"
  return {
    name,
    company: c.company?.trim() || null,
    street: c.street?.trim() || null,
    zip: c.postal_code?.trim() || null,
    city: c.city?.trim() || null,
    country: c.country?.trim() || null,
  }
}

export async function fetchInvoicePdfData(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string
): Promise<InvoicePdfData | null> {
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, service_date_from, service_date_to, payment_due_date, intro_text, footer_text, customer_id, buyer_name, buyer_company, buyer_street, buyer_zip, buyer_city, buyer_country")
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .single<InvoiceRow>()

  if (invErr || !inv) return null

  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle<SettingsRow>()

  const seller = sellerFromSettings(settingsRow?.settings ?? null)

  let buyer: InvoicePdfBuyer = { name: "Kunde / Kundin", company: null, street: null, zip: null, city: null, country: null }
  let customerNumberDisplay: string | null = null
  const hasBuyerSnapshot = inv.buyer_name?.trim()
  if (hasBuyerSnapshot) {
    buyer = {
      name: inv.buyer_name!.trim(),
      company: inv.buyer_company?.trim() ?? null,
      street: inv.buyer_street?.trim() ?? null,
      zip: inv.buyer_zip?.trim() ?? null,
      city: inv.buyer_city?.trim() ?? null,
      country: inv.buyer_country?.trim() ?? null,
    }
  } else if (inv.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("name, first_name, last_name, company, street, postal_code, city, country, customer_number")
      .eq("id", inv.customer_id)
      .eq("user_id", userId)
      .single<CustomerRow>()
    buyer = buyerFromCustomer(cust ?? null, "Kunde / Kundin")
    if (cust?.customer_number != null) {
      const prefix = (settingsRow?.settings as Record<string, unknown>)?.customerNumberPrefix as string | undefined
      const { formatCustomerNumber } = await import("@/lib/format")
      customerNumberDisplay = formatCustomerNumber(cust.customer_number, prefix ?? "K-")
    }
  }

  const { data: itemRows } = await supabase
    .from("invoice_items")
    .select("description, quantity, unit_price_cents, amount_cents, tax_rate_percent")
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: true })
    .returns<InvoiceItemRow[]>()

  const items: InvoicePdfItem[] = (itemRows ?? []).map((r) => ({
    description: r.description,
    quantity: Number(r.quantity) || 1,
    unitPriceCents: r.unit_price_cents,
    amountCents: r.amount_cents,
    taxRatePercent: Number(r.tax_rate_percent) || 0,
  }))

  const totalCents = items.reduce((sum, i) => sum + i.amountCents, 0)
  const currency = (settingsRow?.settings as Record<string, unknown>)?.currency ?? "EUR (€)"

  return {
    customerNumberDisplay: customerNumberDisplay ?? undefined,
    invoiceNumber: inv.invoice_number,
    invoiceDate: inv.invoice_date,
    serviceDateFrom: inv.service_date_from,
    serviceDateTo: inv.service_date_to,
    paymentDueDate: inv.payment_due_date,
    introText: inv.intro_text,
    footerText: inv.footer_text,
    seller,
    buyer,
    items,
    totalCents,
    currency: typeof currency === "string" ? currency : "EUR (€)",
  }
}
