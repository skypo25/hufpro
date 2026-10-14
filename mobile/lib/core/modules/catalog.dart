// Spiegel von lib/modules/catalog.ts — fachliche Regeln müssen übereinstimmen.
// Server-Entitlements sind maßgeblich; dieses Modul dient der UI-Filterung.

library;

const documentationModuleIds = ['hoof', 'physio', 'osteo', 'heilpraktik'];

const professionToModule = <String, String>{
  'hufbearbeiter': 'hoof',
  'hufschmied': 'hoof',
  'barhufbearbeitung': 'hoof',
  'tierphysiotherapeut': 'physio',
  'tierphysiotherapie': 'physio',
  'osteopath': 'osteo',
  'tierosteopath': 'osteo',
  'tierosteopathie': 'osteo',
  'tierheilpraktiker': 'heilpraktik',
  'tierheilpraktik': 'heilpraktik',
  'sonstiges': 'heilpraktik',
};

const therapyAnimals = ['horse', 'dog', 'cat', 'small', 'other'];

class ModuleDefinition {
  const ModuleDefinition({
    required this.id,
    required this.label,
    required this.animalTypes,
    required this.supportsBodyMap,
    required this.documentationKind,
  });

  final String id;
  final String label;
  final List<String> animalTypes;
  final bool supportsBodyMap;
  final String documentationKind;
}

const moduleCatalog = <String, ModuleDefinition>{
  'hoof': ModuleDefinition(
    id: 'hoof',
    label: 'Hufbearbeitung',
    animalTypes: ['horse'],
    supportsBodyMap: false,
    documentationKind: 'hoof',
  ),
  'physio': ModuleDefinition(
    id: 'physio',
    label: 'Tierphysiotherapie',
    animalTypes: therapyAnimals,
    supportsBodyMap: true,
    documentationKind: 'therapy',
  ),
  'osteo': ModuleDefinition(
    id: 'osteo',
    label: 'Tierosteopathie',
    animalTypes: therapyAnimals,
    supportsBodyMap: true,
    documentationKind: 'therapy',
  ),
  'heilpraktik': ModuleDefinition(
    id: 'heilpraktik',
    label: 'Tierheilpraktik',
    animalTypes: therapyAnimals,
    supportsBodyMap: true,
    documentationKind: 'therapy',
  ),
};

List<String> modulesFromProfessions(dynamic professions) {
  final list = <String>[];
  if (professions is List) {
    for (final p in professions) {
      if (p is String) list.add(p);
    }
  } else if (professions is String) {
    list.add(professions);
  }
  final out = <String>[];
  for (final raw in list) {
    final mod = professionToModule[raw.trim().toLowerCase()];
    if (mod != null && !out.contains(mod)) out.add(mod);
  }
  return out;
}

String normalizeAppAnimalType(String? animalType) {
  final t = (animalType ?? '').trim().toLowerCase();
  if (t == 'dog' || t == 'cat' || t == 'small' || t == 'other') return t;
  return 'horse';
}

List<String> animalTypesForModules(Iterable<String> moduleIds) {
  final set = <String>{};
  for (final id in moduleIds) {
    final def = moduleCatalog[id];
    if (def == null) continue;
    set.addAll(def.animalTypes);
  }
  return set.toList();
}

List<String> modulesCompatibleWithAnimal(
  Iterable<String> enabledModules,
  String? animalType,
) {
  final key = normalizeAppAnimalType(animalType);
  return [
    for (final id in enabledModules)
      if (moduleCatalog[id]?.animalTypes.contains(key) == true) id,
  ];
}

/// 0 / 1 / ≥2 passende Module.
({String status, List<String> candidates, String? moduleId}) resolveModulesForAnimal({
  required Iterable<String> enabledModules,
  required String? animalType,
  String? preferredModule,
}) {
  final candidates = modulesCompatibleWithAnimal(enabledModules, animalType);
  if (candidates.isEmpty) {
    return (status: 'none', candidates: const [], moduleId: null);
  }
  if (candidates.length == 1) {
    return (status: 'single', candidates: candidates, moduleId: candidates.first);
  }
  if (preferredModule != null && candidates.contains(preferredModule)) {
    final rest = candidates.where((c) => c != preferredModule).toList();
    return (
      status: 'choice',
      candidates: [preferredModule, ...rest],
      moduleId: null,
    );
  }
  return (status: 'choice', candidates: candidates, moduleId: null);
}

bool isDocumentationModuleId(String? value) =>
    value != null && documentationModuleIds.contains(value);
