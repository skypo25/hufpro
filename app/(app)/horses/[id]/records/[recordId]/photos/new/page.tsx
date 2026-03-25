'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { mirrorDocumentationPhotoAfterHoofInsert } from '@/lib/documentation/mirrorDocumentationPhotos'

type UploadPhotoPageProps = {
  params: Promise<{
    id: string
    recordId: string
  }>
}

type ResolvedParams = {
  id: string
  recordId: string
}

export default function UploadPhotoPage(props: UploadPhotoPageProps) {
  const router = useRouter()

  const [params, setParams] = useState<ResolvedParams | null>(null)
  const [photoType, setPhotoType] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useState(() => {
    props.params.then(setParams)
  })

  async function handleUpload() {
    if (!params) return
    if (!file) {
      setMessage('Bitte zuerst eine Datei auswählen.')
      return
    }

    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Du bist nicht eingeloggt.')
      setLoading(false)
      router.push('/login')
      return
    }

    const { data: horse, error: horseError } = await supabase
      .from('horses')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (horseError || !horse) {
      setMessage('Pferd nicht gefunden oder kein Zugriff.')
      setLoading(false)
      return
    }

    const { data: record, error: recordError } = await supabase
      .from('hoof_records')
      .select('id')
      .eq('id', params.recordId)
      .eq('horse_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (recordError || !record) {
      setMessage('Dokumentation nicht gefunden oder kein Zugriff.')
      setLoading(false)
      return
    }

    const fileExt = file.name.split('.').pop()
    const safeExt = fileExt || 'jpg'
    const filePath = `${user.id}/${params.recordId}/${Date.now()}.${safeExt}`

    const { error: uploadError } = await supabase.storage
      .from('hoof-photos')
      .upload(filePath, file, {
        upsert: false,
      })

    if (uploadError) {
      setMessage(`Upload-Fehler: ${uploadError.message}`)
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('hoof_photos')
      .insert([
        {
          user_id: user.id,
          hoof_record_id: params.recordId,
          file_path: filePath,
          photo_type: photoType || null,
        },
      ])

    if (insertError) {
      setMessage(`Datenbank-Fehler: ${insertError.message}`)
      setLoading(false)
      return
    }

    try {
      await mirrorDocumentationPhotoAfterHoofInsert(supabase, params.recordId, user.id, {
        file_path: filePath,
        photo_type: photoType || null,
        annotations_json: null,
        width: null,
        height: null,
        file_size: null,
        mime_type: null,
      })
    } catch (mirrorErr) {
      await supabase.from('hoof_photos').delete().eq('hoof_record_id', params.recordId).eq('file_path', filePath).eq('user_id', user.id)
      await supabase.storage.from('hoof-photos').remove([filePath])
      setMessage(mirrorErr instanceof Error ? mirrorErr.message : 'Dokumentationsspiegel fehlgeschlagen.')
      setLoading(false)
      return
    }

    setLoading(false)
    router.push(`/horses/${params.id}/records/${params.recordId}`)
    router.refresh()
  }

  if (!params) {
    return (
      <main className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Lade Seite ...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Foto hinzufügen</h1>
        <p className="text-sm text-slate-500">
          Füge dieser Hufdokumentation ein weiteres Foto hinzu.
        </p>
      </div>

      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4">
          <input
            type="text"
            placeholder="Fotoart, z. B. vorne / links / rechts / Sohle"
            value={photoType}
            onChange={(e) => setPhotoType(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3"
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="rounded-xl border border-slate-200 px-4 py-3"
          />

          {message && (
            <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Bitte warten ...' : 'Foto hochladen'}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/horses/${params.id}/records/${params.recordId}`)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Zurück zur Dokumentation
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}