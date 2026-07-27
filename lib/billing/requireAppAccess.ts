import 'server-only'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import {
  canAccessApp,
  canWriteAppData,
  getBillingState,
} from '@/lib/billing/state'
import type { BillingAccountRow, BillingState } from '@/lib/billing/types'

export type AppAccessOk = {
  ok: true
  user: User
  userId: string
  state: BillingState
  accessScope: 'app' | 'directory_only'
}

export type AppAccessDenied = {
  ok: false
  response: NextResponse
}

/**
 * API-Guard: Session + Verzeichnis-Scope + Billing (Lesen oder Schreiben).
 * Ersetzt die Lücke, dass Middleware `/api/**` nicht matcht.
 */
export async function requireAppAccess(opts?: {
  /** default: write — mutierende / teure Endpunkte */
  mode?: 'read' | 'write'
}): Promise<AppAccessOk | AppAccessDenied> {
  const mode = opts?.mode ?? 'write'
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 }),
    }
  }

  const { data: scopeRow } = await supabase
    .from('directory_user_access')
    .select('access_scope')
    .eq('user_id', user.id)
    .maybeSingle()

  const accessScope =
    (scopeRow?.access_scope as string | null | undefined) === 'directory_only'
      ? 'directory_only'
      : 'app'

  if (accessScope === 'directory_only') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Kein App-Zugriff (nur Verzeichnis).' },
        { status: 403 }
      ),
    }
  }

  const { data: row, error } = await supabase
    .from('billing_accounts')
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Billing-Status konnte nicht geladen werden.' },
        { status: 500 }
      ),
    }
  }

  const state = getBillingState({
    account: (row as BillingAccountRow | null) ?? null,
    priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null,
  })

  if (mode === 'read') {
    if (!canAccessApp(state)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Kein App-Zugriff. Bitte Abo oder Testphase prüfen.' },
          { status: 403 }
        ),
      }
    }
  } else if (!canWriteAppData(state)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            state.access.mode === 'read_only'
              ? 'Nur Lesezugriff (Exportfenster). Schreiben ist gesperrt.'
              : 'Kein Schreibzugriff. Bitte Abo oder Testphase prüfen.',
        },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true,
    user,
    userId: user.id,
    state,
    accessScope,
  }
}
