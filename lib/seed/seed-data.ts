/**
 * Realistische Testdaten für einen Hufbearbeiter.
 * Keine Fotos, keine Storage-Uploads – nur Tabellen: customers, horses, appointments,
 * appointment_horses, hoof_records, invoices, invoice_items.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

const CUSTOMERS = [
  { first_name: "Anna", last_name: "Weber", phone: "0171 1234567", email: "anna.weber@example.de", city: "München", stable_name: "Reitanlage Sonnenhof", stable_city: "München" },
  { first_name: "Markus", last_name: "Schneider", phone: "0160 9876543", email: "m.schneider@example.de", city: "Augsburg", stable_name: "Hof am Wald", stable_city: "Augsburg" },
  { first_name: "Julia", last_name: "Hofmann", phone: "0151 5551234", email: null, city: "Nürnberg", stable_name: "Pferdeparadies", stable_city: "Nürnberg" },
  { first_name: "Thomas", last_name: "Bauer", phone: "0176 4445566", email: "thomas.bauer@example.de", city: "Regensburg", stable_name: "Bauernhof Bauer", stable_city: "Regensburg" },
  { first_name: "Lisa", last_name: "Klein", phone: "0172 3334455", email: "l.klein@example.de", city: "Ingolstadt", stable_name: "Klein's Reitstall", stable_city: "Ingolstadt" },
  { first_name: "Stefan", last_name: "Richter", phone: "0163 2223344", email: null, city: "Würzburg", stable_name: "Gut Richter", stable_city: "Würzburg" },
  { first_name: "Petra", last_name: "Wagner", phone: "0175 1112233", email: "petra.wagner@example.de", city: "Bamberg", stable_name: "Wagner Pferde", stable_city: "Bamberg" },
  { first_name: "Michael", last_name: "Schulz", phone: "0152 9998877", email: "m.schulz@example.de", city: "Erlangen", stable_name: "Schulz Stall", stable_city: "Erlangen" },
  { first_name: "Laura", last_name: "Fischer", phone: "0174 8887766", email: "laura.fischer@example.de", city: "Fürth", stable_name: "Fischer Hof", stable_city: "Fürth" },
  { first_name: "Daniel", last_name: "Koch", phone: "0162 7776655", email: null, city: "Bayreuth", stable_name: "Koch Reitanlage", stable_city: "Bayreuth" },
  { first_name: "Martina", last_name: "Beck", phone: "0170 6665544", email: "m.beck@example.de", city: "Bamberg", stable_name: "Beck Ställe", stable_city: "Bamberg" },
  { first_name: "Florian", last_name: "Hartmann", phone: "0157 5554433", email: "f.hartmann@example.de", city: "Coburg", stable_name: "Hartmann Hof", stable_city: "Coburg" },
  { first_name: "Katharina", last_name: "Neumann", phone: "0173 4443322", email: "k.neumann@example.de", city: "Hof", stable_name: "Neumann Pferde", stable_city: "Hof" },
  { first_name: "Robert", last_name: "Frank", phone: "0161 3332211", email: null, city: "Ansbach", stable_name: "Frank Stall", stable_city: "Ansbach" },
  { first_name: "Sabrina", last_name: "Keller", phone: "0177 2221100", email: "s.keller@example.de", city: "Landshut", stable_name: "Keller Reitverein", stable_city: "Landshut" },
]

const HORSE_NAMES = [
  "Bella", "Luna", "Max", "Storm", "Amigo", "Fuego", "Nero", "Dakota", "Rocky", "Spirit",
  "Apollo", "Nala", "Kira", "Samson", "Chico", "Sunny", "Shadow", "Maja", "Finn", "Cookie",
  "Ben", "Lilly", "Charlie", "Emma", "Oscar",
]

const BREEDS = ["Warmblut", "Haflinger", "Quarter Horse", "Pony", "Vollblut", "Kaltblut", "Isländer", "Deutsches Reitpony"]
const SEXES = ["Stute", "Wallach", "Hengst"] as const
const APPOINTMENT_TYPES = ["Ersttermin", "Folgebehandlung", "Kontrolle", "Regeltermin"] as const
const RECORD_SUMMARY = [
  "Alle vier Hufe bearbeitet, leichte mediale Belastung vorne links korrigiert.",
  "Strahl leicht weich, Besitzer auf Stallhygiene hingewiesen.",
  "Trachten leicht untergeschoben, nächste Kontrolle in 6 Wochen empfohlen.",
  "Hufe ausgeglichen, Zehen gekürzt, Hornqualität gut.",
  "VL und VR nachgearbeitet, Sohle entlastet.",
  "Routinebearbeitung, alle Hufe in gutem Zustand.",
  "Leichte Fehlstellung HL korrigiert, Besitzer informiert.",
]
const RECORD_RECOMMENDATION = [
  "Nächste Kontrolle in 6 Wochen.",
  "Stallhygiene verbessern, Stroh trocken halten.",
  "Bewegung beibehalten, Weidegang fördern.",
  "In 4–6 Wochen erneut prüfen.",
]
const GENERAL_CONDITION = ["Gut", "Unauffällig", "Leicht auffällig", "Stabil"]
const GAIT = ["Frei und gleichmäßig", "Leicht lahm", "Unauffällig", "Gangbild gut"]
const HORN_QUALITY = ["Gut", "Mittel", "Weich an Strahl", "Stabil"]

const CHECKLIST_ITEMS = [
  "Gangbild beurteilt",
  "Allgemeinzustand geprüft",
  "Alle 4 Hufe bearbeitet",
  "Hufwinkel gemessen",
  "Besitzer informiert",
]

const INVOICE_POSITIONS = [
  { description: "Hufbearbeitung", priceCents: 6500 },
  { description: "Korrektur", priceCents: 5500 },
  { description: "Kontrolle", priceCents: 4500 },
  { description: "Hufbearbeitung inkl. Anfahrt", priceCents: 7500 },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}
function daysAhead(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function toISODateTime(d: Date, hour: number, minute: number): string {
  const x = new Date(d)
  x.setHours(hour, minute, 0, 0)
  return x.toISOString().slice(0, 19).replace("T", "T")
}

export type SeedResult = {
  customers: number
  horses: number
  appointments: number
  hoofRecords: number
  invoices: number
  error?: string
}

export async function runSeed(
  supabase: SupabaseClient,
  userId: string
): Promise<SeedResult> {
  const result: SeedResult = { customers: 0, horses: 0, appointments: 0, hoofRecords: 0, invoices: 0 }

  const customerIds: string[] = []
  for (const c of CUSTOMERS) {
    const name = `${c.first_name} ${c.last_name}`
    const { data, error } = await supabase
      .from("customers")
      .insert({
        user_id: userId,
        name,
        first_name: c.first_name,
        last_name: c.last_name,
        phone: c.phone,
        email: c.email ?? null,
        street: "Musterstraße 1",
        city: c.city,
        postal_code: "80000",
        country: "Deutschland",
        stable_name: c.stable_name ?? null,
        stable_city: c.stable_city ?? null,
        stable_differs: !!(c.stable_name || c.stable_city),
      })
      .select("id")
      .single()
    if (error) return { ...result, error: `Kunden: ${error.message}` }
    if (data?.id) customerIds.push(data.id)
  }
  result.customers = customerIds.length

  const horseByCustomer: { horseId: string; customerIdx: number }[] = []
  let horseIndex = 0
  for (let i = 0; i < customerIds.length; i++) {
    const numHorses = i < 8 ? 2 : 1
    for (let h = 0; h < numHorses; h++) {
      const name = HORSE_NAMES[horseIndex % HORSE_NAMES.length]
      horseIndex++
      const birthYear = 2015 + Math.floor(Math.random() * 10)
      const { data, error } = await supabase
        .from("horses")
        .insert({
          user_id: userId,
          customer_id: customerIds[i],
          name,
          breed: pick(BREEDS),
          sex: pick(SEXES),
          birth_year: birthYear,
        })
        .select("id")
        .single()
      if (error) return { ...result, error: `Pferde: ${error.message}` }
      if (data?.id) horseByCustomer.push({ horseId: data.id, customerIdx: i })
    }
  }
  result.horses = horseByCustomer.length

  const appointments: { id: string; appointment_date: string; customer_id: string; horseIds: string[] }[] = []
  const horseIdsByCustomer = new Map<number, string[]>()
  for (const { horseId, customerIdx } of horseByCustomer) {
    const list = horseIdsByCustomer.get(customerIdx) ?? []
    list.push(horseId)
    horseIdsByCustomer.set(customerIdx, list)
  }

  const dates: Date[] = []
  for (let d = 180; d >= 0; d -= 12) dates.push(daysAgo(d))
  for (let d = 1; d <= 14; d += 2) dates.push(daysAhead(d))

  let appointmentCount = 0
  for (let i = 0; i < customerIds.length; i++) {
    const customerId = customerIds[i]
    const horsesOfCustomer = horseIdsByCustomer.get(i) ?? []
    if (horsesOfCustomer.length === 0) continue
    const numAppointments = 4 + Math.floor(Math.random() * 6)
    const usedDates = new Set<string>()
    for (let a = 0; a < numAppointments; a++) {
      const date = pick(dates)
      const dateKey = toISODate(date)
      if (usedDates.has(dateKey)) continue
      usedDates.add(dateKey)
      const hour = 8 + Math.floor(Math.random() * 8)
      const appointmentDateTime = toISODateTime(date, hour, 0)
      const { data: appData, error: appErr } = await supabase
        .from("appointments")
        .insert({
          user_id: userId,
          customer_id: customerId,
          appointment_date: appointmentDateTime,
          type: pick(APPOINTMENT_TYPES),
          status: "Bestätigt",
          duration_minutes: 60,
          notes: null,
        })
        .select("id")
        .single()
      if (appErr) return { ...result, error: `Termine: ${appErr.message}` }
      if (!appData?.id) continue
      const selectedHorses = pickN(horsesOfCustomer, 1 + Math.floor(Math.random() * (horsesOfCustomer.length)))
      for (const hid of selectedHorses) {
        await supabase.from("appointment_horses").insert({
          user_id: userId,
          appointment_id: appData.id,
          horse_id: hid,
        })
      }
      appointments.push({
        id: appData.id,
        appointment_date: appointmentDateTime,
        customer_id: customerId,
        horseIds: selectedHorses,
      })
      appointmentCount++
    }
  }
  result.appointments = appointmentCount

  let recordCount = 0
  const recordIdsByHorse = new Map<string, string[]>()
  for (const { horseIds, appointment_date } of appointments) {
    const recordDate = appointment_date.slice(0, 10)
    for (const horseId of horseIds) {
      const { data: recData, error: recErr } = await supabase
        .from("hoof_records")
        .insert({
          user_id: userId,
          horse_id: horseId,
          record_date: recordDate,
          hoof_condition: pick(RECORD_SUMMARY),
          treatment: pick(RECORD_RECOMMENDATION),
          general_condition: pick(GENERAL_CONDITION),
          gait: pick(GAIT),
          horn_quality: pick(HORN_QUALITY),
          checklist_json: Math.random() > 0.5 ? pickN(CHECKLIST_ITEMS, 2 + Math.floor(Math.random() * 3)).map((label) => ({ label, checked: true })) : null,
        })
        .select("id")
        .single()
      if (recErr) return { ...result, error: `Dokumentation: ${recErr.message}` }
      if (recData?.id) {
        recordCount++
        const list = recordIdsByHorse.get(horseId) ?? []
        list.push(recData.id)
        recordIdsByHorse.set(horseId, list)
      }
    }
  }
  result.hoofRecords = recordCount

  let invoiceNumber = 9001
  const year = new Date().getFullYear()
  const prefix = "HUF-"
  for (let i = 0; i < customerIds.length; i++) {
    if (Math.random() > 0.6) continue
    const customerId = customerIds[i]
    const invNum = `${prefix}${year}-${String(invoiceNumber).padStart(4, "0")}`
    invoiceNumber++
    const invoiceDate = toISODate(daysAgo(30 + Math.floor(Math.random() * 60)))
    const due = new Date(invoiceDate)
    due.setDate(due.getDate() + 14)
    const paymentDueDate = toISODate(due)
    const pos = pick(INVOICE_POSITIONS)
    const { data: invData, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        customer_id: customerId,
        invoice_number: invNum,
        invoice_date: invoiceDate,
        payment_due_date: paymentDueDate,
        status: Math.random() > 0.5 ? "sent" : "paid",
        buyer_name: CUSTOMERS[i] ? `${CUSTOMERS[i].first_name} ${CUSTOMERS[i].last_name}` : "Kunde",
        buyer_street: "Musterstraße 1",
        buyer_zip: "80000",
        buyer_city: CUSTOMERS[i]?.city ?? "Stadt",
        buyer_country: "Deutschland",
      })
      .select("id")
      .single()
    if (invErr) return { ...result, error: `Rechnungen: ${invErr.message}` }
    if (invData?.id) {
      await supabase.from("invoice_items").insert({
        invoice_id: invData.id,
        position: 1,
        description: pos.description,
        quantity: 1,
        unit_price_cents: pos.priceCents,
        amount_cents: pos.priceCents,
        tax_rate_percent: 0,
      })
      result.invoices++
    }
  }

  return result
}
