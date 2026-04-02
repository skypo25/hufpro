import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isOnboarding = pathname.startsWith('/onboarding')
  const isPublicConfirm = pathname.startsWith('/termin-bestaetigen/')
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
    pathname.startsWith('/appointments')

  // Unauthenticated → send to login
  if (!user && (isProtectedPage || isOnboarding) && !isPublicConfirm) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
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

    // Authenticated on auth pages → send to onboarding or dashboard
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = onboardingComplete ? '/dashboard' : '/onboarding'
      return NextResponse.redirect(url)
    }

    // Authenticated on protected page but onboarding not complete → send to onboarding
    if (isProtectedPage && !onboardingComplete) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
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
    '/termin-bestaetigen/:path*',
    '/admin/:path*',
  ],
}