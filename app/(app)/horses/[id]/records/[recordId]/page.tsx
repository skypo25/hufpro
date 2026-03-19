import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DeleteRecordForm from './DeleteRecordForm'
import { SLOT_LABELS, SLOT_SOLAR, SLOT_LATERAL } from '@/lib/photos/photoTypes'
import { formatCustomerNumber } from '@/lib/format'
import PhotoLightbox from '@/components/photos/PhotoLightbox'

type RecordDetailPageProps = {
  params: Promise<{ id: string; recordId: string }>
}

type HoofRecord = {
  id: string
  horse_id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
  created_at?: string | null
  updated_at?: string | null
  general_condition?: string | null
  gait?: string | null
  handling_behavior?: string | null
  horn_quality?: string | null
  hoofs_json?: unknown
  record_type?: string | null
  doc_number?: string | null
}

type HoofPhoto = {
  id: string
  file_path: string | null
  photo_type: string | null
  annotations_json?: unknown
  width?: number | null
  height?: number | null
}

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  usage: string | null
  hoof_status: string | null
  care_interval: string | null
  customer_id: string | null
  customers?:
    | { id?: string; customer_number?: number | null; name: string | null; stable_name: string | null; city: string | null }
    | { id?: string; customer_number?: number | null; name: string | null; stable_name: string | null; city: string | null }[]
    | null
}

type HoofData = {
  hoof_position: 'vl' | 'vr' | 'hl' | 'hr'
  toe_alignment: string | null
  heel_balance: string | null
  sole_condition: string | null
  frog_condition: string | null
}

function getRelation<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

function formatGermanDate(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return ds
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function formatGermanDatetime(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return ds
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d).replace(',', ' um')
}

function buildDocNumber(recordId: string, recordDate: string | null): string {
  const year = recordDate ? new Date(recordDate).getFullYear() : new Date().getFullYear()
  const suffix = recordId.replace(/-/g, '').slice(-4).toUpperCase()
  return `DOK-${year}-${suffix}`
}

function parseHoofsJson(json: unknown): HoofData[] {
  if (!json || !Array.isArray(json)) return []
  return (json as HoofData[]).filter(
    (h) => h && ['vl', 'vr', 'hl', 'hr'].includes(h.hoof_position)
  )
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const HOOF_STD = { toe: 'gerade', heel: ['normal', 'ausgeglichen'], sole: 'stabil', frog: 'gesund' }

function singleHoofStatus(h: HoofData): 'ok' | 'warn' | 'critical' {
  if (h.frog_condition === 'faulig') return 'critical'
  const ok =
    (!h.toe_alignment  || h.toe_alignment  === HOOF_STD.toe)  &&
    (!h.heel_balance   || HOOF_STD.heel.includes(h.heel_balance)) &&
    (!h.sole_condition || h.sole_condition === HOOF_STD.sole) &&
    (!h.frog_condition || h.frog_condition === HOOF_STD.frog)
  return ok ? 'ok' : 'warn'
}

function hoofValueClass(field: string, val: string | null): string {
  if (!val) return 'text-[#1B1F23]'
  if (field === 'frog_condition' && val === 'faulig') return 'font-semibold text-[#DC2626]'
  const std =
    (field === 'toe_alignment'  && val === 'gerade')  ||
    (field === 'heel_balance'   && HOOF_STD.heel.includes(val)) ||
    (field === 'sole_condition' && val === 'stabil')  ||
    (field === 'frog_condition' && val === 'gesund')
  return std ? 'text-[#1B1F23]' : 'font-semibold text-[#B45309]'
}

type DotColor = 'green' | 'yellow' | 'red' | 'neutral'
const DOT_CLASSES: Record<DotColor, string> = {
  green:   'bg-[#22C55E]',
  yellow:  'bg-[#EAB308]',
  red:     'bg-[#EF4444]',
  neutral: 'bg-[#9CA3AF]',
}
const VALUE_CLASSES: Record<DotColor, string> = {
  green:   'text-[#166534] font-semibold',
  yellow:  'text-[#92400E] font-semibold',
  red:     'text-[#991B1B] font-semibold',
  neutral: 'text-[#1B1F23]',
}

function gcColor(v: string | null): DotColor {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('unauffällig')) return 'green'
  if (l.includes('auffällig'))   return 'red'
  return 'neutral'
}
function gaitColor(v: string | null): DotColor {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('taktrein'))    return 'green'
  if (l.includes('lahm'))        return 'red'
  if (l.includes('ungleich'))    return 'yellow'
  return 'neutral'
}
function handlingColor(v: string | null): DotColor {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('kooperativ'))  return 'green'
  if (l.includes('unruhig'))     return 'yellow'
  if (l.includes('widersetzlich')) return 'red'
  return 'neutral'
}
function hornColor(v: string | null): DotColor {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('stabil') || l.includes('gut')) return 'green'
  return 'yellow'
}

/** Basic HTML sanitiser – strips script/style tags but keeps bold/italic/p/br */
function sanitiseHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
}

function hasRealContent(html: string | null | undefined): boolean {
  if (!html) return false
  return !!html.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, '').trim()
}

async function deleteRecord(horseId: string, recordId: string) {
  'use server'
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: photos } = await supabase
    .from('hoof_photos').select('file_path').eq('hoof_record_id', recordId).eq('user_id', user.id)
  if (photos?.length) {
    const paths = photos.map((p) => p.file_path).filter((x): x is string => Boolean(x))
    if (paths.length) await supabase.storage.from('hoof-photos').remove(paths)
    await supabase.from('hoof_photos').delete().eq('hoof_record_id', recordId).eq('user_id', user.id)
  }
  await supabase.from('hoof_records').delete().eq('id', recordId).eq('horse_id', horseId).eq('user_id', user.id)
  redirect(`/horses/${horseId}`)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LabelValueRow({ label, value, color }: { label: string; value: string; color: DotColor }) {
  return (
    <div className="flex items-center justify-between border-b border-[#F0EDEA] px-5 py-3 last:border-b-0">
      <span className="text-[13px] text-[#9CA3AF]">{label}</span>
      <span className={`flex items-center gap-2 text-[13px] ${VALUE_CLASSES[color]}`}>
        <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[color]}`} aria-hidden />
        {value}
      </span>
    </div>
  )
}

function HoofCard({ hoof }: { hoof: HoofData }) {
  const st = singleHoofStatus(hoof)
  const LABELS: Record<string, string> = {
    vl: 'VL — VORNE LINKS', vr: 'VR — VORNE RECHTS',
    hl: 'HL — HINTEN LINKS', hr: 'HR — HINTEN RECHTS',
  }
  const badgeMap = {
    ok:       { label: 'Unauffällig', cls: 'bg-[#DCFCE7] text-[#166534]' },
    warn:     { label: 'Abweichung',  cls: 'bg-[#FEF3C7] text-[#92400E]' },
    critical: { label: 'Kritisch',    cls: 'bg-[#FEE2E2] text-[#991B1B]' },
  }
  const cardBorder = st === 'critical' ? 'border-[#FCA5A5]' : st === 'warn' ? 'border-[#FDE68A]' : 'border-[#E5E2DC]'
  const badge = badgeMap[st]
  const rows: Array<{ label: string; field: keyof HoofData }> = [
    { label: 'Zehe',     field: 'toe_alignment' },
    { label: 'Trachten', field: 'heel_balance' },
    { label: 'Strahl',   field: 'frog_condition' },
    { label: 'Sohle',    field: 'sole_condition' },
  ]
  return (
    <div className={`rounded-xl border ${cardBorder} bg-white overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#F0EDEA] bg-[#FAFAF8] px-4 py-3">
        <span className="text-[12px] font-bold tracking-[0.05em] text-[#1B1F23]">
          {LABELS[hoof.hoof_position]}
        </span>
        <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      <div className="px-4 py-2">
        {rows.map(({ label, field }, i) => {
          const val = hoof[field] as string | null
          return (
            <div key={field} className={`flex items-center justify-between py-2 ${i < rows.length - 1 ? 'border-b border-[#F5F3F0]' : ''}`}>
              <span className="text-[12px] text-[#9CA3AF]">{label}</span>
              <span className={`text-[13px] ${val ? hoofValueClass(field, val) : 'text-[#C4BFB8]'}`}>
                {val ?? '–'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PhotoSlot({
  label,
  signedUrl,
  meta,
}: {
  label: string
  signedUrl: string | null
  meta?: HoofPhoto | null
}) {
  type Point = { x: number; y: number }
  type AnnotationItem =
    | { type: 'line' | 'axis'; points: Point[]; color?: string }
    | { type: 'stroke'; points: Point[]; color?: string }
    | { type: 'angle'; points: Point[]; color?: string }
    | { type: 'point'; point: Point; color?: string }

  const annotations =
    meta?.annotations_json &&
    typeof meta.annotations_json === 'object' &&
    'items' in (meta.annotations_json as object)
      ? (meta.annotations_json as { items: AnnotationItem[] }).items
      : []
  const W = meta?.width ?? 400
  const H = meta?.height ?? 711

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#E5E2DC] bg-[#F5F3EF]" style={{ aspectRatio: '9/16' }}>
      {signedUrl ? (
        <PhotoLightbox
          label={label}
          signedUrl={signedUrl}
          annotations={annotations}
          width={W}
          height={H}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <i className="bi bi-image text-[22px] text-[#C4BFB8]" aria-hidden />
          <span className="text-[11px] text-[#C4BFB8]">{label}</span>
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, titleRight, children }: {
  title: string
  titleRight?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E2DC] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E2DC] px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#1B1F23]">{title}</h2>
        {titleRight}
      </div>
      {children}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default async function RecordDetailPage({ params }: RecordDetailPageProps) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: horseId, recordId } = await params

  const { data: horse } = await supabase
    .from('horses')
    .select('id, name, breed, sex, birth_year, usage, hoof_status, care_interval, customer_id, customers (id, customer_number, name, stable_name, city)')
    .eq('id', horseId)
    .eq('user_id', user.id)
    .single<Horse>()

  // Fetch base record
  const { data: recordBase } = await supabase
    .from('hoof_records')
    .select('id, horse_id, record_date, hoof_condition, treatment, notes, created_at, updated_at')
    .eq('id', recordId)
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .single<HoofRecord>()

  if (!horse || !recordBase) {
    return (
      <main className="mx-auto max-w-[1200px] w-full space-y-7">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Dokumentation nicht gefunden</h1>
        </div>
      </main>
    )
  }

  // Extended fields (graceful fallback if columns missing)
  let extRecord: Partial<HoofRecord> = {}
  const { data: extRow } = await supabase
    .from('hoof_records')
    .select('general_condition, gait, handling_behavior, horn_quality, hoofs_json')
    .eq('id', recordId)
    .eq('user_id', user.id)
    .maybeSingle<Partial<HoofRecord>>()
  if (extRow) extRecord = extRow

  // doc_number – separate query so a missing column doesn't break extended fields
  const { data: docRow } = await supabase
    .from('hoof_records')
    .select('doc_number')
    .eq('id', recordId)
    .eq('user_id', user.id)
    .maybeSingle<{ doc_number?: string | null }>()
  if (docRow?.doc_number) extRecord = { ...extRecord, doc_number: docRow.doc_number }

  const record: HoofRecord = { ...recordBase, ...extRecord }

  // Previous record
  const { data: prevRows } = await supabase
    .from('hoof_records')
    .select('id, record_date')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .neq('id', recordId)
    .order('record_date', { ascending: false })
    .limit(1)
  const prevRecord = (prevRows as { id: string; record_date: string | null }[] | null)?.[0] ?? null

  // Photos
  const { data: photoRows } = await supabase
    .from('hoof_photos')
    .select('id, file_path, photo_type, annotations_json, width, height')
    .eq('hoof_record_id', recordId)
    .eq('user_id', user.id)
    .returns<HoofPhoto[]>()

  const photoMap: Record<string, string> = {}
  const photoMetaMap: Record<string, HoofPhoto> = {}
  if (photoRows?.length) {
    for (const p of photoRows) {
      if (!p.file_path || !p.photo_type) continue
      const { data: signed } = await supabase.storage
        .from('hoof-photos')
        .createSignedUrl(p.file_path, 60 * 60)
      if (signed?.signedUrl) {
        photoMap[p.photo_type] = signed.signedUrl
        photoMetaMap[p.photo_type] = p
      }
    }
  }

  const customer  = getRelation(horse.customers ?? null)
  const age       = horse.birth_year != null ? new Date().getFullYear() - horse.birth_year : null
  const hoofs     = parseHoofsJson(record.hoofs_json)
  const docNumber = record.doc_number || buildDocNumber(recordId, record.record_date)

  const photoSlots = [...SLOT_SOLAR, ...SLOT_LATERAL]
  const photoCount = photoSlots.filter((s) => photoMap[s]).length

  const deleteRecordForId = deleteRecord.bind(null, horseId, recordId)

  const hasGeneralData = !!(record.general_condition || record.gait || record.handling_behavior || record.horn_quality)
  const hasSummary     = hasRealContent(record.hoof_condition)

  // Section numbering
  let sectionIdx = 0
  const nextSection = () => { sectionIdx++; return sectionIdx }

  return (
    <main className="mx-auto max-w-[1200px] w-full">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-[12px] text-[#9CA3AF]">
        <Link href="/dashboard" className="hover:text-[#52b788]">Dashboard</Link>
        <span aria-hidden>›</span>
        <Link href="/horses" className="hover:text-[#52b788]">Pferde</Link>
        <span aria-hidden>›</span>
        <Link href={`/horses/${horseId}`} className="hover:text-[#52b788]">{horse.name || 'Pferd'}</Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">Dokumentation {formatGermanDate(record.record_date)}</span>
      </div>

      {/* Horse header */}
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#edf3ef] text-[#52b788]">
          <svg width="28" height="28" viewBox="0 0 576 512" fill="currentColor" aria-hidden>
            <path d="M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z" />
          </svg>
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#1B1F23]">{horse.name || 'Pferd'}</h1>
          <p className="mt-0.5 text-[13px] text-[#6B7280]">
            {[horse.breed, horse.sex, age != null ? `${age} J.` : null, customer?.name, customer?.stable_name]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* Success banner */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-3.5">
        <i className="bi bi-check-circle-fill text-[16px] text-[#16A34A]" aria-hidden />
        <span className="text-[13px] font-medium text-[#166534]">
          Dokumentation abgeschlossen
          {record.created_at && (
            <span className="font-normal text-[#4B7B5B]"> · Erstellt am {formatGermanDatetime(record.created_at)}</span>
          )}
        </span>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_296px]">
        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* Section 1: Allgemeiner Eindruck */}
          {hasGeneralData && (
            <SectionCard title={`${nextSection()}. Allgemeiner Eindruck`}>
              <div>
                {record.general_condition && (
                  <LabelValueRow label="Allgemeinzustand" value={record.general_condition} color={gcColor(record.general_condition)} />
                )}
                {record.gait && (
                  <LabelValueRow label="Gangbild" value={record.gait} color={gaitColor(record.gait)} />
                )}
                {record.handling_behavior && (
                  <LabelValueRow label="Verhalten" value={record.handling_behavior} color={handlingColor(record.handling_behavior)} />
                )}
                {record.horn_quality && (
                  <LabelValueRow label="Hornqualität" value={record.horn_quality} color={hornColor(record.horn_quality)} />
                )}
              </div>
            </SectionCard>
          )}

          {/* Section 2: Hufbefund */}
          {hoofs.length > 0 && (() => {
            const vl = hoofs.find(h => h.hoof_position === 'vl')
            const vr = hoofs.find(h => h.hoof_position === 'vr')
            const hl = hoofs.find(h => h.hoof_position === 'hl')
            const hr = hoofs.find(h => h.hoof_position === 'hr')

            const statuses = hoofs.map(singleHoofStatus)
            const ov = statuses.includes('critical') ? 'critical' : statuses.includes('warn') ? 'warn' : 'ok'
            const deviating = statuses.filter(s => s !== 'ok').length

            const bannerTitle   = ov === 'critical' ? 'Gesamtbefund: Problematisch' : ov === 'warn' ? 'Gesamtbefund: Behandlungsbedürftig' : 'Gesamtbefund: Unauffällig'
            const bannerSub     = ov === 'ok' ? 'Alle Hufe im Normalzustand · Keine Abweichungen festgestellt' : `Abweichungen an ${deviating} von ${hoofs.length} Hufen festgestellt`
            const bannerColors  = ov === 'critical'
              ? { bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', dot: 'bg-[#EF4444]', title: 'text-[#991B1B]', sub: 'text-[#B91C1C]' }
              : ov === 'warn'
              ? { bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', dot: 'bg-[#EAB308]', title: 'text-[#92400E]', sub: 'text-[#B45309]' }
              : { bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', dot: 'bg-[#22C55E]', title: 'text-[#166534]', sub: 'text-[#4B7B5B]' }

            return (
              <SectionCard title={`${nextSection()}. Hufbefund`}>
                <div className="p-5 space-y-4">
                  {/* Status banner */}
                  <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${bannerColors.bg} ${bannerColors.border}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${bannerColors.dot}`} />
                    <div>
                      <p className={`text-[13px] font-semibold ${bannerColors.title}`}>{bannerTitle}</p>
                      <p className={`text-[12px] ${bannerColors.sub}`}>{bannerSub}</p>
                    </div>
                  </div>
                  {/* VORNE */}
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C4BFB8]">
                    <div className="h-px flex-1 bg-[#E5E2DC]" />
                    <span>— VORNE —</span>
                    <div className="h-px flex-1 bg-[#E5E2DC]" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {vl && <HoofCard hoof={vl} />}
                    {vr && <HoofCard hoof={vr} />}
                  </div>
                  {/* HINTEN */}
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C4BFB8]">
                    <div className="h-px flex-1 bg-[#E5E2DC]" />
                    <span>— HINTEN —</span>
                    <div className="h-px flex-1 bg-[#E5E2DC]" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {hl && <HoofCard hoof={hl} />}
                    {hr && <HoofCard hoof={hr} />}
                  </div>
                </div>
              </SectionCard>
            )
          })()}

          {/* Section 3: Fotodokumentation */}
          <SectionCard
            title={`${nextSection()}. Fotodokumentation`}
            titleRight={
              <span className="text-[12px] text-[#9CA3AF]">
                {photoCount} von {photoSlots.length} Fotos
              </span>
            }
          >
            <div className="p-5 space-y-5">
              {/* Solar */}
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#9CA3AF]">
                  Sohlenansicht (Solar)
                </p>
                <div className="grid grid-cols-4 gap-2.5">
                  {SLOT_SOLAR.map((slot) => (
                    <PhotoSlot key={slot} label={SLOT_LABELS[slot] ?? slot} signedUrl={photoMap[slot] ?? null} meta={photoMetaMap[slot] ?? null} />
                  ))}
                </div>
              </div>
              {/* Lateral */}
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#9CA3AF]">
                  Seitenansicht (Lateral)
                </p>
                <div className="grid grid-cols-4 gap-2.5">
                  {SLOT_LATERAL.map((slot) => (
                    <PhotoSlot key={slot} label={SLOT_LABELS[slot] ?? slot} signedUrl={photoMap[slot] ?? null} meta={photoMetaMap[slot] ?? null} />
                  ))}
                </div>
              </div>
              {photoCount === 0 && (
                <p className="text-center text-[13px] text-[#C4BFB8]">Noch keine Fotos aufgenommen</p>
              )}
            </div>
          </SectionCard>

          {/* Section 4: Maßnahmen & Beobachtungen */}
          {hasSummary && (
            <SectionCard title={`${nextSection()}. Maßnahmen & Beobachtungen`}>
              <div
                className="px-5 py-5 text-[14px] leading-7 text-[#374151] [&_strong]:font-semibold [&_strong]:text-[#1B1F23] [&_b]:font-semibold [&_b]:text-[#1B1F23] [&_p]:mb-3 [&_p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: sanitiseHtml(record.hoof_condition!) }}
              />
            </SectionCard>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Aktionen */}
          <div className="overflow-hidden rounded-2xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="border-b border-[#E5E2DC] px-5 py-4">
              <h3 className="text-[14px] font-semibold text-[#1B1F23]">Aktionen</h3>
            </div>
            <div className="space-y-2 p-4">
              <a
                href={`/horses/${horseId}/records/${recordId}/pdf`}
                download
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#52b788] px-4 py-3 text-[13px] font-semibold !text-white transition hover:bg-[#0f301b]"
              >
                <i className="bi bi-file-earmark-pdf text-[15px]" aria-hidden />
                PDF herunterladen
              </a>
              <a
                href={`/horses/${horseId}/records/${recordId}/pdf?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E2DC] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1B1F23] transition hover:border-[#9CA3AF]"
              >
                <i className="bi bi-envelope text-[14px]" aria-hidden />
                Per E-Mail senden
              </a>
              <Link
                href={`/horses/${horseId}/records/${recordId}/edit`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E2DC] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1B1F23] transition hover:border-[#9CA3AF]"
              >
                <i className="bi bi-pencil-square text-[14px]" aria-hidden />
                Bearbeiten
              </Link>
              <DeleteRecordForm action={deleteRecordForId} />
            </div>
          </div>

          {/* Termin-Details */}
          <div className="overflow-hidden rounded-2xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="border-b border-[#E5E2DC] px-5 py-4">
              <h3 className="text-[14px] font-semibold text-[#1B1F23]">Termin-Details</h3>
            </div>
            <div className="divide-y divide-[#F0EDEA]">
              <SidebarRow label="Datum"     value={formatGermanDate(record.record_date)} />
              <SidebarRow label="Terminart" value={record.record_type ?? 'Regeltermin'} />
              {customer?.name && (
                <SidebarRow label="Besitzer/in" value={customer.name} />
              )}
              {customer?.stable_name && (
                <SidebarRow label="Stall" value={customer.stable_name} />
              )}
              {prevRecord && (
                <div className="flex items-center gap-2 px-5 py-3">
                  <i className="bi bi-clock text-[12px] text-[#9CA3AF]" aria-hidden />
                  <span className="text-[12px] text-[#9CA3AF]">
                    Vorheriger Termin:{' '}
                    <Link
                      href={`/horses/${horseId}/records/${prevRecord.id}`}
                      className="font-medium text-[#52b788] hover:underline"
                    >
                      {formatGermanDate(prevRecord.record_date)}
                    </Link>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dokument-ID */}
          <div className="overflow-hidden rounded-2xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="px-5 py-4 space-y-1.5">
              <p className="text-[13px] font-semibold text-[#1B1F23]">Dokument-ID</p>
              <p className="text-[13px] font-mono text-[#6B7280]">{docNumber}</p>
              {record.created_at && (
                <p className="text-[12px] text-[#9CA3AF]">
                  Erstellt: {formatGermanDatetime(record.created_at)}
                </p>
              )}
              <p className="text-[12px] text-[#9CA3AF]">
                Zuletzt bearbeitet: {record.updated_at ? formatGermanDatetime(record.updated_at) : '–'}
              </p>
              {customer?.customer_number != null && (
                <p className="text-[12px] text-[#9CA3AF]">
                  Kunden-Nr.: {formatCustomerNumber(customer.customer_number)}
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link
          href={`/horses/${horseId}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E5E2DC] px-4 py-2 text-[13px] font-medium text-[#1B1F23] hover:border-[#52b788] hover:bg-[#edf3ef]"
        >
          <i className="bi bi-arrow-left text-[13px]" aria-hidden />
          Zurück zum Pferd
        </Link>
      </div>
    </main>
  )
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-[12px] text-[#9CA3AF]">{label}</span>
      <span className="text-[13px] font-medium text-[#1B1F23]">{value}</span>
    </div>
  )
}
