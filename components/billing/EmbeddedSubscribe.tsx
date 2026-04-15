'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import SectionCard from '@/components/ui/SectionCard'

type PrepareResponse =
  | { completed: true; subscriptionId?: string; customerId?: string }
  | { clientSecret: string; intentType: 'payment' | 'setup'; subscriptionId: string; customerId: string }
  | { error: string }

function isPrepareCompletedBody(data: unknown): data is { subscriptionId?: string; customerId?: string } {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (d.completed === true || d.completed === 'true') return true
  if (d.success === true && typeof d.subscriptionId === 'string') return true
  return false
}

async function postPrepare(url: string): Promise<PrepareResponse> {
  const res = await fetch(url, { method: 'POST' })
  let data: unknown = null
  try {
    const text = await res.text()
    if (text) data = JSON.parse(text) as unknown
  } catch {
    data = null
  }
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null

  if (!res.ok) {
    const msg =
      payload && typeof payload.error === 'string' && payload.error
        ? payload.error
        : 'Aktion fehlgeschlagen.'
    return { error: msg }
  }

  if (isPrepareCompletedBody(data)) {
    const p = data as Record<string, unknown>
    return {
      completed: true,
      subscriptionId: typeof p.subscriptionId === 'string' ? p.subscriptionId : undefined,
      customerId: typeof p.customerId === 'string' ? p.customerId : undefined,
    }
  }

  if (
    payload &&
    typeof payload.clientSecret === 'string' &&
    payload.clientSecret.length > 0 &&
    (payload.intentType === 'payment' || payload.intentType === 'setup')
  ) {
    return data as PrepareResponse
  }

  return { error: 'Unerwartete Antwort vom Server.' }
}

function InnerForm({
  onSuccess,
  intentType,
  ctaLabel,
  onSetupIntentSucceeded,
}: {
  onSuccess: () => void
  intentType: 'payment' | 'setup'
  ctaLabel: string
  onSetupIntentSucceeded?: (paymentMethodId: string) => Promise<void>
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!stripe || !elements) return
    setBusy(true)
    try {
      if (intentType === 'setup') {
        const { error: stripeErr, setupIntent } = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/billing?success=1`,
          },
          redirect: 'if_required',
        })
        if (stripeErr) {
          setError(stripeErr.message || 'Zahlung fehlgeschlagen.')
          return
        }
        const pm =
          typeof setupIntent?.payment_method === 'string'
            ? setupIntent.payment_method
            : null
        if (pm && onSetupIntentSucceeded) {
          try {
            await onSetupIntentSucceeded(pm)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.')
            return
          }
        }
        onSuccess()
      } else {
        const { error: stripeErr, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/billing?success=1`,
          },
          redirect: 'if_required',
        })
        if (stripeErr) {
          setError(stripeErr.message || 'Zahlung fehlgeschlagen.')
          return
        }
        const status = paymentIntent?.status
        if (status === 'succeeded' || status === 'processing' || status === 'requires_capture') {
          onSuccess()
          return
        }
        onSuccess()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="huf-card border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] text-[#B91C1C]">
          {error}
        </div>
      )}

      <div className="rounded-[12px] border border-[#E5E2DC] bg-white px-4 py-4">
        <PaymentElement
          options={{
            wallets: {
              link: 'never',
            },
            fields: {
              billingDetails: {
                name: 'auto',
                email: 'auto',
                phone: 'auto',
                address: 'auto',
              },
            },
          }}
          onLoadError={() => {
            setError(
              'Das Zahlungsformular konnte nicht geladen werden. Bitte laden Sie die Seite neu oder versuchen Sie es erneut.'
            )
          }}
        />
      </div>

      <button
        type="button"
        className="h-[44px] w-full rounded-[12px] bg-[#1B1F23] px-5 text-[14px] font-medium text-white hover:bg-black disabled:opacity-60"
        onClick={submit}
        disabled={!stripe || !elements || busy}
      >
        {busy ? 'Wird verarbeitet…' : ctaLabel}
      </button>

      <div className="text-[12px] text-[#6B7280]">
        Die Zahlung erfolgt sicher über Stripe. Ihre Zahlungsdaten werden nicht auf AniDocs-Servern gespeichert.
      </div>
    </div>
  )
}

export default function EmbeddedSubscribe({
  stripePublishableKey,
  disabledReason,
  onCompleted,
  title = 'Abo abschließen',
  ctaLabel = 'Jetzt Abo abschließen',
  description,
  prepareUrl = '/api/stripe/subscription/prepare',
  onSetupIntentSucceeded,
}: {
  stripePublishableKey: string | null
  disabledReason?: string | null
  onCompleted?: () => void
  title?: string
  ctaLabel?: string
  description?: string
  prepareUrl?: string
  onSetupIntentSucceeded?: (paymentMethodId: string) => Promise<void>
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentType, setIntentType] = useState<'payment' | 'setup' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elementsKey, setElementsKey] = useState(0)
  const [finishedWithoutPaymentElement, setFinishedWithoutPaymentElement] = useState(false)
  const onCompletedRef = useRef(onCompleted)
  const prepareRequestGen = useRef(0)

  useEffect(() => {
    onCompletedRef.current = onCompleted
  }, [onCompleted])

  /** Stripe.js erst laden, wenn Server ein Payment/Setup freigegeben hat — nicht beim bloßen Seitenaufruf. */
  const stripePromise = useMemo(() => {
    if (!stripePublishableKey || !clientSecret) return null
    return loadStripe(stripePublishableKey) as Promise<Stripe | null>
  }, [stripePublishableKey, clientSecret])

  useEffect(() => {
    prepareRequestGen.current += 1
    const gen = prepareRequestGen.current
    const run = async () => {
      if (!stripePublishableKey) return
      if (disabledReason) return
      setLoading(true)
      setError(null)
      const res = await postPrepare(prepareUrl)
      if (gen !== prepareRequestGen.current) return
      setLoading(false)
      if ('error' in res) {
        setError(res.error)
        return
      }
      if ('completed' in res && res.completed) {
        setFinishedWithoutPaymentElement(true)
        onCompletedRef.current?.()
        return
      }
      setClientSecret(res.clientSecret)
      setIntentType(res.intentType)
      setElementsKey((k) => k + 1)
    }
    run()
  }, [stripePublishableKey, disabledReason, prepareUrl])

  const retry = async () => {
    if (!stripePublishableKey) return
    if (disabledReason) return
    setLoading(true)
    setError(null)
    setClientSecret(null)
    setIntentType(null)
    const res = await postPrepare(prepareUrl)
    setLoading(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    if ('completed' in res && res.completed) {
      setFinishedWithoutPaymentElement(true)
      onCompletedRef.current?.()
      return
    }
    setClientSecret(res.clientSecret)
    setIntentType(res.intentType)
    setElementsKey((k) => k + 1)
  }

  const body = (() => {
    if (!stripePublishableKey) {
      return (
        <div className="text-[14px] text-[#B91C1C]">
          Konfiguration fehlt: <code className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>
        </div>
      )
    }
    if (disabledReason) {
      return <div className="text-[14px] text-[#6B7280]">{disabledReason}</div>
    }
    if (finishedWithoutPaymentElement) {
      return <div className="text-[14px] text-[#6B7280]">Abo wurde aktiviert. Seite wird gleich aktualisiert…</div>
    }
    if (loading) {
      return <div className="text-[14px] text-[#6B7280]">Zahlung wird vorbereitet…</div>
    }
    if (error) {
      return (
        <div className="space-y-3">
          <div className="huf-card border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] text-[#B91C1C]">
            {error}
          </div>
          <button
            type="button"
            className="h-[40px] rounded-[10px] border border-[#E5E2DC] bg-white px-4 text-[13px] font-semibold text-[#1B1F23] hover:bg-[#FAFAFA] disabled:opacity-60"
            onClick={retry}
            disabled={loading}
          >
            Erneut versuchen
          </button>
        </div>
      )
    }
    if (!clientSecret || !stripePromise || !intentType) {
      return <div className="text-[14px] text-[#6B7280]">Zahlung wird geladen…</div>
    }

    return (
      <Elements
        key={elementsKey}
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#1B1F23',
              colorText: '#1B1F23',
              colorDanger: '#B91C1C',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
              borderRadius: '12px',
            },
          },
        }}
      >
        <InnerForm
          intentType={intentType}
          ctaLabel={ctaLabel}
          onSetupIntentSucceeded={onSetupIntentSucceeded}
          onSuccess={onCompleted ?? (() => { window.location.href = '/billing?success=1' })}
        />
      </Elements>
    )
  })()

  return (
    <SectionCard
      title={title}
      bodyClassName="px-[22px] py-5 w-full"
    >
      <div className="space-y-3">
        <div className="text-[14px] text-[#6B7280]">
          {description ??
            'Schließen Sie Ihr AniDocs-Abo direkt hier ab. Falls eine 3D-Secure-Bestätigung nötig ist, öffnet sich ggf. ein kurzes Bestätigungsfenster Ihrer Bank.'}
        </div>
        {body}
      </div>
    </SectionCard>
  )
}

