// Spiegel von lib/modules/therapyTemplates.ts — Abschnitte müssen übereinstimmen.

class TherapyFieldDef {
  const TherapyFieldDef({
    required this.id,
    required this.label,
    this.hint,
  });

  final String id;
  final String label;
  final String? hint;
}

class TherapySectionDef {
  const TherapySectionDef({
    required this.id,
    required this.title,
    required this.fields,
    this.optional = false,
    this.animalTypes,
  });

  final String id;
  final String title;
  final List<TherapyFieldDef> fields;
  final bool optional;
  final List<String>? animalTypes;
}

const _commonSession = TherapySectionDef(
  id: 'session',
  title: 'Sitzung',
  fields: [
    TherapyFieldDef(id: 'chief_complaint', label: 'Hauptanliegen / Anlass'),
    TherapyFieldDef(id: 'session_notes', label: 'Allgemeiner Befund'),
  ],
);

const _commonTreatment = TherapySectionDef(
  id: 'treatment',
  title: 'Behandlung',
  optional: true,
  fields: [
    TherapyFieldDef(id: 'interventions', label: 'Durchgeführte Behandlung'),
    TherapyFieldDef(
      id: 'recommendations',
      label: 'Empfehlungen / Übungen',
      hint: 'optional',
    ),
  ],
);

const _commonCourse = TherapySectionDef(
  id: 'course',
  title: 'Verlauf',
  optional: true,
  fields: [
    TherapyFieldDef(
      id: 'course_notes',
      label: 'Behandlungsverlauf / Vergleich',
    ),
  ],
);

const _physioExtra = <TherapySectionDef>[
  TherapySectionDef(
    id: 'gait',
    title: 'Gangbild und Bewegungsanalyse',
    fields: [
      TherapyFieldDef(id: 'gait_analysis', label: 'Gangbild'),
      TherapyFieldDef(
        id: 'movement_limits',
        label: 'Funktionelle Einschränkungen',
      ),
    ],
  ),
  TherapySectionDef(
    id: 'palpation',
    title: 'Muskulatur und Palpation',
    optional: true,
    fields: [
      TherapyFieldDef(id: 'muscle_findings', label: 'Muskulatur / Palpation'),
      TherapyFieldDef(id: 'joint_mobility', label: 'Gelenkbeweglichkeit'),
    ],
  ),
  TherapySectionDef(
    id: 'equine_saddle',
    title: 'Pferd: Ausrüstung / Belastung',
    optional: true,
    animalTypes: ['horse'],
    fields: [
      TherapyFieldDef(
        id: 'equipment_load',
        label: 'Sattel / Zaum / Belastung',
      ),
    ],
  ),
  TherapySectionDef(
    id: 'small_activity',
    title: 'Kleintier: Alltag / Aktivität',
    optional: true,
    animalTypes: ['dog', 'cat', 'small'],
    fields: [
      TherapyFieldDef(
        id: 'daily_activity',
        label: 'Alltagsaktivität / Spaziergänge',
      ),
    ],
  ),
];

const _osteoExtra = <TherapySectionDef>[
  TherapySectionDef(
    id: 'osteo_exam',
    title: 'Osteopathische Untersuchung',
    fields: [
      TherapyFieldDef(id: 'tissue_findings', label: 'Gewebebefunde'),
      TherapyFieldDef(id: 'mobility_findings', label: 'Beweglichkeit'),
      TherapyFieldDef(
        id: 'functional_limits',
        label: 'Funktionelle Einschränkungen',
      ),
    ],
  ),
];

const _heilExtra = <TherapySectionDef>[
  TherapySectionDef(
    id: 'symptoms',
    title: 'Symptome und Untersuchung',
    fields: [
      TherapyFieldDef(id: 'symptoms', label: 'Symptome'),
      TherapyFieldDef(id: 'exam_findings', label: 'Untersuchungsbefunde'),
    ],
  ),
  TherapySectionDef(
    id: 'plan',
    title: 'Behandlungsplan',
    optional: true,
    fields: [
      TherapyFieldDef(id: 'treatment_plan', label: 'Plan'),
      TherapyFieldDef(id: 'measures', label: 'Angewendete Maßnahmen'),
    ],
  ),
];

List<TherapySectionDef> therapySectionsForModule({
  required String moduleId,
  required String? animalType,
}) {
  final key = (animalType ?? 'horse').trim().toLowerCase();
  final List<TherapySectionDef> extra;
  switch (moduleId) {
    case 'physio':
      extra = _physioExtra;
    case 'osteo':
      extra = _osteoExtra;
    case 'heilpraktik':
      extra = _heilExtra;
    default:
      extra = const [];
  }

  final filtered = extra.where((s) {
    final allowed = s.animalTypes;
    if (allowed == null) return true;
    return allowed.contains(key);
  }).toList();

  return [_commonSession, ...filtered, _commonTreatment, _commonCourse];
}
