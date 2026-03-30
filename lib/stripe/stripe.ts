import 'server-only'
import Stripe from 'stripe'
import { requireEnv } from '@/lib/env'

let stripeSingleton: Stripe | null = null

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton
  const key = requireEnv('STRIPE_SECRET_KEY')
  stripeSingleton = new Stripe(key, {
    typescript: true,
  })
  return stripeSingleton
}

export function getAppUrl(): string {
  return requireEnv('NEXT_PUBLIC_APP_URL').replace(/\/+$/, '')
}

