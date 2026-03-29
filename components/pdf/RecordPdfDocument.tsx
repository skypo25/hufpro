import React from "react"
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer"
import type { Styles } from "@react-pdf/renderer"
type Style = Styles[string]
import type { RecordPdfData, RecordPdfHoof } from "@/lib/pdf/types"
import {
  SLOT_SOLAR,
  SLOT_LATERAL,
  SLOT_LABELS,
} from "@/lib/photos/photoTypes"

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  brand: "#52b788",       // nur für Border-Linie + Logo-Box-Hintergrund
  text: "#1C1C1C",        // alle Texte (Headlines, Labels, Werte)
  textSecondary: "#555555",
  textLight: "#888888",
  border: "#D8D5D0",
  borderLight: "#ECEAE6",
  bgSubtle: "#FAFAF8",
  accent: "#C87941",
  ok: "#2D5A2D",
  okBg: "#F2F8F2",
  okBorder: "#C0D8C0",
  warn: "#B8860B",
  warnBg: "#FDF6EC",
  warnBorder: "#E8D5B0",
  danger: "#9B2C2C",
  dangerBg: "#FDF2F2",
  dangerBorder: "#E8B0B0",
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.text,
    backgroundColor: "#fff",
    paddingTop: 44,
    paddingBottom: 44,
    paddingHorizontal: 62,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.text,
    marginBottom: 14,
  },
  logoBox: {
    width: 32,
    height: 32,
    backgroundColor: C.brand,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBoxText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
  },
  logoImage: {
    width: 80,
    height: 36,
    objectFit: "contain",
  },
  headerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  headerBrandName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.text,
  },
  headerBrandSub: { fontSize: 7.5, color: C.textLight, marginTop: 2 },
  headerRight: { textAlign: "right" },
  headerMetaBold: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.text },
  headerMeta: { fontSize: 8.5, color: C.textLight, marginTop: 1 },

  // Page 2 header
  headerCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.text,
    marginBottom: 16,
  },
  headerCompactLogoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerCompactName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.text },
  headerCompactDoc: { fontSize: 8.5, color: C.textLight },

  // Title block
  reportTitle: { marginBottom: 12 },
  reportH1: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    marginBottom: 2,
  },
  reportSubtitle: { fontSize: 9.5, color: C.textSecondary },

  // Info grid
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    marginBottom: 12,
    overflow: "hidden",
  },
  infoCell: {
    width: "33.33%",
    padding: "7 10",
    borderRightWidth: 1,
    borderRightColor: C.border,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoCellNoBorder: {
    width: "33.33%",
    padding: "7 10",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: C.textLight,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  infoValue: { fontSize: 9.5, color: C.text },

  // Status banner
  bannerOk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: "7 12",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.okBorder,
    backgroundColor: C.okBg,
    marginBottom: 12,
  },
  bannerWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: "7 12",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.warnBorder,
    backgroundColor: C.warnBg,
    marginBottom: 12,
  },
  bannerDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: "7 12",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    backgroundColor: C.dangerBg,
    marginBottom: 12,
  },
  bannerDotOk:     { width: 9, height: 9, borderRadius: 5, backgroundColor: C.ok },
  bannerDotWarn:   { width: 9, height: 9, borderRadius: 5, backgroundColor: C.warn },
  bannerDotDanger: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.danger },
  bannerTextOk:     { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ok },
  bannerTextWarn:   { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.warn },
  bannerTextDanger: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.danger },
  bannerSub: { fontSize: 7.5, marginTop: 1 },

  // Section
  section: { marginBottom: 11 },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginTop: 21,
    marginBottom: 9,
  },
  // Maßnahmen-Seitentitel: kein Unterstrich, viel mehr Abstand oben
  sectionTitleMassnahmen: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  sectionNum:   { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.text, marginRight: 4 },
  sectionLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.text },

  // Allgemein table
  allgemeinRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  allgemeinRowLast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  allgemeinLabel: { width: 120, fontSize: 9, color: C.textLight },
  allgemeinValueRow: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotGreen:   { backgroundColor: C.ok },
  dotYellow:  { backgroundColor: C.warn },
  dotRed:     { backgroundColor: C.danger },
  dotNeutral: { backgroundColor: C.textLight },
  valueOk:      { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.ok },
  valueWarn:    { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.warn },
  valueDanger:  { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.danger },
  valueNeutral: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },

  // Hoof compact
  hoofCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: "10 14",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.okBorder,
    backgroundColor: C.okBg,
  },
  hoofCompactText: { fontSize: 9.5, color: C.ok },

  // Hoof grid
  hoofGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hoofCard: {
    width: "49%",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 2,
  },
  hoofCardWarn: {
    width: "49%",
    borderWidth: 1,
    borderColor: C.warnBorder,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 2,
  },
  hoofCardDanger: {
    width: "49%",
    borderWidth: 1,
    borderColor: C.dangerBorder,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 2,
  },
  hoofCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5 9",
    backgroundColor: C.bgSubtle,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  hoofCardHeaderWarn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5 9",
    backgroundColor: "#FEF9ED",
    borderBottomWidth: 1,
    borderBottomColor: C.warnBorder,
  },
  hoofCardHeaderDanger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5 9",
    backgroundColor: "#FEF2F2",
    borderBottomWidth: 1,
    borderBottomColor: C.dangerBorder,
  },
  hoofCardPos: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgeOk:     { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.ok,     backgroundColor: C.okBg,     padding: "2 7", borderRadius: 4 },
  badgeWarn:   { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.warn,   backgroundColor: C.warnBg,   padding: "2 7", borderRadius: 4 },
  badgeDanger: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.danger, backgroundColor: C.dangerBg, padding: "2 7", borderRadius: 4 },
  hoofCardBody: { padding: "4 9" },
  hoofRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  hoofRowLast: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  hoofRowLabel:          { fontSize: 8.5, color: C.textLight },
  hoofRowValueNormal:    { fontSize: 8.5, color: C.text },
  hoofRowValueDeviation: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.warn },
  hoofRowValueCritical:  { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.danger },

  // Empfehlung / Maßnahmen
  empfehlungBox: {
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingLeft: 14,
    paddingVertical: 9,
    paddingRight: 14,
    backgroundColor: "rgba(200,121,65,0.04)",
    borderRadius: 4,
  },
  empfehlungText: { fontSize: 9.5, color: C.textSecondary, lineHeight: 1.6 },
  empfehlungTextBold: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text, lineHeight: 1.6 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 62,
    right: 62,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerText:    { fontSize: 7, color: C.textLight },
  footerPowered: { fontSize: 7, color: C.brand, fontFamily: "Helvetica-Bold" },

  // Photo page
  imgRowLabelFirst: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.textLight,
    marginBottom: 6,
  },
  imgRowLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.textLight,
    marginBottom: 6,
    marginTop: 10,
  },
  photoGrid: { flexDirection: "row", gap: 7 },
  photoSlot: {
    flex: 1,
    aspectRatio: 9 / 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%", objectFit: "cover" },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: C.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: { fontSize: 7.5, color: C.textLight },
  photoCaption: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "3 7",
    backgroundColor: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: 7.5,
  },
})

// ─── HTML Parser for rich-text content ───────────────────────────────────────

type HtmlSegment = { text: string; bold: boolean }
type HtmlBlock   = { segments: HtmlSegment[] }

function parseHtmlContent(html: string): HtmlBlock[] {
  if (!html) return []

  // Check whether the string actually contains HTML
  const hasHtml = /<[a-z]/i.test(html)
  if (!hasHtml) {
    return html
      .split(/\n{2,}/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ segments: [{ text: line, bold: false }] }))
  }

  // Normalise: br → newline, collapse div/p wrappers
  const normalised = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div)>/gi, "\n")
    .replace(/<(?:p|div)[^>]*>/gi, "")

  const paragraphs = normalised
    .split(/\n{1,}/)
    .map((s) => s.trim())
    .filter(Boolean)

  return paragraphs.map((para) => {
    const segments: HtmlSegment[] = []
    const boldRe = /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi
    let lastIdx = 0
    let match: RegExpExecArray | null
    while ((match = boldRe.exec(para)) !== null) {
      const before = para.slice(lastIdx, match.index).replace(/<[^>]+>/g, "")
      if (before) segments.push({ text: before, bold: false })
      const boldTxt = match[1].replace(/<[^>]+>/g, "")
      if (boldTxt) segments.push({ text: boldTxt, bold: true })
      lastIdx = match.index + match[0].length
    }
    const after = para.slice(lastIdx).replace(/<[^>]+>/g, "")
    if (after) segments.push({ text: after, bold: false })
    return { segments: segments.filter((s) => s.text) }
  }).filter((b) => b.segments.length > 0)
}

function RichText({ html, baseStyle }: { html: string; baseStyle: Style }) {
  const blocks = parseHtmlContent(html)
  if (!blocks.length) return null
  return (
    <>
      {blocks.map((block, i) => (
        <Text
          key={i}
          style={[baseStyle, i < blocks.length - 1 ? { marginBottom: 6 } : {}]}
        >
          {block.segments.map((seg, j) => (
            <Text
              key={j}
              style={seg.bold ? { fontFamily: "Helvetica-Bold" } : {}}
            >
              {seg.text}
            </Text>
          ))}
        </Text>
      ))}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGermanDate(ds: string | null | undefined): string {
  if (!ds) return "–"
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return ds
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d)
}

function formatGermanDateLong(ds: string | null | undefined): string {
  if (!ds) return "–"
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return ds
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(d)
}

const HOOF_STANDARD = { toe: "gerade", heel: ["normal", "ausgeglichen"], sole: "stabil", frog: "gesund" }

function hoofStatus(h: RecordPdfHoof): "ok" | "warn" | "critical" {
  if (h.frogCondition === "faulig") return "critical"
  const ok =
    (!h.toeAlignment || h.toeAlignment === HOOF_STANDARD.toe) &&
    (!h.heelBalance || HOOF_STANDARD.heel.includes(h.heelBalance)) &&
    (!h.soleCondition || h.soleCondition === HOOF_STANDARD.sole) &&
    (!h.frogCondition || h.frogCondition === HOOF_STANDARD.frog)
  return ok ? "ok" : "warn"
}

function overallStatus(hoofs: RecordPdfHoof[]): "ok" | "warn" | "critical" {
  if (!hoofs.length) return "ok"
  if (hoofs.some((h) => hoofStatus(h) === "critical")) return "critical"
  if (hoofs.some((h) => hoofStatus(h) === "warn")) return "warn"
  return "ok"
}

type DotColor = "green" | "yellow" | "red" | "neutral"

function gcColor(v: string | null): DotColor {
  if (!v) return "neutral"
  const l = v.toLowerCase()
  if (l.includes("unauffällig") || l === "gut") return "green"
  if (l.includes("auffällig")) return "red"
  return "neutral"
}
function gaitColor(v: string | null): DotColor {
  if (!v) return "neutral"
  const l = v.toLowerCase()
  if (l.includes("taktrein") || l.includes("frei")) return "green"
  if (l.includes("lahm")) return "red"
  if (l.includes("ungleich")) return "yellow"
  return "neutral"
}
function handlingColor(v: string | null): DotColor {
  if (!v) return "neutral"
  const l = v.toLowerCase()
  if (l.includes("kooperativ")) return "green"
  if (l.includes("unruhig")) return "yellow"
  if (l.includes("widersetzlich")) return "red"
  return "neutral"
}
function hornColor(v: string | null): DotColor {
  if (!v) return "neutral"
  const l = v.toLowerCase()
  if (l.includes("stabil") || l.includes("gut")) return "green"
  return "yellow"
}

function DotComp({ color }: { color: DotColor }) {
  const c = color === "green" ? s.dotGreen : color === "yellow" ? s.dotYellow : color === "red" ? s.dotRed : s.dotNeutral
  return <View style={[s.dot, c]} />
}

function ValueText({ v, color }: { v: string; color: DotColor }) {
  const st = color === "green" ? s.valueOk : color === "yellow" ? s.valueWarn : color === "red" ? s.valueDanger : s.valueNeutral
  return <Text style={st}>{v}</Text>
}

const HOOF_LABELS: Record<string, string> = {
  vl: "VL — Vorne Links",
  vr: "VR — Vorne Rechts",
  hl: "HL — Hinten Links",
  hr: "HR — Hinten Rechts",
}

const HOOF_FIELDS: Array<{ key: keyof RecordPdfHoof; label: string }> = [
  { key: "toeAlignment",  label: "Zehe"     },
  { key: "heelBalance",   label: "Trachten" },
  { key: "frogCondition", label: "Strahl"   },
  { key: "soleCondition", label: "Sohle"    },
]

function hoofValStyle(field: string, val: string | null) {
  if (!val) return s.hoofRowValueNormal
  if (field === "frogCondition" && val === "faulig") return s.hoofRowValueCritical
  const std =
    (field === "toeAlignment"  && val === "gerade")    ||
    (field === "heelBalance"   && HOOF_STANDARD.heel.includes(val)) ||
    (field === "soleCondition" && val === "stabil")    ||
    (field === "frogCondition" && val === "gesund")
  return std ? s.hoofRowValueNormal : s.hoofRowValueDeviation
}

// ─── Logo Block ───────────────────────────────────────────────────────────────
function LogoBlock({ logoUrl, compact }: { logoUrl: string | null; compact?: boolean }) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        style={compact ? { width: 60, height: 28, objectFit: "contain" } : s.logoImage}
      />
    )
  }
  return (
    <View style={s.logoBox}>
      <Text style={s.logoBoxText}>H</Text>
    </View>
  )
}

// ─── Page Footer ──────────────────────────────────────────────────────────────
function PageFooter({
  seller,
  recordDate,
  pageLabel,
}: {
  seller: RecordPdfData["seller"]
  recordDate: string | null
  pageLabel: string
}) {
  const sellerName = seller.companyName || seller.name
  const line2 = [seller.city, seller.phone ? `Tel: ${seller.phone}` : null].filter(Boolean).join(" · ")
  return (
    <View style={s.footer}>
      <View>
        <Text style={s.footerText}>{sellerName} · {seller.name}</Text>
        {line2 ? <Text style={s.footerText}>{line2}</Text> : null}
      </View>
      <View style={{ textAlign: "right" }}>
        <Text style={s.footerText}>Erstellt am {formatGermanDate(recordDate)} · {pageLabel}</Text>
        <Text>
          <Text style={s.footerText}>Erstellt mit </Text>
          <Text style={s.footerPowered}>AniDocs</Text>
        </Text>
      </View>
    </View>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type Props = { data: RecordPdfData }

export default function RecordPdfDocument({ data }: Props) {
  const { horse, customer, seller, record, photos } = data

  const photoMap = Object.fromEntries(photos.map((p) => [p.photoType, p.dataUrl]))
  const ov = overallStatus(record.hoofs)
  const hasHoofData = record.hoofs.length > 0
  const allOk = hasHoofData && ov === "ok"

  const sellerName = seller.companyName || seller.name

  // Status banner values
  const bannerTitle =
    ov === "critical" ? "Gesamtbefund: Problematisch"
    : ov === "warn"   ? "Gesamtbefund: Behandlungsbedürftig"
    :                   "Gesamtbefund: Unauffällig"
  const deviating = record.hoofs.filter((h) => hoofStatus(h) !== "ok").length
  const bannerSub  =
    ov === "ok"
      ? "Alle Hufe im Normalzustand · Keine Abweichungen festgestellt"
      : `Abweichungen an ${deviating} von ${record.hoofs.length} Hufen festgestellt`
  const bannerStyle     = ov === "critical" ? s.bannerDanger     : ov === "warn" ? s.bannerWarn     : s.bannerOk
  const bannerDotStyle  = ov === "critical" ? s.bannerDotDanger  : ov === "warn" ? s.bannerDotWarn  : s.bannerDotOk
  const bannerTextStyle = ov === "critical" ? s.bannerTextDanger : ov === "warn" ? s.bannerTextWarn : s.bannerTextOk
  const bannerSubColor  = ov === "critical" ? C.danger           : ov === "warn" ? C.warn           : C.ok

  const horseBreedSex = [horse.breed, horse.sex].filter(Boolean).join(" · ") || "–"
  const horseAge =
    horse.ageYears != null ? `${horse.ageYears} Jahre (geb. ${horse.birthYear})`
    : horse.birthYear      ? `geb. ${horse.birthYear}`
    : "–"
  const stallLocationLine = [customer.stableName, customer.stableCity || customer.city]
    .filter(Boolean)
    .join(", ")

  const hasGeneralData = !!(record.generalCondition || record.gait || record.handlingBehavior || record.hornQuality)
  // Strip HTML tags + &nbsp; before checking – catches empty <p><br></p> etc.
  const hasSummary = !!(record.summaryNotes
    ?.replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, '')
    .trim())

  const totalPages     = hasSummary ? 3 : 2
  const sectionOffset  = hasGeneralData ? 1 : 0
  // Section numbers on page 1
  const secHoofNum     = sectionOffset + 1
  // Section numbers for standalone pages
  const secMassnahmenNum  = sectionOffset + 2
  const secFotoNum        = hasSummary ? sectionOffset + 3 : sectionOffset + 2

  return (
    <Document>
      {/* ═══════════════════════════════════════════════════════
          SEITE 1 – Befundbericht
      ═══════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        {/* HEADER */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <LogoBlock logoUrl={seller.logoUrl} />
            {!seller.logoUrl && (
              <View>
                <Text style={s.headerBrandName}>AniDocs</Text>
                <Text style={s.headerBrandSub}>Dokumentationsbericht</Text>
              </View>
            )}
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerMetaBold}>{sellerName}</Text>
            {seller.qualification && (
              <Text style={s.headerMeta}>{seller.name} · {seller.qualification}</Text>
            )}
            {seller.phone  && <Text style={s.headerMeta}>Tel: {seller.phone}</Text>}
            {seller.email  && <Text style={s.headerMeta}>{seller.email}</Text>}
          </View>
        </View>

        {/* TITLE */}
        <View style={s.reportTitle}>
          <Text style={s.reportH1}>Befundbericht — {horse.name}</Text>
          <Text style={s.reportSubtitle}>
            Dokumentation der Hufbearbeitung vom {formatGermanDateLong(record.recordDate)}
          </Text>
        </View>

        {/* INFO GRID */}
        <View style={s.infoGrid}>
          <View style={s.infoCell}><Text style={s.infoLabel}>Pferd</Text><Text style={s.infoValue}>{horse.name}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLabel}>Rasse / Geschlecht</Text><Text style={s.infoValue}>{horseBreedSex}</Text></View>
          <View style={s.infoCellNoBorder}><Text style={s.infoLabel}>Alter</Text><Text style={s.infoValue}>{horseAge}</Text></View>

          <View style={s.infoCell}><Text style={s.infoLabel}>Besitzer/in</Text><Text style={s.infoValue}>{customer.name}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLabel}>Stall / Standort</Text><Text style={s.infoValue}>{stallLocationLine || "–"}</Text></View>
          <View style={s.infoCellNoBorder}><Text style={s.infoLabel}>Termin-Nr.</Text><Text style={s.infoValue}>{record.docNumber ?? "–"}</Text></View>

          <View style={{ ...s.infoCell, borderBottomWidth: 0 }}><Text style={s.infoLabel}>Datum</Text><Text style={s.infoValue}>{formatGermanDate(record.recordDate)}</Text></View>
          <View style={{ ...s.infoCell, borderBottomWidth: 0 }}><Text style={s.infoLabel}>Art</Text><Text style={s.infoValue}>{record.recordType ?? "Regeltermin"}</Text></View>
          <View style={{ width: "33.33%", padding: "7 10" }}><Text style={s.infoLabel}>Vorheriger Termin</Text><Text style={s.infoValue}>{formatGermanDate(record.lastRecordDate)}</Text></View>
        </View>

        {/* STATUS BANNER */}
        {hasHoofData && (
          <View style={bannerStyle}>
            <View style={bannerDotStyle} />
            <View>
              <Text style={bannerTextStyle}>{bannerTitle}</Text>
              <Text style={[s.bannerSub, { color: bannerSubColor }]}>{bannerSub}</Text>
            </View>
          </View>
        )}

        {/* SECTION 1: Allgemeiner Eindruck */}
        {hasGeneralData && (
          <View style={s.section}>
            <View style={s.sectionTitle}>
              <Text style={s.sectionNum}>1.</Text>
              <Text style={s.sectionLabel}>Allgemeiner Eindruck</Text>
            </View>
            {record.generalCondition && (
              <View style={s.allgemeinRow}>
                <Text style={s.allgemeinLabel}>Allgemeinzustand</Text>
                <View style={s.allgemeinValueRow}>
                  <DotComp color={gcColor(record.generalCondition)} />
                  <ValueText v={record.generalCondition} color={gcColor(record.generalCondition)} />
                </View>
              </View>
            )}
            {record.gait && (
              <View style={s.allgemeinRow}>
                <Text style={s.allgemeinLabel}>Gangbild</Text>
                <View style={s.allgemeinValueRow}>
                  <DotComp color={gaitColor(record.gait)} />
                  <ValueText v={record.gait} color={gaitColor(record.gait)} />
                </View>
              </View>
            )}
            {record.handlingBehavior && (
              <View style={s.allgemeinRow}>
                <Text style={s.allgemeinLabel}>Verhalten</Text>
                <View style={s.allgemeinValueRow}>
                  <DotComp color={handlingColor(record.handlingBehavior)} />
                  <ValueText v={record.handlingBehavior} color={handlingColor(record.handlingBehavior)} />
                </View>
              </View>
            )}
            {record.hornQuality && (
              <View style={s.allgemeinRowLast}>
                <Text style={s.allgemeinLabel}>Hornqualität</Text>
                <View style={s.allgemeinValueRow}>
                  <DotComp color={hornColor(record.hornQuality)} />
                  <ValueText v={record.hornQuality} color={hornColor(record.hornQuality)} />
                </View>
              </View>
            )}
          </View>
        )}

        {/* SECTION 2: Hufbefund */}
        {hasHoofData && (
          <View style={s.section}>
            <View style={s.sectionTitle}>
              <Text style={s.sectionNum}>{sectionOffset + 1}.</Text>
              <Text style={s.sectionLabel}>Hufbefund</Text>
            </View>
            {allOk ? (
              <View style={s.hoofCompact}>
                <Text style={s.hoofCompactText}>
                  ✓  Alle {record.hoofs.length} Hufe unauffällig. Zehe gerade, Trachten normal, Strahl gesund, Sohle stabil.
                </Text>
              </View>
            ) : (
              <View style={s.hoofGrid}>
                {record.hoofs.map((hoof) => {
                  const st = hoofStatus(hoof)
                  const cardSt   = st === "critical" ? s.hoofCardDanger   : st === "warn" ? s.hoofCardWarn   : s.hoofCard
                  const headerSt = st === "critical" ? s.hoofCardHeaderDanger : st === "warn" ? s.hoofCardHeaderWarn : s.hoofCardHeader
                  const badgeSt  = st === "critical" ? s.badgeDanger      : st === "warn" ? s.badgeWarn      : s.badgeOk
                  const badgeTxt = st === "critical" ? "Kritisch" : st === "warn" ? "Abweichung" : "Unauffällig"
                  return (
                    <View key={hoof.position} style={cardSt}>
                      <View style={headerSt}>
                        <Text style={s.hoofCardPos}>{HOOF_LABELS[hoof.position]}</Text>
                        <Text style={badgeSt}>{badgeTxt}</Text>
                      </View>
                      <View style={s.hoofCardBody}>
                        {HOOF_FIELDS.map((f, fi) => {
                          const val = hoof[f.key] as string | null
                          return (
                            <View key={f.key} style={fi === HOOF_FIELDS.length - 1 ? s.hoofRowLast : s.hoofRow}>
                              <Text style={s.hoofRowLabel}>{f.label}</Text>
                              <Text style={hoofValStyle(f.key, val)}>{val ?? "–"}</Text>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        <PageFooter seller={seller} recordDate={record.recordDate} pageLabel={`Seite 1 von ${totalPages}`} />
      </Page>

      {/* ═══════════════════════════════════════════════════════
          SEITE 2 – Maßnahmen & Beobachtungen (nur wenn vorhanden)
      ═══════════════════════════════════════════════════════ */}
      {hasSummary && (
        <Page size="A4" style={s.page}>
          <View style={s.headerCompact}>
            <View style={s.headerCompactLogoRow}>
              <LogoBlock logoUrl={seller.logoUrl} compact />
              {!seller.logoUrl && <Text style={s.headerCompactName}>AniDocs</Text>}
            </View>
            <View style={{ textAlign: "right" }}>
              <Text style={s.headerMetaBold}>
                {horse.name} — Befundbericht {formatGermanDate(record.recordDate)}
              </Text>
              <Text style={s.headerCompactDoc}>{record.docNumber}</Text>
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionTitleMassnahmen}>
              <Text style={s.sectionNum}>{secMassnahmenNum}.</Text>
              <Text style={s.sectionLabel}>Maßnahmen & Beobachtungen</Text>
            </View>
            <RichText html={record.summaryNotes!} baseStyle={s.empfehlungText} />
          </View>

          <PageFooter seller={seller} recordDate={record.recordDate} pageLabel={`Seite 2 von ${totalPages}`} />
        </Page>
      )}

      {/* ═══════════════════════════════════════════════════════
          SEITE 2 oder 3 – Fotodokumentation (immer eigene Seite)
      ═══════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.headerCompact}>
          <View style={s.headerCompactLogoRow}>
            <LogoBlock logoUrl={seller.logoUrl} compact />
            {!seller.logoUrl && <Text style={s.headerCompactName}>AniDocs</Text>}
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={s.headerMetaBold}>
              {horse.name} — Befundbericht {formatGermanDate(record.recordDate)}
            </Text>
            <Text style={s.headerCompactDoc}>{record.docNumber}</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionTitle}>
            <Text style={s.sectionNum}>{secFotoNum}.</Text>
            <Text style={s.sectionLabel}>Fotodokumentation</Text>
          </View>

          <Text style={s.imgRowLabelFirst}>Sohlenansicht (Solar)</Text>
          <View style={s.photoGrid}>
            {SLOT_SOLAR.map((slot) => {
              const url   = photoMap[slot]
              const label = SLOT_LABELS[slot] ?? slot
              return (
                <View key={slot} style={s.photoSlot}>
                  {url ? (
                    <>
                      <Image src={url} style={s.photoImage} />
                      <Text style={s.photoCaption}>{label} — {formatGermanDate(record.recordDate)}</Text>
                    </>
                  ) : (
                    <View style={s.photoPlaceholder}>
                      <Text style={s.photoPlaceholderText}>{label}</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>

          <Text style={s.imgRowLabel}>Seitenansicht (Lateral)</Text>
          <View style={s.photoGrid}>
            {SLOT_LATERAL.map((slot) => {
              const url   = photoMap[slot]
              const label = SLOT_LABELS[slot] ?? slot
              return (
                <View key={slot} style={s.photoSlot}>
                  {url ? (
                    <>
                      <Image src={url} style={s.photoImage} />
                      <Text style={s.photoCaption}>{label} — {formatGermanDate(record.recordDate)}</Text>
                    </>
                  ) : (
                    <View style={s.photoPlaceholder}>
                      <Text style={s.photoPlaceholderText}>{label}</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        <PageFooter seller={seller} recordDate={record.recordDate} pageLabel={`Seite ${totalPages} von ${totalPages}`} />
      </Page>
    </Document>
  )
}
