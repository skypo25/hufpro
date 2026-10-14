import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api_client.dart';
import '../supabase.dart';
import 'catalog.dart';

class DocumentationModulesState {
  const DocumentationModulesState({
    required this.enabled,
    required this.animalTypes,
    required this.hasEntitlementRows,
  });

  final List<String> enabled;
  final List<String> animalTypes;
  final bool hasEntitlementRows;

  bool has(String moduleId) => enabled.contains(moduleId);
}

Future<List<String>> _enabledFromDb() async {
  final rows = await supabase
      .from('user_documentation_modules')
      .select('module_id, enabled');
  return [
    for (final raw in rows as List)
      if (raw is Map &&
          raw['enabled'] == true &&
          isDocumentationModuleId('${raw['module_id']}'))
        '${raw['module_id']}',
  ];
}

final documentationModulesProvider =
    FutureProvider.autoDispose<DocumentationModulesState>((ref) async {
  List<String> fromApi = const [];
  var hasRows = false;
  try {
    // Triggert Legacy-Migration (Service Role) und liefert enabled[].
    final json = await AniDocsApi.getJson('/api/me/documentation-modules');
    fromApi = (json['enabled'] as List?)
            ?.whereType<String>()
            .where(isDocumentationModuleId)
            .toList() ??
        const <String>[];
    hasRows = json['hasEntitlementRows'] == true;
  } catch (_) {
    // Fallback: direkte RLS-Lesung
  }

  List<String> fromDb = const [];
  try {
    fromDb = await _enabledFromDb();
    if (fromDb.isNotEmpty) hasRows = true;
  } catch (_) {}

  final enabled = fromDb.isNotEmpty ? fromDb : fromApi;
  return DocumentationModulesState(
    enabled: enabled,
    animalTypes: animalTypesForModules(enabled),
    hasEntitlementRows: hasRows || enabled.isNotEmpty,
  );
});
