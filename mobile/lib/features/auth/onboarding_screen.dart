import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/app_profile_provider.dart';
import '../../core/supabase.dart';
import '../../theme/anidocs_colors.dart';
import '../settings/settings_repository.dart';
import 'auth_flow_shell.dart';
import 'onboarding_gate.dart';

/// Onboarding wie PWA `/onboarding`: Beruf → Tiere → Fertig.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  /// 1 = Profession, 2 = Animals, 3 = Done
  int _step = 1;
  final Set<String> _professions = {};
  String? _animalFocus;
  bool _saving = false;
  late final String _trialEnd;

  static const _professionOptions = <_Option>[
    _Option(
      value: 'hufbearbeiter',
      label: 'Hufbearbeiter/in',
      sub: 'Barhufbearbeitung, Hufpflege, Hufschmied',
      icon: '🦶',
    ),
    _Option(
      value: 'tierheilpraktiker',
      label: 'Tierheilpraktiker/in',
      sub: 'Naturheilkunde, Homöopathie, Akupunktur',
      icon: '🌿',
    ),
    _Option(
      value: 'tierphysiotherapeut',
      label: 'Tierphysiotherapeut/in',
      sub: 'Physiotherapie, Rehabilitation, Bewegung',
      icon: '🐾',
    ),
    _Option(
      value: 'osteopath',
      label: 'Osteopath/in',
      sub: 'Osteopathie, Chiropraktik, Craniosacral',
      icon: '🔑',
    ),
    _Option(
      value: 'sonstiges',
      label: 'Sonstiges',
      sub: 'Anderes Berufsfeld oder Kombination',
      icon: '✨',
    ),
  ];

  static const _animalOptions = <_Option>[
    _Option(
      value: 'nur_pferde',
      label: 'Nur Pferde',
      sub: 'Ausschließlich Equiden',
      icon: '🐴',
    ),
    _Option(
      value: 'pferde_und_kleintiere',
      label: 'Pferde und Kleintiere',
      sub: 'z. B. Pferde sowie Hunde, Katzen',
      icon: '🐎',
    ),
    _Option(
      value: 'kleintiere',
      label: 'Nur Kleintiere',
      sub: 'Hunde, Katzen, Kleinsäuger',
      icon: '🐕',
    ),
  ];

  @override
  void initState() {
    super.initState();
    final d = DateTime.now().add(const Duration(days: 14));
    _trialEnd = DateFormat('dd.MM.yyyy').format(d);
  }

  int get _shellStep => _step == 3 ? 3 : 2;

  ({String preferredTerminology, List<String> enabledModules}) _derive(
    List<String> professions,
    String animalFocus,
  ) {
    final isHorse =
        animalFocus == 'nur_pferde' || animalFocus == 'pferde_und_kleintiere';
    final isHuf = professions.contains('hufbearbeiter');
    final preferredTerminology = isHuf
        ? 'pferd'
        : isHorse
            ? 'pferd'
            : 'tier';
    final enabledModules = <String>['documentation', 'photos', 'pdf_export'];
    if (isHuf) {
      enabledModules.addAll(['hoof_records', 'hoof_analysis']);
    }
    if (isHorse) enabledModules.add('horse_management');
    if (professions.any(
      (p) =>
          p == 'tierheilpraktiker' ||
          p == 'tierphysiotherapeut' ||
          p == 'osteopath',
    )) {
      enabledModules.add('therapy_notes');
    }
    return (
      preferredTerminology: preferredTerminology,
      enabledModules: enabledModules,
    );
  }

  Future<void> _finish({
    List<String>? professionOverride,
    String? animalFocusOverride,
  }) async {
    final pList = professionOverride ?? _professions.toList();
    final a = animalFocusOverride ?? _animalFocus;
    if (pList.isEmpty || a == null) return;

    setState(() => _saving = true);
    try {
      final user = supabase.auth.currentUser;
      if (user == null) return;

      final derived = _derive(pList, a);
      final meta = user.userMetadata ?? {};
      final firstName = '${meta['first_name'] ?? ''}'.trim();
      final lastName = '${meta['last_name'] ?? ''}'.trim();

      await SettingsRepository().save({
        'profession': pList,
        'animal_focus': a,
        'preferred_terminology': derived.preferredTerminology,
        'enabled_modules': derived.enabledModules,
        'onboarding_complete': true,
        'trial_started_at': DateTime.now().toUtc().toIso8601String(),
        if (firstName.isNotEmpty) 'firstName': firstName,
        if (lastName.isNotEmpty) 'lastName': lastName,
      });

      // Serverseitige einmalige Modulfreischaltung (idempotent).
      try {
        await AniDocsApi.postJson('/api/onboarding/grant-modules', {
          'professions': pList,
        });
      } catch (_) {}

      // Fallback Trial-Konto (wie PWA) — Fehler nicht blockierend.
      try {
        await AniDocsApi.getJson('/api/billing/account');
      } catch (_) {}

      // Provider erst bei „Los geht's“ invalidieren, sonst verschwindet Schritt 3.
      ref.invalidate(appProfileProvider);
      ref.invalidate(settingsProvider);

      if (!mounted) return;
      setState(() {
        _step = 3;
        _saving = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Speichern fehlgeschlagen. Bitte erneut versuchen.'),
          ),
        );
      }
    }
  }

  void _onProfessionNext() {
    if (_professions.length == 1 && _professions.contains('hufbearbeiter')) {
      _finish(
        professionOverride: const ['hufbearbeiter'],
        animalFocusOverride: 'nur_pferde',
      );
    } else {
      setState(() => _step = 2);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthFlowShell(
      step: _shellStep,
      totalSteps: 3,
      showBack: _step != 3,
      child: switch (_step) {
        1 => _professionStep(),
        2 => _animalStep(),
        _ => _doneStep(),
      },
    );
  }

  Widget _professionStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Wofür nutzt du AniDocs?',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.3,
              ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Damit wir AniDocs für deinen Arbeitsalltag anpassen können.',
          style: TextStyle(
            fontSize: 14,
            color: AniDocsColors.secondary,
            height: 1.55,
          ),
        ),
        const SizedBox(height: 20),
        ..._professionOptions.map((o) {
          final selected = _professions.contains(o.value);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _OptionRow(
              option: o,
              selected: selected,
              onTap: () {
                setState(() {
                  if (selected) {
                    _professions.remove(o.value);
                  } else {
                    _professions.add(o.value);
                  }
                });
              },
            ),
          );
        }),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _professions.isEmpty || _saving ? null : _onProfessionNext,
          style: _primaryStyle(disabled: _professions.isEmpty || _saving),
          child: Text(_saving ? 'Speichern…' : 'Weiter'),
        ),
      ],
    );
  }

  Widget _animalStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Mit welchen Tieren arbeitest du?',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.3,
              ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Das hilft uns, die richtigen Module für dich zu aktivieren.',
          style: TextStyle(
            fontSize: 14,
            color: AniDocsColors.secondary,
            height: 1.55,
          ),
        ),
        const SizedBox(height: 20),
        ..._animalOptions.map((o) {
          final selected = _animalFocus == o.value;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _OptionRow(
              option: o,
              selected: selected,
              onTap: () => setState(() => _animalFocus = o.value),
            ),
          );
        }),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _animalFocus == null || _saving
              ? null
              : () => _finish(),
          style: _primaryStyle(disabled: _animalFocus == null || _saving),
          child: Text(_saving ? 'Speichern…' : 'Weiter'),
        ),
        TextButton(
          onPressed: _saving ? null : () => setState(() => _step = 1),
          child: const Text(
            '← Zurück',
            style: TextStyle(
              color: AniDocsColors.accent,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  Widget _doneStep() {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFFEDF7F2),
            borderRadius: BorderRadius.circular(22),
          ),
          child: const Text('🎉', style: TextStyle(fontSize: 38)),
        ),
        const SizedBox(height: 22),
        Text(
          'Alles bereit!',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 10),
        const Text(
          'Dein Testzeitraum läuft — 14 Tage kostenlos, alle Funktionen freigeschaltet. Du kannst sofort loslegen.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: AniDocsColors.secondary,
            height: 1.55,
          ),
        ),
        const SizedBox(height: 22),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFEDF7F2),
            border: Border.all(color: const Color(0xFFB7E4CC)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text.rich(
            TextSpan(
              style: const TextStyle(fontSize: 14, color: Color(0xFF374151)),
              children: [
                const TextSpan(text: '⏱  14 Tage kostenlos · endet am '),
                TextSpan(
                  text: _trialEnd,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AniDocsColors.foreground,
                  ),
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 22),
        ...const [
          ('📋', 'Dokumentationen in unter 30 Sekunden'),
          ('📸', 'Fotodokumentation mit Markierungen'),
          ('📄', 'PDF-Berichte per Klick erstellen'),
          ('📱', 'Funktioniert auch offline – direkt vor Ort'),
        ].map(
          (f) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F8F8),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Text(f.$1, style: const TextStyle(fontSize: 17)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    f.$2,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF374151),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        FilledButton(
          onPressed: () {
            ref.invalidate(onboardingCompleteProvider);
          },
          style: FilledButton.styleFrom(
            backgroundColor: AniDocsColors.accent,
            padding: const EdgeInsets.symmetric(vertical: 14),
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: const Text("Los geht's →"),
        ),
      ],
    );
  }

  ButtonStyle _primaryStyle({required bool disabled}) {
    return FilledButton.styleFrom(
      backgroundColor: disabled ? const Color(0xFFC8C4BC) : AniDocsColors.foreground,
      disabledBackgroundColor: const Color(0xFFC8C4BC),
      padding: const EdgeInsets.symmetric(vertical: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }
}

class _Option {
  const _Option({
    required this.value,
    required this.label,
    required this.sub,
    required this.icon,
  });

  final String value;
  final String label;
  final String sub;
  final String icon;
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final _Option option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AniDocsColors.accentLight : Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? AniDocsColors.accent : const Color(0xFFE5E2DC),
              width: 1.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F8F8),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(option.icon, style: const TextStyle(fontSize: 20)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      option.label,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AniDocsColors.foreground,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      option.sub,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AniDocsColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? AniDocsColors.accent
                        : const Color(0xFFD1D5DB),
                    width: 2,
                  ),
                ),
                child: selected
                    ? Center(
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: const BoxDecoration(
                            color: AniDocsColors.accent,
                            shape: BoxShape.circle,
                          ),
                        ),
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
