/**
 * HTML-Export im Aufbau wie der Befund-PDF-Bericht (RecordPdfDocument), inkl. Fotos per relativem Pfad.
 */

import type { RecordHtmlExportPayload } from '@/lib/pdf/recordData'
import type { RecordPdfHoof } from '@/lib/pdf/types'
import {
  labelAnimalType,
  labelDocumentationKind,
  labelSessionType,
  labelTherapyDiscipline,
} from '@/lib/export/exportLabels'
import { formatGermanDate } from '@/lib/format'
import { SLOT_LATERAL, SLOT_LABELS, SLOT_SOLAR } from '@/lib/photos/photoTypes'
import type { RecordPdfSeller } from '@/lib/pdf/types'

/** Relativer img-src von `05_Dokumentationen/HTML/` zu `06_Fotos/Bilder/` (Export-Plan). */
export function buildPhotoHrefMapForDocumentationRecord(
  docId: string,
  documentationPhotos: Record<string, unknown>[],
  pathToZipRel: Map<string, string>
): Map<string, string | null> {
  const m = new Map<string, string | null>()
  for (const p of documentationPhotos) {
    if ((p.documentation_record_id as string) !== docId) continue
    const fp = (p.file_path as string | null)?.trim()
    const pt = p.photo_type as string | null
    if (!fp || !pt) continue
    const zipRel = pathToZipRel.get(fp)
    m.set(pt, zipRel ? `../../${zipRel.replace(/\\/g, '/')}` : null)
  }
  return m
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function htmlFragmentFromContent(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  const t = String(s).trim()
  if (!t) return ''
  if (/<[a-z][\s\S]*>/i.test(t)) return t
  return `<p>${escapeHtml(t).replace(/\n/g, '<br>\n')}</p>`
}

const C = {
  brand: '#52b788',
  text: '#1C1C1C',
  textSecondary: '#555555',
  textLight: '#888888',
  border: '#D8D5D0',
  bgSubtle: '#FAFAF8',
  ok: '#2D5A2D',
  okBg: '#F2F8F2',
  okBorder: '#C0D8C0',
  warn: '#B8860B',
  warnBg: '#FDF6EC',
  warnBorder: '#E8D5B0',
  danger: '#9B2C2C',
  dangerBg: '#FDF2F2',
  dangerBorder: '#E8B0B0',
}

const HOOF_STANDARD = {
  toe: 'gerade',
  heel: ['normal', 'ausgeglichen'] as string[],
  sole: 'stabil',
  frog: 'gesund',
}

function hoofStatus(h: RecordPdfHoof): 'ok' | 'warn' | 'critical' {
  if (h.frogCondition === 'faulig') return 'critical'
  const ok =
    (!h.toeAlignment || h.toeAlignment === HOOF_STANDARD.toe) &&
    (!h.heelBalance || HOOF_STANDARD.heel.includes(h.heelBalance)) &&
    (!h.soleCondition || h.soleCondition === HOOF_STANDARD.sole) &&
    (!h.frogCondition || h.frogCondition === HOOF_STANDARD.frog)
  return ok ? 'ok' : 'warn'
}

function overallStatus(hoofs: RecordPdfHoof[]): 'ok' | 'warn' | 'critical' {
  if (!hoofs.length) return 'ok'
  if (hoofs.some((h) => hoofStatus(h) === 'critical')) return 'critical'
  if (hoofs.some((h) => hoofStatus(h) === 'warn')) return 'warn'
  return 'ok'
}

type DotColor = 'green' | 'yellow' | 'red' | 'neutral'

function gcColor(v: string | null): DotColor {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('unauffällig') || l === 'gut') return 'green'
  if (l.includes('auffällig')) return 'red'
  return 'neutral'
}
function gaitColor(v: string | null): DotColor {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('taktrein') || l.includes('frei')) return 'green'
  if (l.includes('lahm')) return 'red'
  if (l.includes('ungleich')) return 'yellow'
  return 'neutral'
}
function handlingColor(v: string | null): DotColor {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('kooperativ')) return 'green'
  if (l.includes('unruhig')) return 'yellow'
  if (l.includes('widersetzlich')) return 'red'
  return 'neutral'
}
function hornColor(v: string | null): DotColor {
  if (!v) return 'neutral'
  const l = v.toLowerCase()
  if (l.includes('stabil') || l.includes('gut')) return 'green'
  return 'yellow'
}

const HOOF_LABELS: Record<string, string> = {
  vl: 'VL — Vorne Links',
  vr: 'VR — Vorne Rechts',
  hl: 'HL — Hinten Links',
  hr: 'HR — Hinten Rechts',
}

const HOOF_FIELDS: Array<{ key: keyof RecordPdfHoof; label: string }> = [
  { key: 'toeAlignment', label: 'Zehe' },
  { key: 'heelBalance', label: 'Trachten' },
  { key: 'frogCondition', label: 'Strahl' },
  { key: 'soleCondition', label: 'Sohle' },
]

function formatGermanDateLong(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return String(ds)
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

function hasSummaryText(html: string | null | undefined): boolean {
  if (!html) return false
  return Boolean(
    html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, '')
      .trim()
  )
}

function dotSpan(color: DotColor): string {
  const bg =
    color === 'green'
      ? C.ok
      : color === 'yellow'
        ? C.warn
        : color === 'red'
          ? C.danger
          : C.textLight
  return `<span class="dot" style="background:${bg}"></span>`
}

function valueClass(color: DotColor): string {
  if (color === 'green') return 'val-ok'
  if (color === 'yellow') return 'val-warn'
  if (color === 'red') return 'val-danger'
  return 'val-neutral'
}

/** Wie RecordPdfDocument: Befundbericht mit Kopf, Raster, Banner, Hufe, Maßnahmen, Solar/Lateral-Fotos. */
export function buildBefundberichtExportHtml(payload: RecordHtmlExportPayload): string {
  const { horse, customer, seller, record, photoHrefByType } = payload
  const ov = overallStatus(record.hoofs)
  const hasHoofData = record.hoofs.length > 0
  const allOk = hasHoofData && ov === 'ok'

  const bannerTitle =
    ov === 'critical'
      ? 'Gesamtbefund: Problematisch'
      : ov === 'warn'
        ? 'Gesamtbefund: Behandlungsbedürftig'
        : 'Gesamtbefund: Unauffällig'
  const deviating = record.hoofs.filter((h) => hoofStatus(h) !== 'ok').length
  const bannerSub =
    ov === 'ok'
      ? 'Alle Hufe im Normalzustand · Keine Abweichungen festgestellt'
      : `Abweichungen an ${deviating} von ${record.hoofs.length} Hufen festgestellt`

  const bannerBorder = ov === 'critical' ? C.dangerBorder : ov === 'warn' ? C.warnBorder : C.okBorder
  const bannerBg = ov === 'critical' ? C.dangerBg : ov === 'warn' ? C.warnBg : C.okBg
  const bannerTitleColor = ov === 'critical' ? C.danger : ov === 'warn' ? C.warn : C.ok
  const bannerSubColor = bannerTitleColor

  const horseBreedSex = [horse.breed, horse.sex].filter(Boolean).join(' · ') || '–'
  const horseAge =
    horse.ageYears != null
      ? `${horse.ageYears} Jahre (geb. ${horse.birthYear})`
      : horse.birthYear
        ? `geb. ${horse.birthYear}`
        : '–'
  const stallLocationLine = [customer.stableName, customer.stableCity || customer.city].filter(Boolean).join(', ')

  const hasGeneralData = !!(
    record.generalCondition ||
    record.gait ||
    record.handlingBehavior ||
    record.hornQuality
  )
  const hasSummary = hasSummaryText(record.summaryNotes)

  const sellerName = escapeHtml(seller.companyName || seller.name)
  const sellerQual = seller.qualification
    ? escapeHtml(`${seller.name} · ${seller.qualification}`)
    : ''
  const sellerPhone = seller.phone ? escapeHtml(`Tel: ${seller.phone}`) : ''
  const sellerEmail = seller.email ? escapeHtml(seller.email) : ''

  const sectionOffset = hasGeneralData ? 1 : 0
  const secHoofNum = sectionOffset + 1
  const secMassnahmenNum = sectionOffset + 2
  const secFotoNum = hasSummary ? sectionOffset + 3 : sectionOffset + 2

  let allgemeinHtml = ''
  if (hasGeneralData) {
    const rows: string[] = []
    if (record.generalCondition) {
      const col = gcColor(record.generalCondition)
      rows.push(
        `<div class="allg-row"><span class="allg-lab">Allgemeinzustand</span><span class="allg-val">${dotSpan(col)}<span class="${valueClass(col)}">${escapeHtml(record.generalCondition)}</span></span></div>`
      )
    }
    if (record.gait) {
      const col = gaitColor(record.gait)
      rows.push(
        `<div class="allg-row"><span class="allg-lab">Gangbild</span><span class="allg-val">${dotSpan(col)}<span class="${valueClass(col)}">${escapeHtml(record.gait)}</span></span></div>`
      )
    }
    if (record.handlingBehavior) {
      const col = handlingColor(record.handlingBehavior)
      rows.push(
        `<div class="allg-row"><span class="allg-lab">Verhalten</span><span class="allg-val">${dotSpan(col)}<span class="${valueClass(col)}">${escapeHtml(record.handlingBehavior)}</span></span></div>`
      )
    }
    if (record.hornQuality) {
      const col = hornColor(record.hornQuality)
      rows.push(
        `<div class="allg-row allg-row-last"><span class="allg-lab">Hornqualität</span><span class="allg-val">${dotSpan(col)}<span class="${valueClass(col)}">${escapeHtml(record.hornQuality)}</span></span></div>`
      )
    }
    allgemeinHtml = `<section class="block"><div class="sec-title"><span class="sec-num">1.</span><span class="sec-lab">Allgemeiner Eindruck</span></div>${rows.join('')}</section>`
  }

  let hoofHtml = ''
  if (hasHoofData) {
    if (allOk) {
      hoofHtml = `<section class="block"><div class="sec-title"><span class="sec-num">${secHoofNum}.</span><span class="sec-lab">Hufbefund</span></div><div class="hoof-ok-box">✓ Alle ${record.hoofs.length} Hufe unauffällig. Zehe gerade, Trachten normal, Strahl gesund, Sohle stabil.</div></section>`
    } else {
      const cards = record.hoofs
        .map((hoof) => {
          const st = hoofStatus(hoof)
          const cardClass = st === 'critical' ? 'hoof-card danger' : st === 'warn' ? 'hoof-card warn' : 'hoof-card'
          const badgeClass = st === 'critical' ? 'badge danger' : st === 'warn' ? 'badge warn' : 'badge ok'
          const badgeTxt = st === 'critical' ? 'Kritisch' : st === 'warn' ? 'Abweichung' : 'Unauffällig'
          const fieldRows = HOOF_FIELDS.map((f, fi) => {
            const val = hoof[f.key] as string | null
            let vc = 'val-norm'
            if (val) {
              if (f.key === 'frogCondition' && val === 'faulig') vc = 'val-crit'
              else {
                const std =
                  (f.key === 'toeAlignment' && val === 'gerade') ||
                  (f.key === 'heelBalance' && HOOF_STANDARD.heel.includes(val)) ||
                  (f.key === 'soleCondition' && val === 'stabil') ||
                  (f.key === 'frogCondition' && val === 'gesund')
                if (!std) vc = 'val-dev'
              }
            }
            const last = fi === HOOF_FIELDS.length - 1 ? ' hoof-field-last' : ''
            return `<div class="hoof-field${last}"><span class="hoof-flab">${escapeHtml(f.label)}</span><span class="${vc}">${escapeHtml(val ?? '–')}</span></div>`
          }).join('')
          return `<div class="${cardClass}"><div class="hoof-card-h"><span class="hoof-pos">${escapeHtml(HOOF_LABELS[hoof.position] ?? hoof.position)}</span><span class="${badgeClass}">${badgeTxt}</span></div><div class="hoof-card-b">${fieldRows}</div></div>`
        })
        .join('')
      hoofHtml = `<section class="block"><div class="sec-title"><span class="sec-num">${secHoofNum}.</span><span class="sec-lab">Hufbefund</span></div><div class="hoof-grid">${cards}</div></section>`
    }
  }

  let massnahmenHtml = ''
  if (hasSummary) {
    massnahmenHtml = `<section class="block page-break-before"><div class="sec-title massnahmen-title"><span class="sec-num">${secMassnahmenNum}.</span><span class="sec-lab">Maßnahmen &amp; Beobachtungen</span></div><div class="empfehlung-box rich">${htmlFragmentFromContent(record.summaryNotes)}</div></section>`
  }

  const dateLabel = formatGermanDate(record.recordDate)
  const photoCaptionDate = escapeHtml(dateLabel)

  function photoCell(slot: string): string {
    const href = photoHrefByType.get(slot) ?? null
    const label = escapeHtml(SLOT_LABELS[slot] ?? slot)
    if (href) {
      const safeHref = escapeHtml(href)
      return `<div class="photo-slot"><img src="${safeHref}" alt="${label}" /><div class="photo-cap">${label} — ${photoCaptionDate}</div></div>`
    }
    return `<div class="photo-slot ph-empty"><span>${label}</span></div>`
  }

  const solarRow = SLOT_SOLAR.map((slot) => photoCell(slot)).join('')
  const lateralRow = SLOT_LATERAL.map((slot) => photoCell(slot)).join('')

  const known = new Set<string>([...SLOT_SOLAR, ...SLOT_LATERAL])
  const extraSlots: { type: string; label: string; href: string | null }[] = []
  for (const [photoType, href] of photoHrefByType) {
    if (known.has(photoType)) continue
    extraSlots.push({
      type: photoType,
      label: SLOT_LABELS[photoType] ?? photoType.replace(/_/g, ' '),
      href,
    })
  }

  let extraFotosHtml = ''
  if (extraSlots.length > 0) {
    const cells = extraSlots
      .map((x) => {
        if (x.href) {
          return `<div class="photo-slot photo-slot-wide"><img src="${escapeHtml(x.href)}" alt="${escapeHtml(x.label)}" /><div class="photo-cap">${escapeHtml(x.label)} — ${photoCaptionDate}</div></div>`
        }
        return `<div class="photo-slot ph-empty"><span>${escapeHtml(x.label)}</span></div>`
      })
      .join('')
    extraFotosHtml = `<p class="img-sub">Weitere Fotos</p><div class="photo-grid-extra">${cells}</div>`
  }

  const fotoSection = `<section class="block page-break-before"><div class="sec-title"><span class="sec-num">${secFotoNum}.</span><span class="sec-lab">Fotodokumentation</span></div><p class="img-sub-first">Sohlenansicht (Solar)</p><div class="photo-grid">${solarRow}</div><p class="img-sub">Seitenansicht (Lateral)</p><div class="photo-grid">${lateralRow}</div>${extraFotosHtml}</section>`

  const bannerHtml = hasHoofData
    ? `<div class="banner" style="border-color:${bannerBorder};background:${bannerBg}"><span class="banner-dot" style="background:${bannerTitleColor}"></span><div><div class="banner-t" style="color:${bannerTitleColor}">${escapeHtml(bannerTitle)}</div><div class="banner-s" style="color:${bannerSubColor}">${escapeHtml(bannerSub)}</div></div></div>`
    : ''

  const headerRight = `<div class="hdr-right"><div class="hdr-name">${sellerName}</div>${sellerQual ? `<div class="hdr-meta">${sellerQual}</div>` : ''}${sellerPhone ? `<div class="hdr-meta">${sellerPhone}</div>` : ''}${sellerEmail ? `<div class="hdr-meta">${sellerEmail}</div>` : ''}</div>`

  const logoHtml = seller.logoUrl
    ? `<img class="logo-img" src="${escapeHtml(seller.logoUrl)}" alt="" />`
    : `<div class="logo-box">H</div><div><div class="brand-name">AniDocs</div><div class="brand-sub">Dokumentationsbericht</div></div>`

  const inner = `
<header class="hdr">
  <div class="hdr-left">${logoHtml}</div>
  ${headerRight}
</header>
<div class="title-block">
  <h1>Befundbericht — ${escapeHtml(horse.name)}</h1>
  <p class="subtitle">Dokumentation der Hufbearbeitung vom ${escapeHtml(formatGermanDateLong(record.recordDate))}</p>
</div>
<div class="info-grid">
  <div class="ig-cell"><div class="ig-lab">Pferd</div><div class="ig-val">${escapeHtml(horse.name)}</div></div>
  <div class="ig-cell"><div class="ig-lab">Rasse / Geschlecht</div><div class="ig-val">${escapeHtml(horseBreedSex)}</div></div>
  <div class="ig-cell ig-nb"><div class="ig-lab">Alter</div><div class="ig-val">${escapeHtml(horseAge)}</div></div>
  <div class="ig-cell"><div class="ig-lab">Besitzer/in</div><div class="ig-val">${escapeHtml(customer.name)}</div></div>
  <div class="ig-cell"><div class="ig-lab">Stall / Standort</div><div class="ig-val">${escapeHtml(stallLocationLine || '–')}</div></div>
  <div class="ig-cell ig-nb"><div class="ig-lab">Termin-Nr.</div><div class="ig-val">${escapeHtml(record.docNumber ?? '–')}</div></div>
  <div class="ig-cell ig-b0"><div class="ig-lab">Datum</div><div class="ig-val">${escapeHtml(formatGermanDate(record.recordDate))}</div></div>
  <div class="ig-cell ig-b0"><div class="ig-lab">Art</div><div class="ig-val">${escapeHtml(record.recordType ?? 'Regeltermin')}</div></div>
  <div class="ig-cell ig-b0 ig-nb"><div class="ig-lab">Vorheriger Termin</div><div class="ig-val">${escapeHtml(formatGermanDate(record.lastRecordDate))}</div></div>
</div>
${bannerHtml}
${allgemeinHtml}
${hoofHtml}
${massnahmenHtml}
${fotoSection}
<footer class="ft">
  <div><div class="ft-line">${sellerName} · ${escapeHtml(seller.name)}</div>${seller.city ? `<div class="ft-line">${escapeHtml(seller.city)}${seller.phone ? ` · Tel: ${escapeHtml(seller.phone)}` : ''}</div>` : ''}</div>
  <div class="ft-right"><div class="ft-line">Erstellt am ${escapeHtml(formatGermanDate(record.recordDate))}</div><div class="ft-line">Erstellt mit <strong style="color:${C.brand}">AniDocs</strong></div></div>
</footer>`

  const css = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size: 10pt; color: ${C.text}; background: #fff; margin: 0; padding: 28px 40px 48px; max-width: 210mm; margin-left: auto; margin-right: auto; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2px solid ${C.text}; margin-bottom: 14px; }
  .hdr-left { display: flex; align-items: flex-start; gap: 8px; }
  .logo-box { width: 32px; height: 32px; background: ${C.brand}; border-radius: 6px; color: #fff; font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; }
  .logo-img { max-width: 80px; max-height: 36px; object-fit: contain; }
  .brand-name { font-size: 16px; font-weight: 700; }
  .brand-sub { font-size: 7.5pt; color: ${C.textLight}; margin-top: 2px; }
  .hdr-right { text-align: right; }
  .hdr-name { font-size: 8.5pt; font-weight: 700; }
  .hdr-meta { font-size: 8.5pt; color: ${C.textLight}; margin-top: 2px; }
  .title-block { margin-bottom: 12px; }
  h1 { font-size: 15pt; font-weight: 700; margin: 0 0 2px; }
  .subtitle { font-size: 9.5pt; color: ${C.textSecondary}; margin: 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid ${C.border}; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
  .ig-cell { padding: 7px 10px; border-right: 1px solid ${C.border}; border-bottom: 1px solid ${C.border}; }
  .ig-nb { border-right: none; }
  .ig-b0 { border-bottom: none; }
  .ig-lab { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.08em; color: ${C.textLight}; font-weight: 700; margin-bottom: 2px; }
  .ig-val { font-size: 9.5pt; }
  .banner { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 6px; border: 1px solid; margin-bottom: 12px; }
  .banner-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .banner-t { font-size: 10pt; font-weight: 700; }
  .banner-s { font-size: 7.5pt; margin-top: 1px; }
  .block { margin-bottom: 11px; }
  .sec-title { display: flex; align-items: center; padding-bottom: 5px; border-bottom: 1px solid ${C.border}; margin-top: 21px; margin-bottom: 9px; }
  .massnahmen-title { margin-top: 28px; margin-bottom: 12px; border-bottom: none; }
  .sec-num { font-size: 11pt; font-weight: 700; margin-right: 4px; }
  .sec-lab { font-size: 11pt; font-weight: 700; }
  .allg-row { display: flex; align-items: center; padding: 4px 7px; border-bottom: 1px solid ${C.border}33; }
  .allg-row-last { border-bottom: none; }
  .allg-lab { width: 120px; font-size: 9pt; color: ${C.textLight}; }
  .allg-val { display: flex; align-items: center; gap: 5px; flex: 1; font-size: 9.5pt; font-weight: 700; }
  .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
  .val-ok { color: ${C.ok}; } .val-warn { color: ${C.warn}; } .val-danger { color: ${C.danger}; } .val-neutral { color: ${C.text}; }
  .hoof-ok-box { padding: 10px 14px; border-radius: 6px; border: 1px solid ${C.okBorder}; background: ${C.okBg}; font-size: 9.5pt; color: ${C.ok}; }
  .hoof-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .hoof-card { width: calc(50% - 4px); border: 1px solid ${C.border}; border-radius: 6px; overflow: hidden; }
  .hoof-card.warn { border-color: ${C.warnBorder}; } .hoof-card.danger { border-color: ${C.dangerBorder}; }
  .hoof-card-h { display: flex; justify-content: space-between; align-items: center; padding: 5px 9px; background: ${C.bgSubtle}; border-bottom: 1px solid ${C.border}; }
  .hoof-card.warn .hoof-card-h { background: #FEF9ED; border-color: ${C.warnBorder}; }
  .hoof-card.danger .hoof-card-h { background: #FEF2F2; border-color: ${C.dangerBorder}; }
  .hoof-pos { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge { font-size: 7.5pt; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
  .badge.ok { color: ${C.ok}; background: ${C.okBg}; } .badge.warn { color: ${C.warn}; background: ${C.warnBg}; } .badge.danger { color: ${C.danger}; background: ${C.dangerBg}; }
  .hoof-card-b { padding: 4px 9px; }
  .hoof-field { display: flex; justify-content: space-between; padding: 2.5px 0; border-bottom: 1px solid ${C.border}44; font-size: 8.5pt; }
  .hoof-field-last { border-bottom: none; }
  .hoof-flab { color: ${C.textLight}; }
  .val-norm { color: ${C.text}; } .val-dev { color: ${C.warn}; font-weight: 700; } .val-crit { color: ${C.danger}; font-weight: 700; }
  .empfehlung-box { border-left: 3px solid #C87941; padding: 9px 14px; background: rgba(200,121,65,0.04); border-radius: 4px; color: ${C.textSecondary}; line-height: 1.6; }
  .rich p:first-child { margin-top: 0; }
  .img-sub-first { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${C.textLight}; margin: 0 0 6px; }
  .img-sub { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${C.textLight}; margin: 10px 0 6px; }
  .photo-grid { display: flex; gap: 7px; }
  .photo-grid-extra { display: flex; flex-wrap: wrap; gap: 7px; }
  .photo-slot { flex: 1; min-width: 0; aspect-ratio: 9/16; border-radius: 6px; border: 1px solid ${C.border}; overflow: hidden; position: relative; background: ${C.bgSubtle}; }
  .photo-slot-wide { flex: 1 1 40%; min-width: 120px; aspect-ratio: 9/16; }
  .photo-slot img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ph-empty { display: flex; align-items: center; justify-content: center; font-size: 7.5pt; color: ${C.textLight}; }
  .photo-cap { position: absolute; bottom: 0; left: 0; right: 0; padding: 3px 7px; background: rgba(0,0,0,0.55); color: #fff; font-size: 7.5pt; }
  .page-break-before { break-before: page; page-break-before: always; }
  .ft { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 7px; border-top: 1px solid ${C.border}; font-size: 7pt; color: ${C.textLight}; }
  .ft-right { text-align: right; }
  .ft-line { margin-bottom: 2px; }
  @media print { body { padding: 12mm; } }
`

  const title = `Befundbericht — ${horse.name}`
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
${inner}
</body>
</html>`
}

function fullCustomerName(c: Record<string, unknown> | undefined): string {
  if (!c) return ''
  const legacy = (c.name as string | null)?.trim()
  if (legacy) return legacy
  const fn = (c.first_name as string | null)?.trim()
  const ln = (c.last_name as string | null)?.trim()
  return [fn, ln].filter(Boolean).join(' ').trim()
}

/** Dokumentation ohne Legacy-hoof_record_id: PDF-ähnlicher Kopf, Infos, Texte, Fotos (Solar/Lateral/Weitere). */
export function buildOrphanDocumentationExportHtml(args: {
  d: Record<string, unknown>
  horse: Record<string, unknown> | undefined
  customer: Record<string, unknown> | undefined
  seller: RecordPdfSeller
  photoHrefByType: Map<string, string | null>
}): string {
  const { d, horse, customer, seller, photoHrefByType } = args
  const kind = d.documentation_kind as string | null
  const disc = d.therapy_discipline as string | null
  const fach =
    kind === 'therapy' && disc
      ? labelTherapyDiscipline(disc)
      : kind === 'hoof'
        ? 'Huf'
        : ''
  const docDate = d.session_date ? formatGermanDate(String(d.session_date)) : ''
  const title =
    (d.title as string | null)?.trim() ||
    `${labelDocumentationKind(kind)} · ${(horse?.name as string) || 'Tier'} · ${docDate || 'ohne Datum'}`

  const sellerName = escapeHtml(seller.companyName || seller.name)
  const headerRight = `<div class="hdr-right"><div class="hdr-name">${sellerName}</div></div>`
  const logoHtml = seller.logoUrl
    ? `<img class="logo-img" src="${escapeHtml(seller.logoUrl)}" alt="" />`
    : `<div class="logo-box">H</div><div><div class="brand-name">AniDocs</div><div class="brand-sub">Dokumentation</div></div>`

  const infoRows = [
    ['Dokumentationsdatum', docDate],
    ['Kunde', fullCustomerName(customer)],
    ['Tiername', (horse?.name as string) || ''],
    ['Tierart', labelAnimalType(horse?.animal_type as string | null)],
    ['Dokumentationstyp', labelDocumentationKind(kind)],
    ['Fachbereich', fach],
    ['Terminart', labelSessionType(d.session_type as string | null)],
    ['Dokumentationsnummer', (d.doc_number as string) || ''],
  ]
    .filter(([, v]) => String(v).trim())
    .map(
      ([k, v]) =>
        `<div class="ig-cell"><div class="ig-lab">${escapeHtml(k)}</div><div class="ig-val">${escapeHtml(String(v))}</div></div>`
    )
    .join('')

  const summary = htmlFragmentFromContent(d.summary_html as string | null)
  const rec = htmlFragmentFromContent(d.recommendations_html as string | null)
  let textSections = ''
  if (summary) textSections += `<section class="block"><div class="sec-title"><span class="sec-lab">Zusammenfassung</span></div><div class="empfehlung-box rich">${summary}</div></section>`
  if (rec) textSections += `<section class="block"><div class="sec-title"><span class="sec-lab">Empfehlung</span></div><div class="empfehlung-box rich">${rec}</div></section>`

  const dateCap = escapeHtml(docDate)
  function photoCell(slot: string): string {
    const href = photoHrefByType.get(slot) ?? null
    const label = escapeHtml(SLOT_LABELS[slot] ?? slot)
    if (href) {
      return `<div class="photo-slot"><img src="${escapeHtml(href)}" alt="${label}" /><div class="photo-cap">${label} — ${dateCap}</div></div>`
    }
    return `<div class="photo-slot ph-empty"><span>${label}</span></div>`
  }
  const known = new Set<string>([...SLOT_SOLAR, ...SLOT_LATERAL])
  const extraSlots: { type: string; label: string; href: string | null }[] = []
  for (const [photoType, href] of photoHrefByType) {
    if (known.has(photoType)) continue
    extraSlots.push({ type: photoType, label: SLOT_LABELS[photoType] ?? photoType, href })
  }
  let extraHtml = ''
  if (extraSlots.length) {
    extraHtml =
      `<p class="img-sub">Weitere Fotos</p><div class="photo-grid-extra">` +
      extraSlots
        .map((x) =>
          x.href
            ? `<div class="photo-slot photo-slot-wide"><img src="${escapeHtml(x.href)}" alt="${escapeHtml(x.label)}" /><div class="photo-cap">${escapeHtml(x.label)} — ${dateCap}</div></div>`
            : `<div class="photo-slot ph-empty"><span>${escapeHtml(x.label)}</span></div>`
        )
        .join('') +
      `</div>`
  }

  const fotoBlock = `<section class="block page-break-before"><div class="sec-title"><span class="sec-lab">Fotodokumentation</span></div><p class="img-sub-first">Sohlenansicht (Solar)</p><div class="photo-grid">${SLOT_SOLAR.map(photoCell).join('')}</div><p class="img-sub">Seitenansicht (Lateral)</p><div class="photo-grid">${SLOT_LATERAL.map(photoCell).join('')}</div>${extraHtml}</section>`

  const inner = `
<header class="hdr"><div class="hdr-left">${logoHtml}</div>${headerRight}</header>
<div class="title-block"><h1>${escapeHtml(title)}</h1></div>
<div class="info-grid" style="grid-template-columns:1fr 1fr">${infoRows}</div>
${textSections}
${fotoBlock}`

  // Pull CSS from a string constant - duplicate the css variable content from buildBefundberichtExportHtml
  const styleBlock = documentStyleSheet()
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${styleBlock}</style></head>
<body>${inner}</body></html>`
}

function documentStyleSheet(): string {
  return `
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size: 10pt; color: ${C.text}; background: #fff; margin: 0; padding: 28px 40px; max-width: 210mm; margin-left: auto; margin-right: auto; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2px solid ${C.text}; margin-bottom: 14px; }
  .hdr-left { display: flex; align-items: flex-start; gap: 8px; }
  .logo-box { width: 32px; height: 32px; background: ${C.brand}; border-radius: 6px; color: #fff; font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; }
  .logo-img { max-width: 80px; max-height: 36px; object-fit: contain; }
  .brand-name { font-size: 16px; font-weight: 700; }
  .brand-sub { font-size: 7.5pt; color: ${C.textLight}; margin-top: 2px; }
  .hdr-right { text-align: right; }
  .hdr-name { font-size: 8.5pt; font-weight: 700; }
  h1 { font-size: 15pt; font-weight: 700; margin: 0 0 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid ${C.border}; border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
  .ig-cell { padding: 7px 10px; border-right: 1px solid ${C.border}; border-bottom: 1px solid ${C.border}; }
  .ig-lab { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.08em; color: ${C.textLight}; font-weight: 700; margin-bottom: 2px; }
  .ig-val { font-size: 9.5pt; }
  .block { margin-bottom: 16px; }
  .sec-title { padding-bottom: 5px; border-bottom: 1px solid ${C.border}; margin-bottom: 9px; }
  .sec-lab { font-size: 11pt; font-weight: 700; }
  .empfehlung-box { border-left: 3px solid #C87941; padding: 9px 14px; background: rgba(200,121,65,0.04); border-radius: 4px; color: ${C.textSecondary}; line-height: 1.6; }
  .img-sub-first { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: ${C.textLight}; margin: 0 0 6px; }
  .img-sub { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: ${C.textLight}; margin: 10px 0 6px; }
  .photo-grid { display: flex; gap: 7px; }
  .photo-grid-extra { display: flex; flex-wrap: wrap; gap: 7px; }
  .photo-slot { flex: 1; min-width: 0; aspect-ratio: 9/16; border-radius: 6px; border: 1px solid ${C.border}; overflow: hidden; position: relative; background: ${C.bgSubtle}; }
  .photo-slot-wide { flex: 1 1 40%; min-width: 120px; aspect-ratio: 9/16; }
  .photo-slot img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ph-empty { display: flex; align-items: center; justify-content: center; font-size: 7.5pt; color: ${C.textLight}; }
  .photo-cap { position: absolute; bottom: 0; left: 0; right: 0; padding: 3px 7px; background: rgba(0,0,0,0.55); color: #fff; font-size: 7.5pt; }
  .page-break-before { break-before: page; page-break-before: always; }
`
}

/** Notfall-Fallback, wenn keine PDF-Daten geladen werden konnten (reiner Huf-Eintrag). */
export function buildHoofRecordExportHtml(args: {
  r: Record<string, unknown>
  horse: Record<string, unknown> | undefined
  customer: Record<string, unknown> | undefined
}): string {
  const { r, horse, customer } = args
  const docDate = r.record_date ? formatGermanDate(String(r.record_date)) : ''
  const title = `Hufdokumentation · ${(horse?.name as string) || 'Tier'} · ${docDate || 'ohne Datum'}`
  const inner = `<div class="title-block"><h1>${escapeHtml(title)}</h1></div><div class="empfehlung-box rich">${htmlFragmentFromContent(r.hoof_condition as string | null)}${htmlFragmentFromContent(r.treatment as string | null)}${htmlFragmentFromContent(r.notes as string | null)}</div>`
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${documentStyleSheet()}</style></head><body>${inner}</body></html>`
}
