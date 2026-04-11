/**
 * Verzeichnis-Import aus JSON (Array von Rohzeilen).
 *
 * Benötigt SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 *
 *   npx tsx scripts/directory/import-from-json.ts scripts/directory/sample-import.json
 *   npx tsx scripts/directory/import-from-json.ts ./meine-daten.json --dry-run
 *   npx tsx scripts/directory/import-from-json.ts ./data.json --allow-published
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

import { runDirectoryImport } from '@/lib/directory/import/runImport'
import type { DirectoryImportRawRow } from '@/lib/directory/import/types'

config({ path: resolve(process.cwd(), '.env.local') })

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) {
    console.error(`Fehlend: ${name} (in .env.local)`)
    process.exit(1)
  }
  return v
}

function parseArgs(argv: string[]) {
  const paths: string[] = []
  let dryRun = false
  let allowPublished = false
  let batchName = `import-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`

  for (const a of argv) {
    if (a === '--dry-run') dryRun = true
    else if (a === '--allow-published') allowPublished = true
    else if (a.startsWith('--batch-name=')) batchName = a.slice('--batch-name='.length)
    else if (!a.startsWith('-')) paths.push(a)
  }

  return { filePath: paths[0], dryRun, allowPublished, batchName }
}

async function main() {
  const { filePath, dryRun, allowPublished, batchName } = parseArgs(process.argv.slice(2))
  if (!filePath) {
    console.error(
      'Usage: npx tsx scripts/directory/import-from-json.ts <pfad.json> [--dry-run] [--allow-published] [--batch-name=...]'
    )
    process.exit(1)
  }

  const abs = resolve(process.cwd(), filePath)
  const rawText = await readFile(abs, 'utf8')
  const parsed = JSON.parse(rawText) as unknown
  if (!Array.isArray(parsed)) {
    console.error('JSON muss ein Array von Zeilenobjekten sein.')
    process.exit(1)
  }

  const rows = parsed as DirectoryImportRawRow[]

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  console.log(
    JSON.stringify(
      {
        file: abs,
        rows: rows.length,
        dryRun,
        allowPublished,
        batchName,
      },
      null,
      2
    )
  )

  const result = await runDirectoryImport(supabase, rows, {
    batchName,
    dryRun,
    allowPublishedFromSource: allowPublished,
    createdByUserId: null,
  })

  console.log(JSON.stringify(result, null, 2))
  if (result.errors.length > 0) {
    console.warn('Zeilen mit Hinweisen/Fehlern:', result.errors.length)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
