'use client'

import { getPhotoDebug, resetAllPhotoGridDebugKeys, setPhotoDebug } from '@/lib/mobile/photoGridDebugRuntime'
import { usePhotoGridDebugVersion } from '@/components/mobile/usePhotoGridDebugVersion'

type Props = {
  open: boolean
  onClose: () => void
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-[#F0EEEA] py-3 px-1">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[#1A1A1A]">{label}</span>
        {hint ? <span className="mt-0.5 block text-[10px] leading-snug text-[#9CA3AF]">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-9 shrink-0 cursor-pointer accent-[#52b788]"
      />
    </label>
  )
}

export default function PhotoGridDebugSheet({ open, onClose }: Props) {
  const _photoDebugRev = usePhotoGridDebugVersion()
  void _photoDebugRev

  const tabH = 64
  const safeBottom = 'env(safe-area-inset-bottom, 0px)'

  if (!open) return null

  const tileLog = getPhotoDebug('hufpflege_photo_tile_log') === '1'
  const tileOverlay = getPhotoDebug('hufpflege_photo_tile_overlay') === '1'
  const debugPhotos = getPhotoDebug('hufpflege_debug_photos') === '1'
  const staggerOff = getPhotoDebug('hufpflege_photo_disable_stagger') === '1'
  const remountOff = getPhotoDebug('hufpflege_photo_disable_grid_remount') === '1'
  const intersectionOff = getPhotoDebug('hufpflege_photo_disable_intersection') === '1'
  const decodingSyncOn = getPhotoDebug('hufpflege_photo_decoding_sync') !== '0'
  const layerPromoteOn = getPhotoDebug('hufpflege_photo_disable_layer_promote') !== '1'
  const objectFitContain = getPhotoDebug('hufpflege_photo_object_fit_contain') === '1'
  const bgImageTest = getPhotoDebug('hufpflege_photo_use_bg_image') === '1'

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 z-[160] bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-1/2 z-[170] max-h-[85dvh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.2)]"
        style={{
          transform: 'translateX(-50%) translateY(0)',
          paddingBottom: `calc(${tabH}px + ${safeBottom} + 12px)`,
        }}
      >
        <div className="flex items-center justify-between border-b border-[#F0EEEA] px-4 py-3">
          <h2 className="text-[15px] font-bold text-[#1A1A1A]">Foto-Grid-Debug</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[13px] font-semibold text-[#52b788]"
          >
            Fertig
          </button>
        </div>
        <p className="px-4 py-2 text-[11px] leading-relaxed text-[#6B7280]">
          Schalter gelten in dieser installierten App (In-Memory + Speicher dieser PWA). Nach Änderungen Fotodoku-Seite
          kurz verlassen und wieder öffnen.
        </p>
        <div className="px-3 pb-2">
          <ToggleRow
            label="Tile-Log (Konsole)"
            checked={tileLog}
            onChange={(on) => setPhotoDebug('hufpflege_photo_tile_log', on ? '1' : null)}
          />
          <ToggleRow
            label="Tile-Overlay (Kachel)"
            checked={tileOverlay}
            onChange={(on) => setPhotoDebug('hufpflege_photo_tile_overlay', on ? '1' : null)}
          />
          <ToggleRow
            label="Debug-Fotos (Signed-URLs …)"
            hint="Größere Logs; optional"
            checked={debugPhotos}
            onChange={(on) => setPhotoDebug('hufpflege_debug_photos', on ? '1' : null)}
          />
          <ToggleRow
            label="Stagger aus"
            checked={staggerOff}
            onChange={(on) => setPhotoDebug('hufpflege_photo_disable_stagger', on ? '1' : null)}
          />
          <ToggleRow
            label="Grid-Remount aus"
            checked={remountOff}
            onChange={(on) => setPhotoDebug('hufpflege_photo_disable_grid_remount', on ? '1' : null)}
          />
          <ToggleRow
            label="Intersection aus (Standalone)"
            checked={intersectionOff}
            onChange={(on) => setPhotoDebug('hufpflege_photo_disable_intersection', on ? '1' : null)}
          />
          <ToggleRow
            label="Decoding sync (Standalone)"
            hint="Aus = async"
            checked={decodingSyncOn}
            onChange={(on) => setPhotoDebug('hufpflege_photo_decoding_sync', on ? null : '0')}
          />
          <ToggleRow
            label="Layer-Promotion (translateZ)"
            hint="Aus = kein GPU-Layer auf Grid-Img"
            checked={layerPromoteOn}
            onChange={(on) => setPhotoDebug('hufpflege_photo_disable_layer_promote', on ? null : '1')}
          />
          <ToggleRow
            label="object-fit: contain"
            checked={objectFitContain}
            onChange={(on) => setPhotoDebug('hufpflege_photo_object_fit_contain', on ? '1' : null)}
          />
          <ToggleRow
            label="Background-Image-Test"
            checked={bgImageTest}
            onChange={(on) => setPhotoDebug('hufpflege_photo_use_bg_image', on ? '1' : null)}
          />
        </div>
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => {
              resetAllPhotoGridDebugKeys()
            }}
            className="w-full rounded-xl border border-[#FECACA] bg-[#FEF2F2] py-3 text-[13px] font-semibold text-[#B91C1C]"
          >
            Alle Debug-Flags zurücksetzen
          </button>
        </div>
      </div>
    </>
  )
}
