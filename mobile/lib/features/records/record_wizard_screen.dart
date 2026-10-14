import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tabler_icons_plus/tabler_icons_plus.dart';

import '../../core/modules/catalog.dart';
import '../../core/modules/modules_provider.dart';
import '../../core/supabase.dart';
import '../../theme/anidocs_colors.dart';
import '../../theme/anidocs_text.dart';
import 'record_create_screen.dart';

/// Modulwahl (0 / 1 / ≥2) + Huf-/Therapie-Maske — analog PWA `MobileRecordEntry`.
class RecordWizardScreen extends ConsumerStatefulWidget {
  const RecordWizardScreen({
    super.key,
    required this.horseId,
    this.horseName,
    this.appointmentId,
    this.preferredModule,
  });

  final String horseId;
  final String? horseName;
  final String? appointmentId;
  final String? preferredModule;

  @override
  ConsumerState<RecordWizardScreen> createState() => _RecordWizardScreenState();
}

class _RecordWizardScreenState extends ConsumerState<RecordWizardScreen> {
  String? _animalType;
  String? _selectedModule;
  Object? _horseError;
  bool _horseLoading = true;

  @override
  void initState() {
    super.initState();
    _loadHorse();
  }

  Future<void> _loadHorse() async {
    setState(() {
      _horseLoading = true;
      _horseError = null;
    });
    try {
      final row = await supabase
          .from('horses')
          .select('id, name, animal_type')
          .eq('id', widget.horseId)
          .maybeSingle();
      if (!mounted) return;
      if (row == null) {
        setState(() {
          _horseLoading = false;
          _horseError = 'Tier nicht gefunden.';
        });
        return;
      }
      setState(() {
        _animalType = row['animal_type'] as String?;
        _horseLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _horseLoading = false;
        _horseError = e;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_horseLoading) {
      return const Scaffold(
        backgroundColor: AniDocsColors.background,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_horseError != null) {
      return Scaffold(
        backgroundColor: AniDocsColors.background,
        appBar: AppBar(title: const Text('Dokumentation')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              '$_horseError',
              textAlign: TextAlign.center,
              style: AniDocsText.fieldControl(color: Colors.red.shade700),
            ),
          ),
        ),
      );
    }

    final modsAsync = ref.watch(documentationModulesProvider);

    return modsAsync.when(
      loading: () => const Scaffold(
        backgroundColor: AniDocsColors.background,
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        backgroundColor: AniDocsColors.background,
        appBar: AppBar(title: const Text('Dokumentation')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Module konnten nicht geladen werden.',
                  textAlign: TextAlign.center,
                  style: AniDocsText.sectionTitle(),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(documentationModulesProvider),
                  child: const Text('Erneut laden'),
                ),
              ],
            ),
          ),
        ),
      ),
      data: (mods) {
        final resolved = resolveModulesForAnimal(
          enabledModules: mods.enabled,
          animalType: _animalType,
          preferredModule: widget.preferredModule,
        );

        if (resolved.status == 'none') {
          return Scaffold(
            backgroundColor: AniDocsColors.background,
            appBar: AppBar(title: const Text('Dokumentation')),
            body: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Keine passende Dokumentation',
                    style: AniDocsText.pageTitle(),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Für diese Tierart ist kein freigeschaltetes Modul verfügbar.',
                    style: AniDocsText.fieldControl(
                      color: AniDocsColors.secondary,
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        // preferredModule nur UI-Hinweis — nie Picker überspringen (≥2 Module).
        final selected = _selectedModule ??
            (resolved.status == 'single' ? resolved.moduleId : null);

        if (selected == null) {
          return _ModulePickerScaffold(
            horseName: widget.horseName,
            candidates: resolved.candidates,
            preferredModule: widget.preferredModule,
            onPick: (id) => setState(() => _selectedModule = id),
          );
        }

        return RecordCreateScreen(
          horseId: widget.horseId,
          horseName: widget.horseName,
          appointmentId: widget.appointmentId,
          moduleId: selected,
        );
      },
    );
  }
}

class _ModulePickerScaffold extends StatelessWidget {
  const _ModulePickerScaffold({
    required this.candidates,
    required this.onPick,
    this.horseName,
    this.preferredModule,
  });

  final String? horseName;
  final List<String> candidates;
  final String? preferredModule;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final name = horseName?.trim();
    return Scaffold(
      backgroundColor: AniDocsColors.background,
      appBar: AppBar(
        title: Text(
          name != null && name.isNotEmpty
              ? 'Dokumentation · $name'
              : 'Dokumentation',
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        children: [
          Text('Behandlungsart wählen', style: AniDocsText.pageTitle()),
          const SizedBox(height: 8),
          Text(
            'Mehrere Module sind freigeschaltet. Bitte wähle die Fachrichtung für diese Dokumentation.',
            style: AniDocsText.fieldControl(color: AniDocsColors.secondary),
          ),
          const SizedBox(height: 20),
          for (final id in candidates) ...[
            _ModuleTile(
              moduleId: id,
              preferred: preferredModule == id,
              onTap: () => onPick(id),
            ),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  const _ModuleTile({
    required this.moduleId,
    required this.onTap,
    this.preferred = false,
  });

  final String moduleId;
  final bool preferred;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final def = moduleCatalog[moduleId];
    final label = def?.label ?? moduleId;
    return Material(
      color: preferred ? AniDocsColors.accentLight : AniDocsColors.surface,
      borderRadius: BorderRadius.circular(AniDocsColors.cardRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AniDocsColors.cardRadius),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AniDocsColors.cardRadius),
            border: Border.all(
              color: preferred ? AniDocsColors.accent : AniDocsColors.border,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: AniDocsText.sectionTitle(
                        color: preferred
                            ? AniDocsColors.accent
                            : AniDocsColors.foreground,
                      ),
                    ),
                    if (preferred) ...[
                      const SizedBox(height: 2),
                      Text(
                        'Termin-Vorschlag',
                        style: AniDocsText.fieldHelper(),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                TablerIcons.chevronRight,
                color: preferred ? AniDocsColors.accent : AniDocsColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
