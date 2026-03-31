import type { AdminBillingBucket, AdminUserListRow } from '@/lib/admin/data'
import { formatGermanDate } from '@/lib/format'
import { daysBetweenFloor } from '@/lib/format'

const PRO_PRICE = '39,95 €'

function trialDaysLeft(now: Date, trialEnd: Date): number {
  const ms = trialEnd.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export function adminBillingPrimarySecondary(
  row: AdminUserListRow,
  now: Date = new Date()
): { primary: string; secondary: string; accent: 'default' | 'blue' | 'orange' | 'danger' | 'muted' } {
  const bill = row.billing
  const b = row.billingBucket

  if (b === 'past_due' || b === 'unpaid') {
    return {
      primary: 'Zahlung offen',
      secondary: bill?.billing_email ? bill.billing_email : 'Stripe',
      accent: 'danger',
    }
  }

  if (b === 'canceled') {
    const until = bill?.subscription_current_period_end
    return {
      primary: 'Gekündigt',
      secondary: until ? `Aktiv bis ${formatGermanDate(until)}` : '—',
      accent: 'muted',
    }
  }

  if (b === 'active' || b === 'trialing') {
    const next = bill?.subscription_current_period_end
    return {
      primary: `Pro · ${PRO_PRICE}`,
      secondary: next ? `Nächste: ${formatGermanDate(next)}` : '—',
      accent: 'default',
    }
  }

  if (b === 'trial') {
    const te = bill?.trial_ends_at ? new Date(bill.trial_ends_at) : null
    if (te && !Number.isNaN(te.getTime())) {
      const days = trialDaysLeft(now, te)
      return {
        primary: 'Trial',
        secondary: `Endet ${formatGermanDate(bill?.trial_ends_at ?? null)} (${days} Tage)`,
        accent: 'blue',
      }
    }
    return { primary: 'Trial', secondary: '—', accent: 'blue' }
  }

  if (b === 'trial_expired') {
    const te = bill?.trial_ends_at ? new Date(bill.trial_ends_at) : null
    if (te && !Number.isNaN(te.getTime())) {
      const days = daysBetweenFloor(te, now)
      return {
        primary: 'Trial abgelaufen',
        secondary: `Seit ${formatGermanDate(bill?.trial_ends_at ?? null)} (${days} Tage)`,
        accent: 'orange',
      }
    }
    return { primary: 'Trial abgelaufen', secondary: '—', accent: 'orange' }
  }

  return { primary: '—', secondary: 'Kein Abo', accent: 'muted' }
}

export function statusBadgeForBucket(bucket: AdminBillingBucket): {
  label: string
  icon: string
  className: string
} {
  switch (bucket) {
    case 'active':
      return {
        label: 'Aktiv',
        icon: 'bi-circle-fill',
        className: 'bg-[rgba(82,183,136,.08)] text-[#52b788]',
      }
    case 'trialing':
    case 'trial':
      return {
        label: 'Trial',
        icon: 'bi-clock-fill',
        className: 'bg-[rgba(59,130,246,.08)] text-[#3B82F6]',
      }
    case 'trial_expired':
      return {
        label: 'Trial expired',
        icon: 'bi-clock-fill',
        className: 'bg-[rgba(249,115,22,.08)] text-[#F97316]',
      }
    case 'past_due':
    case 'unpaid':
      return {
        label: 'Past Due',
        icon: 'bi-exclamation-circle-fill',
        className: 'bg-[rgba(220,38,38,.08)] text-[#DC2626]',
      }
    case 'canceled':
      return {
        label: 'Gekündigt',
        icon: 'bi-x-circle-fill',
        className: 'bg-[rgba(107,114,128,.08)] text-[#6B7280]',
      }
    default:
      return {
        label: 'Kein Abo',
        icon: 'bi-dash-circle',
        className: 'bg-[rgba(107,114,128,.08)] text-[#6B7280]',
      }
  }
}

export function professionBadgeClass(prof: string): string {
  const p = prof.toLowerCase()
  if (p.includes('huf')) return 'bg-[rgba(82,183,136,.08)] text-[#52b788]'
  if (p.includes('physio')) return 'bg-[rgba(59,130,246,.08)] text-[#3B82F6]'
  if (p.includes('osteo')) return 'bg-[rgba(139,92,246,.08)] text-[#8B5CF6]'
  if (p.includes('heil') || p.includes('tierheil')) return 'bg-[rgba(249,115,22,.08)] text-[#F97316]'
  return 'bg-[rgba(107,114,128,.08)] text-[#6B7280]'
}

const AVATAR_HUES = ['#52b788', '#3B82F6', '#8B5CF6', '#F97316', '#DC2626', '#B8860B', '#64748B']

export function avatarColorForUserId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 7)) % 997
  return AVATAR_HUES[h % AVATAR_HUES.length]
}
