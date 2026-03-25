/**
 * Lokales JSON-Backup der Tabellen horses, hoof_records, hoof_photos (nur Lesen).
 *
 * Benötigt SUPABASE_SERVICE_ROLE_KEY — der Anon-Key umgeht RLS nicht;
 * ein vollständiger Tabellenexport ist damit in der Regel nicht möglich.
 *
 * Ausführung vom Projektroot (siehe package.json script "backup:hoof-data").
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'fs/promises'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const TABLES = ['horses', 'hoof_records', 'hoof_photos'] as const
const PAGE_SIZE = 1000

type TableName = (typeof TABLES)[number]

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) {
    console.error(`Fehler: Umgebungsvariable ${name} ist nicht gesetzt.`)
    console.error('Erwartet in .env.local (Projektroot).')
    process.exit(1)
  }
  return v
}

async function fetchAllRows(
  supabase: ReturnType<typeof createClient>,
  table: TableName
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let from = 0

  for (;;) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase.from(table).select('*').range(from, to)

    if (error) {
      throw new Error(`Tabelle "${table}": ${error.message}`)
    }

    const batch = data ?? []
    if (batch.length === 0) break

    rows.push(...batch as Record<string, unknown>[])

    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '(ungültige URL)'
  }
}

async function main() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = resolve(process.cwd(), 'backups', `backup-${stamp}`)

  await mkdir(dir, { recursive: true })
  console.log(`Backup-Ordner: ${dir}`)

  const counts: Record<string, number> = {}

  for (const table of TABLES) {
    process.stdout.write(`Lade ${table} … `)
    const rows = await fetchAllRows(supabase, table)
    counts[table] = rows.length
    const filePath = resolve(dir, `${table}.json`)
    await writeFile(filePath, JSON.stringify(rows, null, 2), 'utf-8')
    console.log(`${rows.length} Zeilen`)
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    supabaseHost: hostFromUrl(url),
    tables: Object.fromEntries(
      TABLES.map((t) => [t, { rowCount: counts[t] ?? 0 }])
    ),
    script: 'scripts/backup-hoof-data.ts',
    note: 'Nur Kern-Tabellen; keine Storage-Dateien; keine DB-Änderungen.',
  }

  await writeFile(resolve(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
  console.log('Fertig: manifest.json geschrieben.')
}

main().catch((err) => {
  console.error('Backup fehlgeschlagen:', err instanceof Error ? err.message : err)
  process.exit(1)
})
