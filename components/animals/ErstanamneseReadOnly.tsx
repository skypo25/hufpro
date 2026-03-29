import type { ClinicalFirstContext } from '@/lib/animals/clinicalIntakeTypes'

function Row({ label, value }: { label: string; value: string }) {
  const v = value.trim()
  if (!v) return null
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">{label}</div>
      <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1B1F23]">{v}</div>
    </div>
  )
}

function SelectishRow({ label, value }: { label: string; value: string }) {
  const v = value.trim()
  if (!v) return null
  const display =
    v === 'ja'
      ? 'Ja'
      : v === 'nein'
        ? 'Nein'
        : v === 'unbekannt'
          ? 'Unbekannt'
          : v === 'akut'
            ? 'Akut'
            : v === 'chronisch'
              ? 'Chronisch'
              : v === 'bewegung'
                ? 'Eher in der Bewegung'
                : v === 'stand'
                  ? 'Eher im Stand'
                  : v === 'beides'
                    ? 'Beides'
                    : v
  return Row({ label, value: display })
}

export function ErstanamneseReadOnly({ clinical }: { clinical: ClinicalFirstContext }) {
  const a = clinical.anamnesis
  const am = a.more
  const l = clinical.locomotion
  const lm = l.more
  const h = clinical.history

  return (
    <div className="space-y-8">
      <section className="huf-card">
        <div className="border-b border-[#E5E2DC] px-6 py-[18px]">
          <h2 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">Allgemeine Anamnese</h2>
        </div>
        <div className="space-y-4 p-6">
          <Row label="Hauptbeschwerde" value={a.mainComplaint} />
          <Row label="Seit wann bestehen die Beschwerden?" value={a.complaintsSince} />
          <SelectishRow label="Akut oder chronisch?" value={a.acuteOrChronic} />
          <Row label="Aktuelle Medikamente" value={a.currentMeds} />
          <Row label="Bekannte Vorerkrankungen" value={a.knownConditions} />
          <details className="rounded-lg border border-[#E5E2DC] bg-[#fafaf9] px-4 py-3">
            <summary className="cursor-pointer select-none text-[13px] font-semibold text-[#1B1F23]">
              Weitere Angaben
            </summary>
            <div className="mt-4 space-y-4">
              <Row label="Fütterung / Besonderheiten bei der Fütterung" value={am.feedingNotes} />
              <Row label="Verdauung auffällig?" value={am.digestionNotable} />
              <Row label="Allergien / Unverträglichkeiten bekannt?" value={am.allergiesDetail} />
              <Row label="Verhalten / Stress auffällig?" value={am.behaviorStress} />
              <Row label="Tierärztliche Befunde vorhanden?" value={am.vetFindings} />
              <Row label="Impfstatus / letzte Impfung" value={am.vaccination} />
              <Row label="Sonstige Beobachtungen des Besitzers" value={am.ownerObservations} />
              <Row label="Verträglichkeit mit anderen Tieren" value={am.compatibility} />
            </div>
          </details>
        </div>
      </section>

      <section className="huf-card">
        <div className="border-b border-[#E5E2DC] px-6 py-[18px]">
          <h2 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">
            Bewegungsapparat / Funktion
          </h2>
        </div>
        <div className="space-y-4 p-6">
          <Row label="Betroffene Region" value={l.affectedRegion} />
          <SelectishRow label="Bewegungseinschränkung vorhanden?" value={l.movementLimitation} />
          <SelectishRow
            label="Problem eher in Bewegung, im Stand oder beidem?"
            value={l.problemContext}
          />
          <SelectishRow label="Frühere Behandlungen" value={l.priorTreatments} />
          <Row label="Trainingszustand / Einsatzbereich" value={l.trainingLevel} />
          <details className="rounded-lg border border-[#E5E2DC] bg-[#fafaf9] px-4 py-3">
            <summary className="cursor-pointer select-none text-[13px] font-semibold text-[#1B1F23]">
              Weitere Angaben
            </summary>
            <div className="mt-4 space-y-4">
              <Row label="Lahmheit oder Taktfehler vorhanden?" value={lm.lameness} />
              <Row label="Aktuelle Einschränkungen im Training" value={lm.trainingLimits} />
              <Row label="Auffälligkeiten bei Lastaufnahme / Biegung / Bewegung" value={lm.loadBendingObs} />
              <Row label="Tierärztliche Diagnose vorhanden?" value={lm.vetDiagnosisMovement} />
              <Row label="Sonstige Beobachtungen Bewegung / Funktion" value={lm.otherMovementObs} />
            </div>
          </details>
        </div>
      </section>

      <section className="huf-card">
        <div className="border-b border-[#E5E2DC] px-6 py-[18px]">
          <h2 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">
            Vorgeschichte / strukturelle Auffälligkeiten
          </h2>
        </div>
        <div className="space-y-4 p-6">
          <Row label="Frühere Verletzungen / Unfälle" value={h.priorInjuries} />
          <Row label="Operationen / Narben" value={h.operationsScars} />
          <Row label="Wiederkehrende Probleme" value={h.recurringIssues} />
          <Row label="Auffälligkeiten durch Equipment / Sattel / Belastung" value={h.equipmentIssues} />
          <Row label="Sonstige relevante Vorgeschichte" value={h.otherHistory} />
        </div>
      </section>
    </div>
  )
}
