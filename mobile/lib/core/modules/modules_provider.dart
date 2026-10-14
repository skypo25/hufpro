import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api_client.dart';
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

final documentationModulesProvider =
    FutureProvider.autoDispose<DocumentationModulesState>((ref) async {
  try {
    final json = await AniDocsApi.getJson('/api/me/documentation-modules');
    final enabled = (json['enabled'] as List?)
            ?.whereType<String>()
            .where(isDocumentationModuleId)
            .toList() ??
        const <String>[];
    final animalTypes = (json['animalTypes'] as List?)?.whereType<String>().toList() ??
        animalTypesForModules(enabled);
    return DocumentationModulesState(
      enabled: enabled,
      animalTypes: animalTypes,
      hasEntitlementRows: json['hasEntitlementRows'] == true,
    );
  } catch (_) {
    return const DocumentationModulesState(
      enabled: [],
      animalTypes: [],
      hasEntitlementRows: false,
    );
  }
});
