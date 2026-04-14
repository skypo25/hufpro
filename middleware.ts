import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  DIRECTORY_WIZARD_PAKET_COOKIE,
  safeInternalPath,
  safeNextPath,
} from '@/lib/auth/safeNextPath'
import {
  directoryPublicPaketFromUserMetadata,
  isDirectoryBehandlerProfilFlowReturnPath,
} from '@/lib/directory/public/appBaseUrl'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import { getBillingState, canAccessApp } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'

/** `public/directory/*` (Hero, Kategorie-SVGs): gleicher URL-Prefix wie geschützte App-Routen unter `/directory/…`. */
function isDirectoryPublicStaticAsset(pathname: string): boolean {
  return /^\/directory\/[^/]+\.(svg|png|jpe?g|webp|gif|ico)$/i.test(pathname)
}

function directoryPaketFromCookie(request: NextRequest): 'gratis' | 'premium' | null {
  const v = request.cookies.get(DIRECTORY_WIZARD_PAKET_COOKIE)?.value?.trim().toLowerCase()
  return v === 'premium' ? 'premium' : v === 'gratis' ? 'gratis' : null
}

function redirectWizardClearPaketCookie(request: NextRequest, paket: 'gratis' | 'premium'): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/directory/mein-profil'
  url.search = `?paket=${paket}`
  const res = NextResponse.redirect(url)
  res.cookies.set(DIRECTORY_WIZARD_PAKET_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const adminIds = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const isAdminUser = !!(user && adminIds.includes(user.id))

  let accessScope: 'app' | 'directory_only' = 'app'
  if (user) {
    const { data: scopeRow } = await supabase
      .from('directory_user_access')
      .select('access_scope')
      .eq('user_id', user.id)
      .maybeSingle()
    const raw = (scopeRow?.access_scope as string | null | undefined) ?? null
    if (raw === 'directory_only') accessScope = 'directory_only'
  }

  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    if (!isAdminUser) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return response
  }

  // Directory-only Nutzer: nur /directory (Profilpflege) + Auth/Callback
  if (user && !isAdminUser && accessScope === 'directory_only') {
    const isAuthCallback = pathname.startsWith('/auth/')
    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
    const isBehandlerPublic =
      pathname === '/behandler' || pathname.startsWith('/behandler/')
    const isDirectoryInternal =
      pathname === '/directory' ||
      pathname.startsWith('/directory/') ||
      isBehandlerPublic
    if (isAuthCallback) return response
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      const nextRaw = request.nextUrl.searchParams.get('next')
      const internal = safeInternalPath(nextRaw)
      if (internal && isDirectoryBehandlerProfilFlowReturnPath(internal)) {
        const q = internal.indexOf('?')
        url.pathname = q === -1 ? internal : internal.slice(0, q)
        url.search = q === -1 ? '' : `?${internal.slice(q + 1)}`
        return NextResponse.redirect(url)
      }
      url.pathname = '/directory/mein-profil'
      url.search = ''
      return NextResponse.redirect(url)
    }
    if (!isDirectoryInternal) {
      const url = request.nextUrl.clone()
      url.pathname = '/directory/mein-profil'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return response
  }

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isOnboarding = pathname.startsWith('/onboarding')
  const isPublicConfirm = pathname.startsWith('/termin-bestaetigen/')
  const isBillingPath = pathname === '/billing' || pathname.startsWith('/billing/')
  /** Verzeichnis-Inhalte (Profil + Statistik): kein App-Onboarding erzwingen. */
  const isDirectoryInternVerzeichnis =
    pathname === '/directory/mein-profil' ||
    pathname.startsWith('/directory/mein-profil/') ||
    pathname === '/directory/statistik'
  /** Öffentliches Verzeichnis (/behandler): kein App-Onboarding erzwingen (Gratis/Premium-Flow). */
  const isBehandlerPublicTree = pathname === '/behandler' || pathname.startsWith('/behandler/')
  const isProtectedPage =
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/horses') ||
    pathname.startsWith('/animals') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/suche') ||
    pathname.startsWith('/invoices') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/appointments') ||
    (pathname.startsWith('/directory') && !isDirectoryPublicStaticAsset(pathname)) ||
    isBillingPath

  const priceIdMonthly = process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null

  // Unauthenticated → send to login (Ziel merken für Rückkehr nach Auth)
  if (!user && (isProtectedPage || isOnboarding) && !isPublicConfirm) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    const returnPath = `${pathname}${request.nextUrl.search}`
    if (returnPath.startsWith('/') && !returnPath.startsWith('//')) {
      url.searchParams.set('next', returnPath)
    }
    return NextResponse.redirect(url)
  }

  // Authenticated: check onboarding status
  if (user) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()
    const onboardingComplete = (settings?.settings as { onboarding_complete?: boolean } | null)?.onboarding_complete === true

    // Authenticated on auth pages → Verzeichnis-Wizard bevorzugen, sonst Dashboard / App-Onboarding
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      const nextRaw = request.nextUrl.searchParams.get('next')
      const internal = safeInternalPath(nextRaw)
      if (internal && isDirectoryBehandlerProfilFlowReturnPath(internal)) {
        const q = internal.indexOf('?')
        url.pathname = q === -1 ? internal : internal.slice(0, q)
        url.search = q === -1 ? '' : `?${internal.slice(q + 1)}`
        return NextResponse.redirect(url)
      }
      const dirPaketMeta = directoryPublicPaketFromUserMetadata(user)
      const dirPaketCookie = directoryPaketFromCookie(request)
      if (onboardingComplete) {
        url.pathname = safeNextPath(nextRaw, '/dashboard')
        url.search = ''
      } else if (!internal && dirPaketMeta) {
        url.pathname = '/directory/mein-profil'
        url.search = `?paket=${dirPaketMeta}`
      } else if (!internal && dirPaketCookie) {
        return redirectWizardClearPaketCookie(request, dirPaketCookie)
      } else if (pathname.startsWith('/login') && !internal) {
        /** Sonst Falle: eingeloggt, kein `next`, kein Verzeichnis-Meta → /login war bisher unmöglich (immer → Onboarding). */
        return response
      } else if (!internal) {
        url.pathname = '/onboarding'
        url.search = ''
      } else {
        url.pathname = '/onboarding'
        url.search = ''
      }
      return NextResponse.redirect(url)
    }

    // Authenticated on protected page but onboarding not complete → App-Onboarding
    // Ausnahmen: Verzeichnis „Mein Profil“ / Statistik, gesamter öffentlicher /behandler-Baum (Profil-Wizard, Listing, …).
    if (
      isProtectedPage &&
      !onboardingComplete &&
      !isBillingPath &&
      !isDirectoryInternVerzeichnis &&
      !isBehandlerPublicTree
    ) {
      const dirPaketMeta = directoryPublicPaketFromUserMetadata(user)
      const dirPaketCookie = directoryPaketFromCookie(request)
      if (dirPaketMeta) {
        const url = request.nextUrl.clone()
        url.pathname = '/directory/mein-profil'
        url.search = `?paket=${dirPaketMeta}`
        return NextResponse.redirect(url)
      }
      if (dirPaketCookie) {
        return redirectWizardClearPaketCookie(request, dirPaketCookie)
      }
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // Nach Onboarding: ohne App-Zugriff (z. B. Test abgelaufen) nur noch Billing + Export-Fenster
    if (user && isProtectedPage && onboardingComplete && !isBillingPath) {
      const { data: billingRow, error: billingFetchError } = await supabase
        .from('billing_accounts')
        .select(BILLING_ACCOUNT_COLUMNS)
        .eq('user_id', user.id)
        .maybeSingle()

      if (billingFetchError) {
        console.warn(
          JSON.stringify({
            event: 'billing_middleware_fetch_failed',
            at: new Date().toISOString(),
            userId: user.id,
            code: billingFetchError.code ?? null,
          })
        )
        const url = request.nextUrl.clone()
        url.pathname = '/billing'
        url.search = ''
        url.searchParams.set('billing_check', 'failed')
        return NextResponse.redirect(url)
      }

      const billingState = getBillingState({
        account: (billingRow as BillingAccountRow | null) ?? null,
        priceIdMonthly,
      })

      if (!canAccessApp(billingState)) {
        const url = request.nextUrl.clone()
        url.pathname = '/billing'
        url.searchParams.set('blocked', '1')
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/auth/callback/:path*',
    '/auth/confirm/:path*',
    '/onboarding',
    '/dashboard/:path*',
    '/customers/:path*',
    '/horses/:path*',
    '/animals/:path*',
    '/calendar/:path*',
    '/suche/:path*',
    '/invoices/:path*',
    '/settings/:path*',
    '/appointments/:path*',
    '/directory',
    '/directory/:path*',
    '/billing',
    '/billing/:path*',
    '/termin-bestaetigen/:path*',
    '/admin/:path*',
    '/behandler',
    '/behandler/:path*',
  ],
}