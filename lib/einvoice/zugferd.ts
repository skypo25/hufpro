import ZUGFeRDGenerator from 'zugferd-generator'
import type { InvoicePdfData } from '@/lib/pdf/invoiceTypes'

function isoCountryToCode(country: string | null | undefined): string {
  const c = (country ?? '').trim()
  if (!c) return 'DE'
  if (c.length === 2) return c.toUpperCase()
  // Very small fallback mapping for our UI defaults
  const lower = c.toLowerCase()
  if (lower.includes('deutsch')) return 'DE'
  if (lower.includes('öster')) return 'AT'
  if (lower.includes('schweiz')) return 'CH'
  return 'DE'
}

function moneyCentsToNumber(cents: number): number {
  return Math.round(cents) / 100
}

/**
 * MVP: Embed a ZUGFeRD XML into an existing invoice PDF.
 *
 * Note: The underlying library provides a lightweight ZUGFeRD generator. For strict EN16931
 * validation / full compliance we can move to a stricter profile generator later.
 */
export async function embedZugferdIntoPdf(
  pdfBuffer: Buffer,
  data: InvoicePdfData
): Promise<Buffer> {
  const seller = data.seller
  const buyer = data.buyer

  const invoiceData = {
    id: data.invoiceNumber,
    issueDate: data.invoiceDate,
    dueDate: data.paymentDueDate ?? undefined,
    currency: 'EUR',
    totalAmount: moneyCentsToNumber(data.totalCents),
    supplier: {
      name: (seller.companyName?.trim() || seller.name || '–').trim(),
      country: isoCountryToCode(seller.country),
      street: seller.street ?? undefined,
      postalCode: seller.zip ?? undefined,
      city: seller.city ?? undefined,
      taxNumber: seller.taxNumber ?? undefined,
      legalEntityID: seller.ustId ?? undefined,
    },
    customer: {
      name: (buyer.company?.trim() || buyer.name || 'Kunde / Kundin').trim(),
      country: isoCountryToCode(buyer.country),
      street: buyer.street ?? undefined,
      postalCode: buyer.zip ?? undefined,
      city: buyer.city ?? undefined,
    },
    taxTotal: {
      taxAmount: 0,
      taxPercentage: 0,
    },
    paymentDetails: {
      bankDetails: {
        accountName: seller.accountHolder ?? undefined,
        iban: seller.iban ?? undefined,
        bic: seller.bic ?? undefined,
        bankName: seller.bank ?? undefined,
      },
    },
    notes: [
      ...(data.introText ? [data.introText] : []),
      ...(seller.kleinunternehmer && seller.kleinunternehmerText
        ? [seller.kleinunternehmerText]
        : []),
    ],
    lineItems: data.items.map((it, idx) => ({
      id: String(idx + 1),
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unitPrice: moneyCentsToNumber(it.unitPriceCents),
      lineTotal: moneyCentsToNumber(it.amountCents),
    })),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zugferd = new (ZUGFeRDGenerator as any)(invoiceData)
  const out = await zugferd.embedInPDF(pdfBuffer)
  return Buffer.from(out)
}

