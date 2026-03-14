import React from "react"
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer"
import type { RecordPdfData } from "@/lib/pdf/types"
import type { PdfBranding } from "@/lib/pdf/branding"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#154226",
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLogo: {
    width: 80,
    height: 40,
    objectFit: "contain",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1B1F23",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1B1F23",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 100,
    color: "#6B7280",
  },
  value: {
    flex: 1,
    color: "#1B1F23",
  },
  blockText: {
    color: "#374151",
    lineHeight: 1.5,
    textAlign: "justify",
    marginBottom: 4,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  photoWrap: {
    width: "31%",
    marginBottom: 8,
  },
  photoImage: {
    width: "100%",
    height: 90,
    objectFit: "cover",
    borderRadius: 4,
  },
  photoLabel: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9CA3AF",
  },
})

function formatGermanDate(dateString: string | null | undefined) {
  if (!dateString) return "–"
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

type RecordPdfDocumentProps = {
  data: RecordPdfData
  branding: PdfBranding
}

export default function RecordPdfDocument({
  data,
  branding,
}: RecordPdfDocumentProps) {
  const { horse, customer, record, photos } = data
  const primary = branding.primaryColor
  const secondary = branding.secondaryColor

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ ...styles.header, borderBottomColor: primary }}>
          {branding.logoUrl ? (
            <Image src={branding.logoUrl} style={styles.headerLogo} />
          ) : (
            <View />
          )}
          <Text style={{ ...styles.title, color: secondary }}>
            Hufdokumentation
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={{ ...styles.sectionTitle, color: primary }}>
            Pferd / Kunde / Termin
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>Pferd</Text>
            <Text style={styles.value}>{horse.name}</Text>
          </View>
          {(horse.breed || horse.sex || horse.ageYears != null) && (
            <View style={styles.row}>
              <Text style={styles.label}>Rasse / Geschlecht / Alter</Text>
              <Text style={styles.value}>
                {[horse.breed, horse.sex, horse.ageYears != null ? `${horse.ageYears} J.` : null]
                  .filter(Boolean)
                  .join(" · ") || "–"}
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Kunde</Text>
            <Text style={styles.value}>{customer.name}</Text>
          </View>
          {(customer.stableName || customer.city) && (
            <View style={styles.row}>
              <Text style={styles.label}>Stall / Ort</Text>
              <Text style={styles.value}>
                {[customer.stableName, customer.city].filter(Boolean).join(" · ") || "–"}
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Datum</Text>
            <Text style={styles.value}>{formatGermanDate(record.recordDate)}</Text>
          </View>
          {record.recordType && (
            <View style={styles.row}>
              <Text style={styles.label}>Terminart</Text>
              <Text style={styles.value}>{record.recordType}</Text>
            </View>
          )}
        </View>

        {record.hoofCondition && (
          <View style={styles.section}>
<Text style={{ ...styles.sectionTitle, color: primary }}>
            Beobachtungen / Verlauf
          </Text>
            <Text style={styles.blockText}>{record.hoofCondition}</Text>
          </View>
        )}

        {record.treatment && (
          <View style={styles.section}>
<Text style={{ ...styles.sectionTitle, color: primary }}>
            Empfehlung / Behandlung
          </Text>
            <Text style={styles.blockText}>{record.treatment}</Text>
          </View>
        )}

        {record.notes && (
          <View style={styles.section}>
<Text style={{ ...styles.sectionTitle, color: primary }}>
            Notizen
          </Text>
            <Text style={styles.blockText}>{record.notes}</Text>
          </View>
        )}

        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={{ ...styles.sectionTitle, color: primary }}>
              Fotos
            </Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image
                    src={photo.dataUrl}
                    style={styles.photoImage}
                  />
                  <Text style={styles.photoLabel}>{photo.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Hufdokumentation · {horse.name}</Text>
          <Text>{formatGermanDate(record.recordDate)}</Text>
        </View>
      </Page>
    </Document>
  )
}
