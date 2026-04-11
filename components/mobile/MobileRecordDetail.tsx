'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { deleteDocumentationRecordByLegacyHoofId } from '@/lib/documentation/mirrorDocumentationPhotos'
import {
  loadRecordDetailFromDocumentation,
  recordDetailHoofRecordToMobileRecord,
  type MobileRecordDetailState,
} from '@/lib/documentation/loadRecordForDetailView'
import { SLOT_SOLAR, SLOT_LATERAL, SLOT_LABELS, toCanonicalPhotoSlot } from '@/lib/photos/photoTypes'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'
import { parseAnnotationsJson } from '@/lib/photos/annotations'
import type { AnnotationsData } from '@/lib/photos/annotations'
import { sanitizeUserHtml } from '@/lib/sanitizeUserHtml'

// ─── Types ────────────────────────────────────────────────────────────────────

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  customer_id?: string | null
  stable_name?: string | null
  customers?: { name: string | null } | null
}

type HoofEntry = {
  hoof_position: string
  toe_alignment?: string | null
  heel_balance?: string | null
  frog_condition?: string | null
  sole_condition?: string | null
}

/** Alias: gemeinsames Mapping mit Desktop (loadRecordForDetailView). */
type MrdRecord = MobileRecordDetailState

type HoofPhoto = {
  id: string
  file_path: string
  photo_type: string
  annotations_json?: unknown
  width?: number | null
  height?: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d).replace(',', ' um')
}

function parseHoofs(json: unknown): HoofEntry[] {
  if (!json || !Array.isArray(json)) return []
  return (json as HoofEntry[]).filter(h => ['vl','vr','hl','hr'].includes(h.hoof_position))
}

function hoofStatus(h: HoofEntry): 'ok' | 'warn' | 'critical' {
  if (h.frog_condition === 'faulig') return 'critical'
  const ok =
    (!h.toe_alignment  || h.toe_alignment  === 'gerade') &&
    (!h.heel_balance   || ['normal','ausgeglichen'].includes(h.heel_balance)) &&
    (!h.sole_condition || h.sole_condition === 'stabil') &&
    (!h.frog_condition || h.frog_condition === 'gesund')
  return ok ? 'ok' : 'warn'
}

function overallStatus(hoofs: HoofEntry[]): 'ok' | 'warn' | 'critical' {
  const statuses = hoofs.map(hoofStatus)
  if (statuses.includes('critical')) return 'critical'
  if (statuses.includes('warn')) return 'warn'
  return 'ok'
}

function gcColor(v: string | null): 'green' | 'yellow' | 'red' | 'neutral' {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('unauffällig')) return 'green'
  if (l.includes('auffällig'))   return 'red'
  return 'neutral'
}
function gaitColor(v: string | null): 'green' | 'yellow' | 'red' | 'neutral' {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('taktrein'))  return 'green'
  if (l.includes('lahm'))      return 'red'
  if (l.includes('ungleich'))  return 'yellow'
  return 'neutral'
}
function handlingColor(v: string | null): 'green' | 'yellow' | 'red' | 'neutral' {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('kooperativ'))    return 'green'
  if (l.includes('widersetzlich')) return 'red'
  if (l.includes('unruhig'))       return 'yellow'
  return 'neutral'
}
function hornColor(v: string | null): 'green' | 'yellow' | 'red' | 'neutral' {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('stabil') || l.includes('gut')) return 'green'
  return 'yellow'
}

const DOT: Record<string, string> = {
  green:   '#22C55E',
  yellow:  '#EAB308',
  red:     '#EF4444',
  neutral: '#9CA3AF',
}
const VAL_CLS: Record<string, string> = {
  green:   'mrd-val-green',
  yellow:  'mrd-val-yellow',
  red:     'mrd-val-red',
  neutral: '',
}

function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return !!html.replace(/<[^>]+>/g,'').replace(/&nbsp;/gi,'').trim()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="mrd-d-row">
      <span className="mrd-d-label">{label}</span>
      <span className={`mrd-d-value ${VAL_CLS[color] ?? ''}`}>
        <span className="mrd-d-dot" style={{ background: DOT[color] ?? DOT.neutral }} />
        {value}
      </span>
    </div>
  )
}

function HoofAccordion({ hoof }: { hoof: HoofEntry }) {
  const [open, setOpen] = useState(false)
  const st = hoofStatus(hoof)
  const LABELS: Record<string, string> = {
    vl: 'VL — Vorne Links', vr: 'VR — Vorne Rechts',
    hl: 'HL — Hinten Links', hr: 'HR — Hinten Rechts',
  }
  const badge = st === 'critical'
    ? { text: 'Kritisch', cls: 'mrd-badge-crit' }
    : st === 'warn'
      ? { text: 'Abweichung', cls: 'mrd-badge-warn' }
      : { text: 'Unauffällig', cls: 'mrd-badge-ok' }
  const dotCls = st === 'critical' ? 'ha-dot crit' : st === 'warn' ? 'ha-dot warn' : 'ha-dot'

  const rows = [
    { label: 'Zehe',     val: hoof.toe_alignment },
    { label: 'Trachten', val: hoof.heel_balance },
    { label: 'Strahl',   val: hoof.frog_condition },
    { label: 'Sohle',    val: hoof.sole_condition },
  ]

  return (
    <div className={`ha-item${st === 'critical' ? ' has-issue' : ''}${open ? ' open' : ''}`}>
      <div className="ha-header" onClick={() => setOpen(o => !o)}>
        <span className={dotCls} />
        <span className="ha-title">{LABELS[hoof.hoof_position] ?? hoof.hoof_position}</span>
        <span className={`ha-badge ${badge.cls}`}>{badge.text}</span>
        <svg className="ha-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && (
        <div className="ha-body" style={{ maxHeight: 300, padding: '6px 14px 14px' }}>
          {rows.map(({ label, val }) => (
            <div key={label} className="hf-row">
              <span className="hf-label">{label}</span>
              <span className={`hf-value${val === 'faulig' ? ' critical' : ''}`}>{val ?? '–'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoSlotView({
  slot, photoUrl, annotations, imgWidth, imgHeight,
}: {
  slot: PhotoSlotKey
  photoUrl?: string | null
  annotations?: AnnotationsData
  imgWidth: number
  imgHeight: number
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const label = SLOT_LABELS[slot] ?? slot

  return (
    <>
      <div
        className={`photo-slot${photoUrl ? ' has-photo' : ''}`}
        onClick={() => photoUrl && setLightboxOpen(true)}
        style={{ cursor: photoUrl ? 'zoom-in' : 'default' }}
      >
        {photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={label} className="absolute inset-0 h-full w-full object-cover" style={{ borderRadius: 6 }} />
            {annotations && annotations.items.length > 0 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${imgWidth} ${imgHeight}`} preserveAspectRatio="xMidYMid meet">
                {annotations.items.map((item, idx) => {
                  if ((item.type === 'line' || item.type === 'axis') && item.points?.length >= 2) {
                    const [a, b] = item.points
                    return <line key={idx} x1={a.x*imgWidth} y1={a.y*imgHeight} x2={b.x*imgWidth} y2={b.y*imgHeight} stroke="#fff" strokeWidth={3} />
                  }
                  if (item.type === 'stroke' && item.points?.length >= 2) {
                    const d = item.points.map((p,i)=>`${i===0?'M':'L'} ${p.x*imgWidth} ${p.y*imgHeight}`).join(' ')
                    return <path key={idx} d={d} fill="none" stroke={item.color??'#fff'} strokeWidth={3} strokeLinecap="round" />
                  }
                  return null
                })}
              </svg>
            )}
            <span className="ps-badge">✓</span>
            <span className="ps-label" style={{ position: 'relative', zIndex: 1 }}>{label}</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 18, height: 18 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="ps-label">{label}</span>
          </>
        )}
      </div>

      {lightboxOpen && photoUrl && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} width={20} height={20}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="absolute left-4 top-4 rounded-xl bg-white/20 px-3 py-1.5 text-[13px] font-medium text-white">{label}</p>
          <div
            className="relative max-h-[calc(100dvh-5rem)] w-auto"
            style={{ aspectRatio: `${imgWidth}/${imgHeight}` }}
            onClick={e => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={label} className="h-full w-full rounded-xl object-contain" />
            {annotations && annotations.items.length > 0 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${imgWidth} ${imgHeight}`} preserveAspectRatio="xMidYMid meet">
                {annotations.items.map((item, idx) => {
                  if ((item.type === 'line' || item.type === 'axis') && item.points?.length >= 2) {
                    const [a,b] = item.points
                    return <line key={idx} x1={a.x*imgWidth} y1={a.y*imgHeight} x2={b.x*imgWidth} y2={b.y*imgHeight} stroke="#fff" strokeWidth={3} />
                  }
                  if (item.type==='stroke' && item.points?.length>=2) {
                    const d=item.points.map((p,i)=>`${i===0?'M':'L'} ${p.x*imgWidth} ${p.y*imgHeight}`).join(' ')
                    return <path key={idx} d={d} fill="none" stroke={item.color??'#fff'} strokeWidth={3} strokeLinecap="round"/>
                  }
                  return null
                })}
              </svg>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MobileRecordDetail({ horseId, recordId }: { horseId: string; recordId: string }) {
  const router = useRouter()
  const [horse, setHorse] = useState<Horse | null>(null)
  const [record, setRecord] = useState<MrdRecord | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Partial<Record<PhotoSlotKey, string>>>({})
  const [photoMeta, setPhotoMeta] = useState<Partial<Record<PhotoSlotKey, { annotations: AnnotationsData; width: number; height: number }>>>({})
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const [horseRes, docLoad] = await Promise.all([
      supabase
        .from('horses')
        .select('id,name,breed,sex,birth_year,customer_id,stable_name')
        .eq('id', horseId)
        .eq('user_id', user.id)
        .maybeSingle(),
      loadRecordDetailFromDocumentation(supabase, user.id, horseId, recordId),
    ])

    const { data: horseData } = horseRes

    let horseWithCustomer: Horse | null = null
    if (horseData) {
      const cid = (horseData as { customer_id?: string | null }).customer_id
      if (cid) {
        const { data: cust } = await supabase
          .from('customers')
          .select('name')
          .eq('id', cid)
          .eq('user_id', user.id)
          .maybeSingle()
        horseWithCustomer = { ...(horseData as Horse), customers: cust ?? null }
      } else {
        horseWithCustomer = horseData as Horse
      }
    }
    if (horseWithCustomer) setHorse(horseWithCustomer)

    type PhotoRow = {
      file_path: string | null
      photo_type: string | null
      annotations_json?: unknown
      width?: number | null
      height?: number | null
    }

    let photoRows: PhotoRow[] = []
    let usedDocumentation = false

    if (docLoad.ok) {
      usedDocumentation = true
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.info('[mobile-record-detail] Quelle: documentation_*', { recordId })
      }
      setRecord(recordDetailHoofRecordToMobileRecord(docLoad.record))
      photoRows = docLoad.photos
    } else {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[mobile-record-detail] Fallback: hoof_*', { recordId, reason: docLoad.reason })
      }

      const { data: rec } = await supabase
        .from('hoof_records')
        .select('id,record_date,record_type,general_condition,gait,handling_behavior,horn_quality,hoofs_json,hoof_condition,notes,created_at,updated_at')
        .eq('id', recordId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!rec) {
        setRecord(null)
        setPhotoUrls({})
        setPhotoMeta({})
        setLoading(false)
        return
      }

      const r = rec as MrdRecord & { hoof_condition?: string | null }
      setRecord({ ...r, summary_notes: r.hoof_condition ?? null } as MrdRecord)

      const { data: photos } = await supabase
        .from('hoof_photos')
        .select('id,file_path,photo_type,annotations_json,width,height')
        .eq('hoof_record_id', recordId)
        .eq('user_id', user.id)

      photoRows = (photos ?? []) as PhotoRow[]
    }

    const fillSlotsFromPhotoRows = async (rows: PhotoRow[]) => {
      if (!rows.length) {
        setPhotoUrls({})
        setPhotoMeta({})
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current)
          retryTimerRef.current = null
        }
        retryTimerRef.current = setTimeout(async () => {
          const { data: { user: u } } = await supabase.auth.getUser()
          if (!u) return
          if (usedDocumentation) {
            const again = await loadRecordDetailFromDocumentation(supabase, u.id, horseId, recordId)
            if (again.ok && again.photos.length) {
              const urls: Partial<Record<PhotoSlotKey, string>> = {}
              const meta: Partial<Record<PhotoSlotKey, { annotations: AnnotationsData; width: number; height: number }>> = {}
              for (const p of again.photos) {
                if (!p.file_path || !p.photo_type) continue
                const slot = toCanonicalPhotoSlot(p.photo_type)
                if (!slot) continue
                const { data: s, error: urlErr } = await supabase.storage.from('hoof-photos').createSignedUrl(p.file_path, 3600)
                if (urlErr) console.warn('[Fotos] Signed URL fehlgeschlagen:', p.file_path, urlErr.message)
                if (s?.signedUrl) urls[slot] = s.signedUrl
                if (p.annotations_json && slot) {
                  meta[slot] = {
                    annotations: parseAnnotationsJson(p.annotations_json),
                    width: p.width ?? 900,
                    height: p.height ?? 1600,
                  }
                }
              }
              setPhotoUrls(urls)
              setPhotoMeta(meta)
            }
          } else {
            const { data: retryPhotos } = await supabase
              .from('hoof_photos')
              .select('id,file_path,photo_type,annotations_json,width,height')
              .eq('hoof_record_id', recordId)
              .eq('user_id', u.id)
            if (retryPhotos?.length) {
              const urls: Partial<Record<PhotoSlotKey, string>> = {}
              const meta: Partial<Record<PhotoSlotKey, { annotations: AnnotationsData; width: number; height: number }>> = {}
              for (const p of retryPhotos as HoofPhoto[]) {
                if (!p.file_path || !p.photo_type) continue
                const slot = toCanonicalPhotoSlot(p.photo_type)
                if (!slot) continue
                const { data: s, error: urlErr } = await supabase.storage.from('hoof-photos').createSignedUrl(p.file_path, 3600)
                if (urlErr) console.warn('[Fotos] createSignedUrl (Retry) fehlgeschlagen:', p.file_path, urlErr.message)
                if (s?.signedUrl) urls[slot] = s.signedUrl
                if (p.annotations_json) {
                  meta[slot] = {
                    annotations: parseAnnotationsJson(p.annotations_json),
                    width: p.width ?? 900,
                    height: p.height ?? 1600,
                  }
                }
              }
              setPhotoUrls(urls)
              setPhotoMeta(meta)
            }
          }
        }, 2000)
        return
      }

      const urls: Partial<Record<PhotoSlotKey, string>> = {}
      const meta: Partial<Record<PhotoSlotKey, { annotations: AnnotationsData; width: number; height: number }>> = {}
      for (const p of rows) {
        if (!p.file_path || !p.photo_type) continue
        const slot = toCanonicalPhotoSlot(p.photo_type)
        if (!slot) continue
        const { data: s, error: urlErr } = await supabase.storage.from('hoof-photos').createSignedUrl(p.file_path, 3600)
        if (urlErr) console.warn('[Fotos] Signed URL fehlgeschlagen:', p.file_path, urlErr.message)
        if (s?.signedUrl) urls[slot] = s.signedUrl
        if (p.annotations_json && slot) {
          meta[slot] = {
            annotations: parseAnnotationsJson(p.annotations_json),
            width: p.width ?? 900,
            height: p.height ?? 1600,
          }
        }
      }
      setPhotoUrls(urls)
      setPhotoMeta(meta)
    }

    await fillSlotsFromPhotoRows(photoRows)
    setLoading(false)
  }, [horseId, recordId])

  useEffect(() => {
    load()
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [load])

  async function handleDelete() {
    if (!confirm('Dokumentation wirklich löschen?')) return
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: photos } = await supabase.from('hoof_photos').select('file_path').eq('hoof_record_id', recordId).eq('user_id', user.id)
    if (photos?.length) {
      const paths = photos.map(p => p.file_path).filter(Boolean) as string[]
      if (paths.length) await supabase.storage.from('hoof-photos').remove(paths)
      await supabase.from('hoof_photos').delete().eq('hoof_record_id', recordId).eq('user_id', user.id)
    }
    await deleteDocumentationRecordByLegacyHoofId(supabase, recordId, user.id)
    await supabase.from('hoof_records').delete().eq('id', recordId).eq('user_id', user.id)
    router.push(`/animals/${horseId}`)
  }

  async function handlePdfDownload() {
    window.open(`/animals/${horseId}/records/${recordId}/pdf`, '_blank')
  }

  async function handleEmail() {
    window.open(`/animals/${horseId}/records/${recordId}?email=1`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60dvh' }}>
        <div className="preloader-logo-wrap" style={{ width: 48, height: 48 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width={48} height={48}>
            <path fill="#52b788" d="M116.74 178.5H63.26c-33.97 0-61.76-27.79-61.76-61.76V63.26C1.5 29.29 29.29 1.5 63.26 1.5h53.48c33.97 0 61.76 27.79 61.76 61.76v53.48c0 33.97-27.79 61.76-61.76 61.76"/>
            <path fill="#111" d="M96.5 74.06v3.23c-1.22-1.03-2.6-1.91-4.16-2.59-2.51-1.09-5.29-1.64-8.33-1.64-4.5 0-8.49 1.08-12 3.22-3.5 2.15-6.25 5.14-8.23 8.97s-2.97 8.2-2.97 13.09c0 4.83.99 9.14 2.97 12.94s4.72 6.79 8.23 8.97q5.25 3.27 12 3.27c3.04 0 5.81-.56 8.33-1.69 1.57-.7 2.94-1.59 4.16-2.61v3.3h16.95V74.06zm-8.83 34.11q-2.67 0-4.86-1.29a8.85 8.85 0 0 1-3.37-3.52c-.79-1.48-1.19-3.19-1.19-5.1 0-1.85.41-3.52 1.24-5.01a9.27 9.27 0 0 1 3.37-3.52c1.42-.86 3.06-1.29 4.91-1.29s3.48.43 4.91 1.29A9.07 9.07 0 0 1 96 93.2c.79 1.45 1.19 3.14 1.19 5.05 0 2.91-.88 5.29-2.63 7.14s-4.05 2.78-6.89 2.78"/>
          </svg>
        </div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center" style={{ minHeight: '60dvh' }}>
        <p className="text-[15px] font-semibold text-[#1B1F23]">Dokumentation nicht gefunden</p>
        <button type="button" onClick={() => router.back()} className="text-[13px] text-[#52b788] underline">Zurück</button>
      </div>
    )
  }

  const customer = Array.isArray(horse?.customers) ? horse?.customers[0] : horse?.customers
  const hoofs = parseHoofs(record.hoofs_json)
  const overall = overallStatus(hoofs)
  const allOk = hoofs.length > 0 && overall === 'ok'
  const photoCount = [...SLOT_SOLAR, ...SLOT_LATERAL].filter(s => photoUrls[s]).length
  const docNumber = record.doc_number ?? `DOK-${record.record_date ? new Date(record.record_date).getFullYear() : new Date().getFullYear()}-${recordId.replace(/-/g,'').slice(-4).toUpperCase()}`

  return (
    <div className="mrd-root">
      <div className="status-bar" aria-hidden />
      {/* HEADER – wie Dokumentations-Erstellungsseite */}
      <header className="mobile-header">
        <div className="cd-hero">
          <div className="cd-info min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="cd-name">{horse?.name ?? '–'}</div>
              <span className="mrd-done-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={12} height={12} style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Fertig dokumentiert
              </span>
            </div>
            <div className="cd-meta">
              {[horse?.breed, horse?.sex === 'male' ? 'Hengst' : horse?.sex === 'female' ? 'Stute' : horse?.sex === 'gelding' ? 'Wallach' : horse?.sex, horse?.birth_year ? `${new Date().getFullYear() - horse.birth_year} J.` : null, customer?.name, horse?.stable_name].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      </header>

      {/* ACTION ROW – wie Erstellungsseite (Bearbeiten + Löschen) */}
      <div className="cd-action-row flex gap-2">
        <button type="button" className="cd-action-btn flex flex-1 items-center justify-center gap-1.5" onClick={() => router.push(`/animals/${horseId}/records/${recordId}/edit`)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={15} height={15}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Bearbeiten
        </button>
        <button type="button" className="cd-action-btn flex flex-1 items-center justify-center gap-1.5 cd-action-btn--danger" onClick={handleDelete} disabled={deleting}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={15} height={15}>
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          {deleting ? 'Löschen…' : 'Löschen'}
        </button>
      </div>

      {/* Weißer Bereich: Per E-Mail + PDF */}
      <div className="mrd-actions-light">
        <button type="button" className="mrd-act-light" onClick={handleEmail}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Per E-Mail senden
        </button>
        <button type="button" className="mrd-act-light primary" onClick={handlePdfDownload}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          PDF herunterladen
        </button>
      </div>

      {/* CONTENT */}
      <div className="mrd-content">

        {/* 1. ALLGEMEINER EINDRUCK */}
        {(record.general_condition || record.gait || record.handling_behavior || record.horn_quality) && (
          <div className="mrd-section">
            <div className="mrd-s-header"><h3>1. Allgemeiner Eindruck</h3></div>
            <div className="mrd-s-body">
              {record.general_condition && <DRow label="Allgemeinzustand" value={record.general_condition} color={gcColor(record.general_condition)} />}
              {record.gait && <DRow label="Gangbild" value={record.gait} color={gaitColor(record.gait)} />}
              {record.handling_behavior && <DRow label="Verhalten" value={record.handling_behavior} color={handlingColor(record.handling_behavior)} />}
              {record.horn_quality && <DRow label="Hornqualität" value={record.horn_quality} color={hornColor(record.horn_quality)} />}
            </div>
          </div>
        )}

        {/* 2. HUFBEFUND */}
        {hoofs.length > 0 && (
          <div className="mrd-section">
            <div className="mrd-s-header"><h3>2. Hufbefund</h3></div>
            <div className="mrd-s-body">
              {/* Status banner */}
              {allOk ? (
                <div className="mrd-status-banner ok">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={16} height={16} style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <div>
                    <div>Alle Hufe unauffällig</div>
                    <div className="mrd-sb-sub">Keine Auffälligkeiten festgestellt</div>
                  </div>
                </div>
              ) : overall === 'critical' ? (
                <div className="mrd-status-banner critical">
                  <span className="mrd-sb-dot" />
                  <div>
                    <div>Gesamtbefund: Problematisch</div>
                    <div className="mrd-sb-sub">Abweichungen an {hoofs.filter(h => hoofStatus(h) !== 'ok').length} von {hoofs.length} Hufen</div>
                  </div>
                </div>
              ) : (
                <div className="mrd-status-banner warn">
                  <span className="mrd-sb-dot" />
                  <div>
                    <div>Gesamtbefund: Abweichungen</div>
                    <div className="mrd-sb-sub">Abweichungen an {hoofs.filter(h => hoofStatus(h) !== 'ok').length} von {hoofs.length} Hufen</div>
                  </div>
                </div>
              )}
              {hoofs.map(h => <HoofAccordion key={h.hoof_position} hoof={h} />)}
            </div>
          </div>
        )}

        {/* 3. MAßNAHMEN */}
        {hasContent(record.summary_notes) && (
          <div className="mrd-section">
            <div className="mrd-s-header"><h3>3. Maßnahmen &amp; Beobachtungen</h3></div>
            <div className="mrd-s-body">
              <div
                className="mrd-rich-text"
                dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(record.summary_notes!) }}
              />
            </div>
          </div>
        )}

        {/* 4. FOTODOKUMENTATION */}
        <div className="mrd-section">
          <div className="mrd-s-header">
            <h3>4. Fotodokumentation</h3>
            <span className="mrd-s-badge">{photoCount} von 8</span>
            {photoCount === 0 && (
              <button
                type="button"
                onClick={() => load()}
                className="mrd-refresh-photos"
                style={{ marginLeft: 'auto', fontSize: 12, color: '#52b788', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Fotos aktualisieren
              </button>
            )}
          </div>
          <div className="mrd-s-body">
            <div className="photo-label">Sohlenansicht (Solar)</div>
            <div className="photo-grid">
              {SLOT_SOLAR.map(slot => (
                <PhotoSlotView
                  key={slot} slot={slot}
                  photoUrl={photoUrls[slot]}
                  annotations={photoMeta[slot]?.annotations}
                  imgWidth={photoMeta[slot]?.width ?? 900}
                  imgHeight={photoMeta[slot]?.height ?? 1600}
                />
              ))}
            </div>
            <div className="photo-label">Seitenansicht (Lateral)</div>
            <div className="photo-grid">
              {SLOT_LATERAL.map(slot => (
                <PhotoSlotView
                  key={slot} slot={slot}
                  photoUrl={photoUrls[slot]}
                  annotations={photoMeta[slot]?.annotations}
                  imgWidth={photoMeta[slot]?.width ?? 900}
                  imgHeight={photoMeta[slot]?.height ?? 1600}
                />
              ))}
            </div>
          </div>
        </div>

        {/* TERMIN-DETAILS */}
        <div className="mrd-section">
          <div className="mrd-s-header"><h3>Termin-Details</h3></div>
          <div className="mrd-s-body">
            <div className="mrd-td-row"><span className="mrd-td-label">Datum</span><span className="mrd-td-value">{fmtDate(record.record_date)}</span></div>
            {record.record_type && <div className="mrd-td-row"><span className="mrd-td-label">Terminart</span><span className="mrd-td-value">{record.record_type}</span></div>}
            {customer?.name && <div className="mrd-td-row"><span className="mrd-td-label">Besitzer/in</span><span className="mrd-td-value">{customer.name}</span></div>}
            {horse?.stable_name && <div className="mrd-td-row"><span className="mrd-td-label">Stall</span><span className="mrd-td-value">{horse.stable_name}</span></div>}
          </div>
        </div>

        {/* DOKUMENT-ID */}
        <div className="mrd-section">
          <div className="mrd-s-header"><h3>Dokument-ID</h3></div>
          <div className="mrd-s-body">
            <div className="mrd-dok-info">
              <strong>{docNumber}</strong><br />
              Erstellt: {fmtDatetime(record.created_at)}<br />
              {record.updated_at && record.updated_at !== record.created_at && <>Zuletzt bearbeitet: {fmtDatetime(record.updated_at)}<br /></>}
            </div>
          </div>
        </div>

        {/* ZURÜCK */}
        <button type="button" className="mrd-back" onClick={() => router.push(`/animals/${horseId}`)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Zurück zum Pferd
        </button>

      </div>
    </div>
  )
}
