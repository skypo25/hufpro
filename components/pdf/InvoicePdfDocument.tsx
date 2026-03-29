import React from "react"
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import type { InvoicePdfData } from "@/lib/pdf/invoiceTypes"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: "#52b788",
  },
  header: {
    marginTop: 8,
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#edf3ef",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    objectFit: "contain",
  },
  logoText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: "#0f301b",
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1B1F23",
  },
  companySub: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 3,
  },
  titleBlock: {
    textAlign: "right",
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: "#52b788",
  },
  invNr: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 4,
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 24,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  metaContent: {
    fontSize: 11,
    color: "#1B1F23",
    lineHeight: 1.6,
  },
  metaContentBold: {
    fontWeight: 700,
  },
  metaContentRight: {
    textAlign: "right",
  },
  introText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
    marginBottom: 14,
  },
  tableWrap: {
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E2DC",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  thLeistung: { flex: 1 },
  thAnzahl: { width: 50, textAlign: "center" },
  thEinzel: { width: 75, textAlign: "right" },
  thBetrag: { width: 75, textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E2DC",
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  tdLeistung: { flex: 1, fontWeight: 700, color: "#1B1F23", fontSize: 11 },
  tdAnzahl: { width: 50, textAlign: "center", color: "#374151", fontSize: 11 },
  tdEinzel: { width: 75, textAlign: "right", fontSize: 11 },
  tdBetrag: { width: 75, textAlign: "right", fontWeight: 700, color: "#52b788", fontSize: 11 },
  summaryWrap: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  summaryBox: {
    width: 220,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    fontSize: 10,
  },
  summaryRowSub: {
    color: "#6B7280",
  },
  summaryDivider: {
    borderTopWidth: 2,
    borderTopColor: "#1B1F23",
    marginTop: 6,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: 700,
  },
  summaryTotalAmount: {
    color: "#52b788",
    fontSize: 14,
  },
  taxNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    padding: 12,
    backgroundColor: "#FEF7F0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(21,66,38,0.25)",
  },
  taxNoticeIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#52b788",
    alignItems: "center",
    justifyContent: "center",
  },
  taxNoticeIconText: {
    fontSize: 10,
    fontWeight: 700,
    color: "#52b788",
  },
  taxNoticeText: {
    flex: 1,
    fontSize: 10,
    color: "#0f301b",
    lineHeight: 1.4,
  },
  paymentBox: {
    flexDirection: "row",
    marginBottom: 24,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 10,
    gap: 20,
  },
  paymentCol: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  paymentContent: {
    fontSize: 10,
    color: "#1B1F23",
    lineHeight: 1.6,
  },
  paymentIban: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#E5E2DC",
    paddingTop: 12,
    fontSize: 8,
    color: "#9CA3AF",
    lineHeight: 1.5,
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    textAlign: "right",
  },
  footerAniDocs: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#52b788",
  },
})

function formatDate(d: string | null | undefined): string {
  if (!d) return "–"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(date)
}

function formatDateShort(d: string | null | undefined): string {
  if (!d) return "–"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function formatAddress(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ") || "–"
}

type InvoicePdfDocumentProps = {
  data: InvoicePdfData
}

export default function InvoicePdfDocument({ data }: InvoicePdfDocumentProps) {
  const { seller, buyer, items, totalCents } = data
  const kleinunternehmer = seller.kleinunternehmer
  const kleinunternehmerText = seller.kleinunternehmerText

  const sellerDisplayName = seller.companyName?.trim() || seller.name
  const sellerAddress = formatAddress([seller.street, [seller.zip, seller.city].filter(Boolean).join(" "), seller.country])
  const buyerStreetCity = formatAddress([buyer.street, [buyer.zip, buyer.city].filter(Boolean).join(" ")])

  const logoInitials = (sellerDisplayName || seller.name).slice(0, 2).toUpperCase()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />

        {/* Header: Logo + Firmenname | Rechnung + Nr. */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {seller.logoUrl ? (
              <Image src={seller.logoUrl} style={styles.logoImage} />
            ) : (
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>{logoInitials}</Text>
              </View>
            )}
            <View>
              <Text style={styles.companyName}>{sellerDisplayName}</Text>
              <Text style={styles.companySub}>
                {seller.name}
                {seller.qualification ? ` · ${seller.qualification}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Rechnung</Text>
            <Text style={styles.invNr}>{data.invoiceNumber}</Text>
          </View>
        </View>

        {/* Zwei Spalten: Rechnungsempfänger | Rechnungsdaten */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Rechnungsempfänger</Text>
            <Text style={styles.metaContent}>
              <Text style={styles.metaContentBold}>{buyer.name}</Text>
              {[buyer.company, buyerStreetCity !== "–" ? buyerStreetCity : null, buyer.country].filter(Boolean).length ? "\n" + [buyer.company, buyerStreetCity !== "–" ? buyerStreetCity : null, buyer.country].filter(Boolean).join("\n") : ""}
            </Text>
          </View>
          <View style={[styles.metaCol, styles.metaContentRight]}>
            <Text style={styles.metaLabel}>Rechnungsdaten</Text>
            <Text style={styles.metaContent}>
              {data.customerNumberDisplay ? <><Text style={styles.metaContentBold}>Kundennummer:</Text> {data.customerNumberDisplay}{"\n"}</> : null}
              <Text style={styles.metaContentBold}>Rechnungsnummer:</Text> {data.invoiceNumber}{"\n"}
              <Text style={styles.metaContentBold}>Rechnungsdatum:</Text> {formatDate(data.invoiceDate)}
              {data.paymentDueDate ? `\n` : ""}{data.paymentDueDate ? <><Text style={styles.metaContentBold}>Zahlungsziel:</Text> {formatDate(data.paymentDueDate)}</> : ""}
              {data.sentAt
                ? `\nVersendet: ${formatDateShort(data.sentAt)}`
                : ""}
              {data.paidAt
                ? `\nZahlungseingang: ${formatDateShort(data.paidAt)}`
                : ""}
            </Text>
          </View>
        </View>

        {(data.serviceDateFrom || data.serviceDateTo) && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.metaLabel}>Leistungszeitraum</Text>
            <Text style={styles.metaContent}>
              {data.serviceDateFrom && formatDateShort(data.serviceDateFrom)}
              {data.serviceDateFrom && data.serviceDateTo ? " – " : ""}
              {data.serviceDateTo && formatDateShort(data.serviceDateTo)}
            </Text>
          </View>
        )}

        {data.introText && <Text style={styles.introText}>{data.introText}</Text>}

        {/* Leistungstabelle */}
        <View style={styles.tableWrap}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.thLeistung]}>Leistung</Text>
            <Text style={[styles.tableHeaderText, styles.thAnzahl]}>Anzahl</Text>
            <Text style={[styles.tableHeaderText, styles.thEinzel]}>Einzelpreis</Text>
            <Text style={[styles.tableHeaderText, styles.thBetrag]}>Betrag</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tdLeistung}>{item.description}</Text>
              <Text style={styles.tdAnzahl}>{item.quantity}</Text>
              <Text style={styles.tdEinzel}>{formatCurrency(item.unitPriceCents)}</Text>
              <Text style={styles.tdBetrag}>{formatCurrency(item.amountCents)}</Text>
            </View>
          ))}
        </View>

        {/* Zusammenfassung rechts */}
        <View style={styles.summaryWrap}>
          <View style={styles.summaryBox}>
            <View style={[styles.summaryRow, styles.summaryRowSub]}>
              <Text>Zwischensumme</Text>
              <Text>{formatCurrency(totalCents)}</Text>
            </View>
            {kleinunternehmer && (
              <View style={[styles.summaryRow, styles.summaryRowSub]}>
                <Text>Umsatzsteuer</Text>
                <Text>entfällt (§19 UStG)</Text>
              </View>
            )}
            <View style={styles.summaryDivider}>
              <Text>Gesamtbetrag</Text>
              <Text style={styles.summaryTotalAmount}>{formatCurrency(totalCents)}</Text>
            </View>
          </View>
        </View>

        {/* Kleinunternehmer-Hinweis (Banner wie im Bild) */}
        {kleinunternehmer && kleinunternehmerText && (
          <View style={styles.taxNotice}>
            <View style={styles.taxNoticeIcon}>
              <Text style={styles.taxNoticeIconText}>i</Text>
            </View>
            <Text style={styles.taxNoticeText}>{kleinunternehmerText}</Text>
          </View>
        )}

        {/* Zahlungsinformation: Bankverbindung | Zahlungshinweis */}
        <View style={styles.paymentBox}>
          <View style={styles.paymentCol}>
            <Text style={styles.paymentLabel}>Bankverbindung</Text>
            <Text style={styles.paymentContent}>
              {seller.accountHolder && <Text style={styles.metaContentBold}>{seller.accountHolder}{"\n"}</Text>}
              {seller.bank && <Text>{seller.bank}{"\n"}</Text>}
              {seller.iban && <Text style={styles.paymentIban}>{seller.iban}</Text>}
              {seller.bic && <Text>{"\n"}BIC: {seller.bic}</Text>}
              {!seller.accountHolder && !seller.bank && !seller.iban && !seller.bic && "–"}
            </Text>
          </View>
          <View style={styles.paymentCol}>
            <Text style={styles.paymentLabel}>Zahlungshinweis</Text>
            <Text style={styles.paymentContent}>
              {data.footerText || `Bitte überweisen Sie den Betrag innerhalb von 7 Tagen auf das unten angegebene Konto. Bei Fragen stehe ich Ihnen gerne zur Verfügung.`}
            </Text>
          </View>
        </View>

        {/* Footer: Links Firmendaten, rechts AniDocs */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text>
              {[
                `${sellerDisplayName}${seller.name && sellerDisplayName !== seller.name ? ` · ${seller.name}` : ""}`,
                sellerAddress !== "–" ? sellerAddress : null,
                seller.phone ? `Tel: ${seller.phone}` : null,
                seller.email || null,
                seller.website || null,
                seller.taxNumber ? `Steuernummer: ${seller.taxNumber}${seller.taxOffice ? ` · ${seller.taxOffice}` : ""}` : null,
              ].filter(Boolean).join("\n")}
            </Text>
          </View>
          <View style={styles.footerRight}>
            <Text>Erstellt mit <Text style={styles.footerAniDocs}>AniDocs</Text></Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
