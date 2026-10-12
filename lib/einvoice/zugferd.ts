import { zugferd } from 'node-zugferd'
import { EN16931 } from 'node-zugferd/profile/en16931'
import type { InvoicePdfData } from '@/lib/pdf/invoiceTypes'
import { resolveKleinunternehmerHinweis } from '@/lib/invoices/kleinunternehmer'

function isoCountryToCode(country: string | null | undefined): string {
  const c = (country ?? '').trim()
  if (!c) return 'DE'
  if (c.length === 2) return c.toUpperCase()
  const lower = c.toLowerCase()
  if (lower.includes('deutsch')) return 'DE'
  if (lower.includes('öster')) return 'AT'
  if (lower.includes('schweiz')) return 'CH'
  return 'DE'
}

function money(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2)
}

function parseDate(raw: string | null | undefined): Date | undefined {
  if (!raw) return undefined
  // DB: YYYY-MM-DD oder ISO
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function cleanIban(iban: string | null | undefined): string | undefined {
  const v = (iban ?? '').replace(/\s+/g, '').toUpperCase()
  return v.length >= 15 ? v : undefined
}

/**
 * Embed ZUGFeRD / Factur-X **EN 16931** XML into PDF (PDF/A-3 hybrid).
 * Validierung (XSD) ist auf dem Server ohne Java deaktiviert (`strict: false`);
 * Struktur folgt dem EN-16931-Sample von node-zugferd.
 */
export async function embedZugferdIntoPdf(
  pdfBuffer: Buffer,
  data: InvoicePdfData
): Promise<Buffer> {
  const seller = data.seller
  const buyer = data.buyer
  const ku = seller.kleinunternehmer
  const kuNote = resolveKleinunternehmerHinweis(ku, seller.kleinunternehmerText)
  const rate = ku ? 0 : data.taxRatePercent ?? 0
  const categoryCode = ku ? 'E' : 'S'
  const issueDate = parseDate(data.invoiceDate) ?? new Date()
  const dueDate = parseDate(data.paymentDueDate)
  const serviceDate =
    parseDate(data.serviceDateFrom) ?? parseDate(data.serviceDateTo) ?? issueDate

  const sellerName = (seller.companyName?.trim() || seller.name || '–').trim()
  const buyerName = (buyer.company?.trim() || buyer.name || 'Kunde / Kundin').trim()
  const iban = cleanIban(seller.iban)

  const sellerTax: { vatIdentifier?: string; localIdentifier?: string } = {}
  if (seller.ustId?.trim()) sellerTax.vatIdentifier = seller.ustId.trim()
  else if (seller.taxNumber?.trim()) sellerTax.localIdentifier = seller.taxNumber.trim()

  const lines = data.items.map((it, idx) => {
    const lineNet = money(it.amountCents)
    const lineRate = ku ? 0 : it.taxRatePercent || rate
    return {
      identifier: String(idx + 1),
      tradeProduct: {
        name: (it.description || 'Position').trim() || 'Position',
      },
      tradeAgreement: {
        netTradePrice: {
          chargeAmount: money(it.unitPriceCents),
          basisQuantity: {
            amount: 1,
            unitMeasureCode: 'C62' as const,
          },
        },
      },
      tradeDelivery: {
        billedQuantity: {
          amount: Number(it.quantity) || 1,
          unitMeasureCode: 'C62' as const,
        },
      },
      tradeSettlement: {
        tradeTax: {
          typeCode: 'VAT' as const,
          categoryCode: categoryCode as 'E' | 'S',
          rateApplicablePercent: String(lineRate),
          ...(ku && kuNote ? { exemptionReasonText: kuNote } : {}),
        },
        monetarySummation: {
          lineTotalAmount: lineNet,
        },
      },
    }
  })

  const net = money(data.netCents)
  const tax = money(data.taxCents ?? 0)
  const total = money(data.totalCents)

  const invoiceData = {
    number: data.invoiceNumber,
    typeCode: '380' as const,
    issueDate,
    ...(data.introText?.trim() || kuNote
      ? {
          includedNote: [
            ...(data.introText?.trim()
              ? [{ content: data.introText.trim() }]
              : []),
            ...(kuNote ? [{ content: kuNote }] : []),
          ],
        }
      : {}),
    transaction: {
      line: lines,
      tradeAgreement: {
        seller: {
          name: sellerName,
          postalAddress: {
            postCode: seller.zip?.trim() || '00000',
            line1: seller.street?.trim() || '–',
            city: seller.city?.trim() || '–',
            countryCode: isoCountryToCode(seller.country) as 'DE',
          },
          ...(Object.keys(sellerTax).length > 0
            ? { taxRegistration: sellerTax }
            : {}),
        },
        buyer: {
          name: buyerName,
          postalAddress: {
            postCode: buyer.zip?.trim() || '00000',
            line1: buyer.street?.trim() || '–',
            city: buyer.city?.trim() || '–',
            countryCode: isoCountryToCode(buyer.country) as 'DE',
          },
        },
      },
      tradeDelivery: {
        information: {
          deliveryDate: serviceDate,
        },
      },
      tradeSettlement: {
        currencyCode: 'EUR' as const,
        ...(iban
          ? {
              paymentInstruction: {
                typeCode: '58' as const,
                transfers: [
                  {
                    accountName: (seller.accountHolder || sellerName).trim(),
                    paymentAccountIdentifier: iban,
                  },
                ],
              },
            }
          : {}),
        vatBreakdown: [
          {
            calculatedAmount: tax,
            typeCode: 'VAT' as const,
            basisAmount: net,
            categoryCode: categoryCode as 'E' | 'S',
            rateApplicablePercent: String(rate),
            ...(ku && kuNote ? { exemptionReasonText: kuNote } : {}),
          },
        ],
        ...(dueDate ? { paymentTerms: { dueDate } } : {}),
        monetarySummation: {
          lineTotalAmount: net,
          taxBasisTotalAmount: net,
          taxTotal: {
            amount: tax,
            currencyCode: 'EUR' as const,
          },
          grandTotalAmount: total,
          duePayableAmount: total,
        },
      },
    },
  }

  // Ohne Java/XSD auf Vercel: strict false. Profil bleibt EN 16931.
  const invoicer = zugferd({ profile: EN16931, strict: false })
  const invoice = invoicer.create(invoiceData as never)
  const out = await invoice.embedInPdf(pdfBuffer, {
    metadata: {
      title: `Rechnung ${data.invoiceNumber}`,
      author: sellerName,
    },
  })
  return Buffer.from(out)
}

/** Baut das finale Rechnungs-PDF — mit oder ohne ZUGFeRD. */
export async function buildInvoicePdfBuffer(
  pdfBuffer: Buffer,
  data: InvoicePdfData,
  withZugferd: boolean
): Promise<Buffer> {
  if (!withZugferd) return pdfBuffer
  return embedZugferdIntoPdf(pdfBuffer, data)
}
