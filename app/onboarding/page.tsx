'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import AuthShell from '@/components/auth/AuthShell'

// ─── Types ────────────────────────────────────────────────────────────────────

type Profession =
  | 'hufbearbeiter'
  | 'tierheilpraktiker'
  | 'tierphysiotherapeut'
  | 'osteopath'
  | 'sonstiges'

type AnimalFocus =
  | 'nur_pferde'
  | 'pferde_und_kleintiere'
  | 'alle_tiere'
  | 'kleintiere'
  | 'sonstiges'

// ─── Step 1: Profession config ────────────────────────────────────────────────

const PROFESSIONS: { value: Profession; label: string; sub: string; emoji: string }[] = [
  {
    value: 'hufbearbeiter',
    label: 'Hufbearbeiter/in',
    sub: 'Barhufbearbeitung, Hufpflege, Hufschmied',
    emoji: '🦶',
  },
  {
    value: 'tierheilpraktiker',
    label: 'Tierheilpraktiker/in',
    sub: 'Naturheilkunde, Homöopathie, Akupunktur',
    emoji: '🌿',
  },
  {
    value: 'tierphysiotherapeut',
    label: 'Tierphysiotherapeut/in',
    sub: 'Physiotherapie, Rehabilitation, Bewegung',
    emoji: '🐾',
  },
  {
    value: 'osteopath',
    label: 'Osteopath/in',
    sub: 'Osteopathie, Chiropraktik, Craniosacral',
    emoji: '🔑',
  },
  {
    value: 'sonstiges',
    label: 'Sonstiges',
    sub: 'Anderes Berufsfeld oder Kombination',
    emoji: '✨',
  },
]

// ─── Step 2: Animal Focus config ──────────────────────────────────────────────

const ANIMALS: { value: AnimalFocus; label: string; sub: string; emoji: string }[] = [
  {
    value: 'nur_pferde',
    label: 'Nur Pferde',
    sub: 'Ausschließlich Equiden',
    emoji: '🐴',
  },
  {
    value: 'pferde_und_kleintiere',
    label: 'Pferde + Hunde/Katzen',
    sub: 'Kombination Groß- und Kleintiere',
    emoji: '🐎',
  },
  {
    value: 'alle_tiere',
    label: 'Alle Tiere',
    sub: 'Groß- und Kleintiere, breites Spektrum',
    emoji: '🐘',
  },
  {
    value: 'kleintiere',
    label: 'Kleintiere',
    sub: 'Hunde, Katzen, Kleinsäuger',
    emoji: '🐕',
  },
  {
    value: 'sonstiges',
    label: 'Sonstiges',
    sub: 'Andere Tierarten oder Kombination',
    emoji: '✨',
  },
]

// ─── Profile derivation ───────────────────────────────────────────────────────

function deriveProfile(profession: Profession, animalFocus: AnimalFocus) {
  const isHorse = animalFocus === 'nur_pferde' || animalFocus === 'pferde_und_kleintiere'
  const isHuf = profession === 'hufbearbeiter'

  const preferredTerminology = isHorse ? 'pferd' : 'tier'

  const enabledModules = ['documentation', 'photos', 'pdf_export']
  if (isHuf) enabledModules.push('hoof_records', 'hoof_analysis')
  if (isHorse) enabledModules.push('horse_management')
  if (['tierheilpraktiker', 'tierphysiotherapeut', 'osteopath'].includes(profession)) {
    enabledModules.push('therapy_notes')
  }

  return { preferredTerminology, enabledModules }
}

// ─── Main Component ───────────────────────────────────────────────────────────

// Internal steps: 1 = profession, 2 = animal focus, 3 = done
// Step indicator mapping: 1+2 → overall step 2 of 3, 3 → overall step 3 of 3
// (Register = overall step 1 of 3)

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [profession, setProfession] = useState<Profession | null>(null)
  const [animalFocus, setAnimalFocus] = useState<AnimalFocus | null>(null)
  const [saving, setSaving] = useState(false)
  const [trialEnd, setTrialEnd] = useState('')

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.settings?.onboarding_complete) {
        router.push('/dashboard')
      }
    }
    check()

    const d = new Date()
    d.setDate(d.getDate() + 14)
    setTrialEnd(d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }))
  }, [router])

  async function finishOnboarding() {
    if (!profession || !animalFocus) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { preferredTerminology, enabledModules } = deriveProfile(profession, animalFocus)

    await supabase.from('user_settings').upsert(
      {
        user_id: user.id,
        settings: {
          profession,
          animal_focus: animalFocus,
          preferred_terminology: preferredTerminology,
          enabled_modules: enabledModules,
          onboarding_complete: true,
          trial_started_at: new Date().toISOString(),
        },
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    setStep(3)
  }

  // Map internal step to shell indicator:
  // steps 1+2 = "onboarding questions" = overall step 2
  // step 3 = done = overall step 3
  const shellStep = step === 3 ? 3 : 2

  return (
    <AuthShell step={shellStep} totalSteps={3}>
      {step === 1 && (
        <StepProfession
          selected={profession}
          onSelect={setProfession}
          onNext={() => setStep(2)}
          onBack={() => router.push('/register')}
        />
      )}
      {step === 2 && (
        <StepAnimalFocus
          selected={animalFocus}
          onSelect={setAnimalFocus}
          onNext={finishOnboarding}
          onBack={() => setStep(1)}
          saving={saving}
        />
      )}
      {step === 3 && (
        <StepDone
          trialEnd={trialEnd}
          onStart={() => router.push('/dashboard')}
        />
      )}
    </AuthShell>
  )
}

// ─── Step 1: Profession ───────────────────────────────────────────────────────

function StepProfession({
  selected, onSelect, onNext, onBack,
}: {
  selected: Profession | null
  onSelect: (v: Profession) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <>
      <h2 style={titleStyle}>Wofür nutzt du AniDocs?</h2>
      <p style={subtitleStyle}>
        Damit wir AniDocs für deinen Arbeitsalltag anpassen können.
      </p>

      <div style={optionListStyle}>
        {PROFESSIONS.map(p => (
          <OptionRow
            key={p.value}
            selected={selected === p.value}
            onClick={() => onSelect(p.value)}
            emoji={p.emoji}
            label={p.label}
            sub={p.sub}
          />
        ))}
      </div>

      <PrimaryBtn disabled={!selected} onClick={onNext}>
        Weiter
      </PrimaryBtn>

      <BackLink onClick={onBack}>← Zurück</BackLink>
    </>
  )
}

// ─── Step 2: Animal Focus ─────────────────────────────────────────────────────

function StepAnimalFocus({
  selected, onSelect, onNext, onBack, saving,
}: {
  selected: AnimalFocus | null
  onSelect: (v: AnimalFocus) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  return (
    <>
      <h2 style={titleStyle}>Mit welchen Tieren arbeitest du?</h2>
      <p style={subtitleStyle}>
        Das hilft uns, die richtigen Module für dich zu aktivieren.
      </p>

      <div style={optionListStyle}>
        {ANIMALS.map(a => (
          <OptionRow
            key={a.value}
            selected={selected === a.value}
            onClick={() => onSelect(a.value)}
            emoji={a.emoji}
            label={a.label}
            sub={a.sub}
          />
        ))}
      </div>

      <PrimaryBtn disabled={!selected || saving} onClick={onNext}>
        {saving ? 'Speichern…' : 'Weiter'}
      </PrimaryBtn>

      <BackLink onClick={onBack}>← Zurück</BackLink>
    </>
  )
}

// ─── Step 3: Done ─────────────────────────────────────────────────────────────

function StepDone({ trialEnd, onStart }: { trialEnd: string; onStart: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      {/* Icon */}
      <div style={{
        width: 80, height: 80, borderRadius: 22, background: '#edf7f2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 38, marginBottom: 22,
      }}>
        🎉
      </div>

      <h2 style={{ ...titleStyle, fontSize: 26, marginBottom: 10 }}>Alles bereit!</h2>

      <p style={{ ...subtitleStyle, maxWidth: 320, margin: '0 auto 22px' }}>
        Dein Testzeitraum läuft — 14 Tage kostenlos, alle Funktionen freigeschaltet.
        Du kannst sofort loslegen.
      </p>

      {/* Trial badge */}
      {trialEnd && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '12px 18px',
          background: '#edf7f2', border: '1px solid #b7e4cc', borderRadius: 12,
          fontSize: 14, color: '#374151', marginBottom: 22,
        }}>
          <span style={{ fontSize: 16 }}>⏱</span>
          <span>14 Tage kostenlos · endet am <strong style={{ color: '#111' }}>{trialEnd}</strong></span>
        </div>
      )}

      {/* Feature list */}
      <ul style={{
        listStyle: 'none', padding: 0, margin: '0 0 26px',
        width: '100%', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {[
          { icon: '📋', text: 'Dokumentationen in unter 30 Sekunden' },
          { icon: '📸', text: 'Fotodokumentation mit Markierungen' },
          { icon: '📄', text: 'PDF-Berichte per Klick erstellen' },
          { icon: '📱', text: 'Funktioniert auch offline – direkt vor Ort' },
        ].map(({ icon, text }) => (
          <li key={text} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            fontSize: 14, color: '#374151', textAlign: 'left',
          }}>
            <span style={{
              width: 34, height: 34, borderRadius: 9, background: '#f7f7f7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, flexShrink: 0,
            }}>{icon}</span>
            {text}
          </li>
        ))}
      </ul>

      <PrimaryBtn onClick={onStart} green>Los geht's →</PrimaryBtn>
    </div>
  )
}

// ─── Shared Atoms ─────────────────────────────────────────────────────────────

function OptionRow({
  selected, onClick, emoji, label, sub,
}: {
  selected: boolean
  onClick: () => void
  emoji: string
  label: string
  sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '13px 14px', cursor: 'pointer',
        border: `1.5px solid ${selected ? '#52b788' : '#e5e2dc'}`,
        borderRadius: 14, background: selected ? '#edf7f2' : '#fff',
        textAlign: 'left', fontFamily: 'inherit',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Emoji icon */}
      <span style={{
        width: 38, height: 38, borderRadius: 10,
        background: '#f7f7f7', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {emoji}
      </span>

      {/* Text */}
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          {sub}
        </span>
      </span>

      {/* Radio */}
      <span style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: selected ? '2px solid #52b788' : '2px solid #d1d5db',
        background: '#fff',
      }}>
        {selected && (
          <span style={{
            width: 12, height: 12, borderRadius: '50%', background: '#52b788', display: 'block',
          }} />
        )}
      </span>
    </button>
  )
}

function PrimaryBtn({
  children, disabled, onClick, green,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  green?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%', padding: '14px 16px', border: 'none', borderRadius: 12,
        background: disabled ? '#c8c4bc' : green ? '#52b788' : '#111',
        color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function BackLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'center',
        padding: '13px 0', color: '#52b788', fontSize: 14, fontWeight: 500,
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', marginTop: 4,
      }}
    >
      {children}
    </button>
  )
}

// ─── Style constants ──────────────────────────────────────────────────────────

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
  fontSize: 22, fontWeight: 700, color: '#111',
  margin: '0 0 4px', letterSpacing: '-0.3px',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14, color: '#6b7280',
  margin: '0 0 20px', lineHeight: 1.55,
}

const optionListStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16,
}
