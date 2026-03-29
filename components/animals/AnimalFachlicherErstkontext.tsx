'use client'

import type {
  ClinicalAnamnesis,
  ClinicalAnamnesisMore,
  ClinicalFirstContext,
  ClinicalHistory,
  ClinicalLocomotion,
  ClinicalLocomotionMore,
} from '@/lib/animals/clinicalIntakeTypes'

const inputClass = 'huf-input'
const textareaClass = 'huf-input huf-input--multiline leading-6'

function L({
  children,
  hint,
}: {
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex flex-col">
      <label className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
        {children}
      </label>
      {hint && <div className="mb-1 text-[11px] text-[#9CA3AF]">{hint}</div>}
    </div>
  )
}

function MoreDetails({ children }: { children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-[#E5E2DC] bg-[#fafaf9] px-4 py-3">
      <summary className="cursor-pointer select-none text-[13px] font-semibold text-[#1B1F23]">
        Weitere Angaben
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  )
}

type BlockProps = {
  value: ClinicalFirstContext
  onChange: (next: ClinicalFirstContext) => void
}

export function ClinicalBlockAnamnesis({ value, onChange }: BlockProps) {
  const set = onChange
  const a = value.anamnesis

  function patchA(partial: Partial<ClinicalAnamnesis>) {
    const { more: m, ...rest } = partial
    set({
      ...value,
      anamnesis: {
        ...a,
        ...rest,
        more: m ? { ...a.more, ...m } : a.more,
      },
    })
  }
  const patchAMore = (partial: Partial<ClinicalAnamnesisMore>) =>
    set({ ...value, anamnesis: { ...a, more: { ...a.more, ...partial } } })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <L>Hauptbeschwerde</L>
          <textarea
            className={textareaClass}
            rows={3}
            value={a.mainComplaint}
            onChange={(e) => patchA({ mainComplaint: e.target.value })}
            placeholder="z. B. Lahmheit hinten links, Rückensteife…"
          />
        </div>
        <div>
          <L>Seit wann bestehen die Beschwerden?</L>
          <input
            className={inputClass}
            value={a.complaintsSince}
            onChange={(e) => patchA({ complaintsSince: e.target.value })}
            placeholder="z. B. seit ca. 3 Wochen, seit Sturz im Herbst…"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <L>Akut oder chronisch?</L>
          <select
            className="huf-input"
            value={a.acuteOrChronic}
            onChange={(e) => patchA({ acuteOrChronic: e.target.value })}
          >
            <option value="">Bitte wählen…</option>
            <option value="akut">Akut</option>
            <option value="chronisch">Chronisch</option>
            <option value="unbekannt">Unbekannt</option>
          </select>
        </div>
        <div>
          <L>Aktuelle Medikamente</L>
          <input
            className={inputClass}
            value={a.currentMeds}
            onChange={(e) => patchA({ currentMeds: e.target.value })}
            placeholder="z. B. Schmerzmittel, Dauermedikation…"
          />
        </div>
      </div>
      <div>
        <L>Bekannte Vorerkrankungen</L>
        <textarea
          className={textareaClass}
          rows={3}
          value={a.knownConditions}
          onChange={(e) => patchA({ knownConditions: e.target.value })}
          placeholder="z. B. bekannte Arthrose, frühere OPs…"
        />
      </div>
      <MoreDetails>
        <div>
          <L>Fütterung / Besonderheiten bei der Fütterung</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={a.more.feedingNotes}
            onChange={(e) => patchAMore({ feedingNotes: e.target.value })}
          />
        </div>
        <div>
          <L>Verdauung auffällig?</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={a.more.digestionNotable}
            onChange={(e) => patchAMore({ digestionNotable: e.target.value })}
          />
        </div>
        <div>
          <L>Allergien / Unverträglichkeiten bekannt?</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={a.more.allergiesDetail}
            onChange={(e) => patchAMore({ allergiesDetail: e.target.value })}
          />
        </div>
        <div>
          <L>Verhalten / Stress auffällig?</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={a.more.behaviorStress}
            onChange={(e) => patchAMore({ behaviorStress: e.target.value })}
          />
        </div>
        <div>
          <L>Tierärztliche Befunde vorhanden?</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={a.more.vetFindings}
            onChange={(e) => patchAMore({ vetFindings: e.target.value })}
            placeholder="Kurzbeschreibung oder Verweis…"
          />
        </div>
        <div>
          <L>Impfstatus / letzte Impfung</L>
          <input
            className={inputClass}
            value={a.more.vaccination}
            onChange={(e) => patchAMore({ vaccination: e.target.value })}
            placeholder="z. B. Tollwut bis 2026"
          />
        </div>
        <div>
          <L>Sonstige Beobachtungen des Besitzers</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={a.more.ownerObservations}
            onChange={(e) => patchAMore({ ownerObservations: e.target.value })}
          />
        </div>
        <div>
          <L hint="Wird mit älteren Datensätzen mitgeführt">Verträglichkeit mit anderen Tieren</L>
          <input
            className={inputClass}
            value={a.more.compatibility}
            onChange={(e) => patchAMore({ compatibility: e.target.value })}
          />
        </div>
      </MoreDetails>
    </div>
  )
}

export function ClinicalBlockLocomotion({ value, onChange }: BlockProps) {
  const set = onChange
  const l = value.locomotion

  function patchL(partial: Partial<ClinicalLocomotion>) {
    const { more: m, ...rest } = partial
    set({
      ...value,
      locomotion: {
        ...l,
        ...rest,
        more: m ? { ...l.more, ...m } : l.more,
      },
    })
  }
  const patchLMore = (partial: Partial<ClinicalLocomotionMore>) =>
    set({ ...value, locomotion: { ...l, more: { ...l.more, ...partial } } })

  return (
    <div className="space-y-4">
      <div>
        <L>Betroffene Region</L>
        <input
          className={inputClass}
          value={l.affectedRegion}
          onChange={(e) => patchL({ affectedRegion: e.target.value })}
          placeholder="z. B. Hinterhand links, Rücken, Hals…"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <L>Bewegungseinschränkung vorhanden?</L>
          <select
            className="huf-input"
            value={l.movementLimitation}
            onChange={(e) => patchL({ movementLimitation: e.target.value })}
          >
            <option value="">Bitte wählen…</option>
            <option value="ja">Ja</option>
            <option value="nein">Nein</option>
            <option value="unbekannt">Unbekannt</option>
          </select>
        </div>
        <div>
          <L>Problem eher in Bewegung, im Stand oder beidem?</L>
          <select
            className="huf-input"
            value={l.problemContext}
            onChange={(e) => patchL({ problemContext: e.target.value })}
          >
            <option value="">Bitte wählen…</option>
            <option value="bewegung">Eher in der Bewegung</option>
            <option value="stand">Eher im Stand</option>
            <option value="beides">Beides</option>
            <option value="unbekannt">Unbekannt</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <L>Frühere Behandlungen</L>
          <select
            className="huf-input"
            value={l.priorTreatments}
            onChange={(e) => patchL({ priorTreatments: e.target.value })}
          >
            <option value="">Bitte wählen…</option>
            <option value="ja">Ja</option>
            <option value="nein">Nein</option>
            <option value="unbekannt">Unbekannt</option>
          </select>
        </div>
        <div>
          <L>Trainingszustand / Einsatzbereich</L>
          <input
            className={inputClass}
            value={l.trainingLevel}
            onChange={(e) => patchL({ trainingLevel: e.target.value })}
            placeholder="z. B. Freizeit, Sport, Haltung…"
          />
        </div>
      </div>
      <MoreDetails>
        <div>
          <L>Lahmheit oder Taktfehler vorhanden?</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={l.more.lameness}
            onChange={(e) => patchLMore({ lameness: e.target.value })}
          />
        </div>
        <div>
          <L>Aktuelle Einschränkungen im Training</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={l.more.trainingLimits}
            onChange={(e) => patchLMore({ trainingLimits: e.target.value })}
          />
        </div>
        <div>
          <L>Auffälligkeiten bei Lastaufnahme / Biegung / Bewegung</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={l.more.loadBendingObs}
            onChange={(e) => patchLMore({ loadBendingObs: e.target.value })}
          />
        </div>
        <div>
          <L>Tierärztliche Diagnose vorhanden?</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={l.more.vetDiagnosisMovement}
            onChange={(e) => patchLMore({ vetDiagnosisMovement: e.target.value })}
          />
        </div>
        <div>
          <L>Sonstige Beobachtungen Bewegung / Funktion</L>
          <textarea
            className={textareaClass}
            rows={2}
            value={l.more.otherMovementObs}
            onChange={(e) => patchLMore({ otherMovementObs: e.target.value })}
          />
        </div>
      </MoreDetails>
    </div>
  )
}

export function ClinicalBlockHistory({ value, onChange }: BlockProps) {
  const h = value.history
  const patchH = (partial: Partial<ClinicalHistory>) =>
    onChange({ ...value, history: { ...h, ...partial } })

  return (
    <div className="space-y-4">
      <div>
        <L>Frühere Verletzungen / Unfälle</L>
        <textarea
          className={textareaClass}
          rows={2}
          value={h.priorInjuries}
          onChange={(e) => patchH({ priorInjuries: e.target.value })}
        />
      </div>
      <div>
        <L>Operationen / Narben</L>
        <textarea
          className={textareaClass}
          rows={2}
          value={h.operationsScars}
          onChange={(e) => patchH({ operationsScars: e.target.value })}
        />
      </div>
      <div>
        <L>Wiederkehrende Probleme</L>
        <textarea
          className={textareaClass}
          rows={2}
          value={h.recurringIssues}
          onChange={(e) => patchH({ recurringIssues: e.target.value })}
        />
      </div>
      <div>
        <L>Auffälligkeiten durch Equipment / Sattel / Belastung</L>
        <textarea
          className={textareaClass}
          rows={2}
          value={h.equipmentIssues}
          onChange={(e) => patchH({ equipmentIssues: e.target.value })}
        />
      </div>
      <div>
        <L>Sonstige relevante Vorgeschichte</L>
        <textarea
          className={textareaClass}
          rows={2}
          value={h.otherHistory}
          onChange={(e) => patchH({ otherHistory: e.target.value })}
        />
      </div>
    </div>
  )
}
