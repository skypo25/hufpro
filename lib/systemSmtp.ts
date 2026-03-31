import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export type SystemSmtpRow = {
  host: string
  port: number
  secure: boolean
  smtp_user: string
  password: string
  from_email: string | null
  from_name: string | null
}

export async function fetchSystemSmtp(): Promise<SystemSmtpRow | null> {
  const db = createSupabaseServiceRoleClient()
  const { data, error } = await db
    .from('system_smtp')
    .select('host, port, secure, smtp_user, password, from_email, from_name')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) return null
  return data as SystemSmtpRow
}

