import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tabler_icons_plus/tabler_icons_plus.dart';

import '../../core/ai/speech_service.dart';
import '../../core/app_profile.dart';
import '../../core/app_profile_provider.dart';
import '../../core/modules/catalog.dart';
import '../../core/modules/therapy_templates.dart';
import '../../core/offline/offline_errors.dart';
import '../../core/offline/online_check.dart';
import '../../core/supabase.dart';
import '../../theme/anidocs_colors.dart';
import '../../theme/anidocs_text.dart';
import '../../widgets/dark_page_header.dart';
import '../../widgets/voice_recorder_button.dart';
import '../../widgets/native_dictation_field.dart';
import '../animals/animal_detail_screen.dart';
import '../animals/animals_repository.dart';
import '../../widgets/annotation_overlay.dart';
import 'body_map_editor.dart';
import 'hoof_photo_wizard_screen.dart';
import 'photo_annotator_screen.dart';
import 'photo_process.dart';
import 'photo_slots.dart';
import 'record_detail_screen.dart';

/// Neue Dokumentation wie PWA `MobileRecordForm` / `RecordCreateForm`.
class RecordCreateScreen extends ConsumerStatefulWidget {
  const RecordCreateScreen({
    super.key,
    required this.horseId,
    this.horseName,
    this.appointmentId,
    this.moduleId,
  });

  final String horseId;
  final String? horseName;
  final String? appointmentId;
  /// Freigeschaltetes Dokumentationsmodul (`hoof` | `physio` | …).
  final String? moduleId;

  @override
  ConsumerState<RecordCreateScreen> createState() => _RecordCreateScreenState();
}

class _HoofState {
  static const unauffaelligText = 'Keine Auffälligkeiten festgestellt.';

  final findingCtrl = TextEditingController();
  final treatmentCtrl = TextEditingController();
  bool markedUnauffaellig = false;

  Map<String, dynamic> toJson(String position) => {
        'hoof_position': position,
        'finding_text':
            findingCtrl.text.trim().isEmpty ? null : findingCtrl.text.trim(),
        'treatment_text': treatmentCtrl.text.trim().isEmpty
            ? null
            : treatmentCtrl.text.trim(),
        'marked_unauffaellig': markedUnauffaellig,
        // Legacy-Chips leer lassen (neues Modell)
        'toe_alignment': null,
        'heel_balance': null,
        'frog_condition': null,
        'sole_condition': null,
      };

  bool get isEmpty =>
      !markedUnauffaellig &&
      findingCtrl.text.trim().isEmpty &&
      treatmentCtrl.text.trim().isEmpty;

  bool get hasBefund =>
      !markedUnauffaellig &&
      (findingCtrl.text.trim().isNotEmpty ||
          treatmentCtrl.text.trim().isNotEmpty);

  bool get isUnauffaellig => markedUnauffaellig;

  bool get hasOverwriteRisk {
    final f = findingCtrl.text.trim();
    if (treatmentCtrl.text.trim().isNotEmpty) return true;
    if (f.isNotEmpty && f != unauffaelligText) return true;
    return false;
  }

  void markUnauffaellig() {
    markedUnauffaellig = true;
    findingCtrl.text = unauffaelligText;
  }

  void syncMarkedFromFinding() {
    markedUnauffaellig = findingCtrl.text.trim() == unauffaelligText;
  }

  void dispose() {
    findingCtrl.dispose();
    treatmentCtrl.dispose();
  }
}

class _RecordCreateScreenState extends ConsumerState<RecordCreateScreen> {
  DateTime _date = DateTime.now();
  String _recordType = 'Ersttermin';
  DateTime? _lastVisit;

  String? _generalCondition;
  String? _gait;
  String? _handling;
  String? _horn;

  final _hoofs = {
    'vl': _HoofState(),
    'vr': _HoofState(),
    'hl': _HoofState(),
    'hr': _HoofState(),
  };
  String? _openHoof;

  final _summary = TextEditingController();
  final _notes = TextEditingController();
  final _recommendations = TextEditingController(); // therapy / legacy
  final _generalTreatment = TextEditingController();
  final _therapyFields = <String, TextEditingController>{};
  final _therapySectionOpen = <String, bool>{};

  final _shots = <String, CapturedShot>{};
  final _annotationsBySlot = <String, Map<String, dynamic>>{};
  bool _photosOpen = true;
  bool _progressOpen = true;

  String? _horseMeta;
  String _animalType = 'horse';
  final _bodyMapMarkers = <BodyMapMarkerData>[];
  bool _bodyMapOpen = false;
  bool _loading = true;
  bool _saving = false;
  bool _improving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  TextEditingController _therapyCtrl(String id) {
    return _therapyFields.putIfAbsent(id, TextEditingController.new);
  }

  bool _isTherapySectionOpen(String id, {required bool defaultOpen}) {
    return _therapySectionOpen[id] ?? defaultOpen;
  }

  @override
  void dispose() {
    _summary.dispose();
    _notes.dispose();
    _recommendations.dispose();
    _generalTreatment.dispose();
    for (final c in _therapyFields.values) {
      c.dispose();
    }
    for (final h in _hoofs.values) {
      h.dispose();
    }
    super.dispose();
  }

  Future<void> _bootstrap() async {
    try {
      final bundle =
          await AnimalsRepository().loadDetailBundle(widget.horseId);
      final docs = bundle?.docs ?? const <Map<String, dynamic>>[];
      DateTime? last;
      if (docs.isNotEmpty) {
        last = DateTime.tryParse('${docs.first['record_date'] ?? docs.first['session_date'] ?? ''}');
        _recordType = 'Regeltermin';
      }
      final horse = bundle?.horse;
      final meta = [
        if (horse != null) ...[
          horse['breed'],
          horse['sex'],
          if (horse['birth_year'] is num)
            '${DateTime.now().year - (horse['birth_year'] as num).toInt()} J.',
          if (horse['customers'] is Map) (horse['customers'] as Map)['name'],
          horse['stable_name'] ?? horse['stable_city'],
        ],
      ]
          .whereType<String>()
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .join(' · ');
      final animalRaw = '${horse?['animal_type'] ?? ''}'.trim().toLowerCase();
      final animalType = switch (animalRaw) {
        'dog' || 'cat' || 'small' || 'other' => animalRaw,
        _ => 'horse',
      };
      if (!mounted) return;
      setState(() {
        _lastVisit = last;
        _horseMeta = meta.isEmpty ? null : meta;
        _animalType = animalType;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 365 * 3)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      locale: const Locale('de'),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _openPhotoWizard({String? initialSlot}) async {
    final name = (widget.horseName ?? '').trim().isEmpty
        ? 'Pferd'
        : widget.horseName!.trim();
    final result = await Navigator.of(context).push<Map<String, CapturedShot>>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => HoofPhotoWizardScreen(
          horseName: name,
          initialShots: Map<String, CapturedShot>.from(_shots),
          initialSlot: initialSlot,
        ),
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      _shots
        ..clear()
        ..addAll(result);
      _annotationsBySlot.removeWhere((k, _) => !_shots.containsKey(k));
    });
  }

  Future<void> _pickFromGallery(String slot) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
      maxWidth: 2400,
    );
    if (file == null) return;
    final raw = await file.readAsBytes();
    final bytes = processHoofImageBytes(Uint8List.fromList(raw));
    if (!mounted) return;
    setState(() {
      _shots[slot] = CapturedShot(slot: slot, bytes: bytes, ext: 'jpg');
      _annotationsBySlot.remove(slot);
    });
  }

  Future<void> _captureSlot(String slot) async {
    // Leerer Slot → Wizard direkt mit diesem Huf + Perspektive
    if (!_shots.containsKey(slot)) {
      await _openPhotoWizard(initialSlot: slot);
      return;
    }

    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(TablerIcons.camera),
              title: const Text('Neu aufnehmen'),
              subtitle: const Text('Öffnet den Foto-Assistenten'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(TablerIcons.photo),
              title: const Text('Aus Galerie'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
            ListTile(
              leading: const Icon(TablerIcons.pencil),
              title: const Text('Markierungen'),
              onTap: () => Navigator.pop(ctx, 'annotate'),
            ),
            ListTile(
              leading: const Icon(TablerIcons.trash, color: Colors.red),
              title: const Text('Foto entfernen'),
              onTap: () => Navigator.pop(ctx, 'remove'),
            ),
          ],
        ),
      ),
    );
    if (choice == null || !mounted) return;

    switch (choice) {
      case 'remove':
        setState(() {
          _shots.remove(slot);
          _annotationsBySlot.remove(slot);
        });
      case 'annotate':
        await _annotateSlot(slot);
      case 'gallery':
        await _pickFromGallery(slot);
      case 'camera':
        await _openPhotoWizard(initialSlot: slot);
    }
  }

  Future<void> _annotateSlot(String slot) async {
    final shot = _shots[slot];
    if (shot == null) return;
    final label = PhotoSlots.labelFor(slot) ?? slot;
    final result = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => PhotoAnnotatorScreen(
          imageBytes: shot.bytes,
          title: '$label – Markierungen',
          initialAnnotations: _annotationsBySlot[slot],
        ),
      ),
    );
    if (result == null || !mounted) return;
    setState(() => _annotationsBySlot[slot] = result);
  }

  Future<void> _improveSummary() async {
    final raw = _summary.text.trim();
    if (raw.isEmpty || _improving) return;
    setState(() => _improving = true);
    try {
      final profile = watchAppProfile(ref);
      final text = await SpeechService.formatDocumentation(
        rawText: raw,
        therapyType: therapyAiTypeForProfile(profile),
        animalName: widget.horseName,
      );
      if (!mounted) return;
      if (text.isNotEmpty) setState(() => _summary.text = text);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst(RegExp(r'^Bad state: '), ''),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _improving = false);
    }
  }

  String _hoofStatus(_HoofState h) {
    if (h.isUnauffaellig) return 'ok';
    if (h.hasBefund) return 'warn';
    return 'empty';
  }

  String _overallStatus() {
    final statuses = _hoofs.values.map(_hoofStatus).toList();
    if (statuses.every((s) => s == 'empty')) return 'empty';
    if (statuses.every((s) => s == 'ok')) return 'ok';
    if (statuses.any((s) => s == 'warn')) return 'warn';
    return 'warn';
  }

  bool get _allHoofsOk =>
      _hoofs.values.every((h) => _hoofStatus(h) == 'ok');

  Future<void> _optimizeField(
    TextEditingController ctrl, {
    required String title,
  }) async {
    final raw = ctrl.text.trim();
    if (raw.isEmpty) return;
    setState(() => _improving = true);
    try {
      final text = await SpeechService.improveText(
        text: raw,
        animalName: widget.horseName,
      );
      if (!mounted || text.trim().isEmpty) return;
      final apply = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(title),
          content: SingleChildScrollView(child: Text(text)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Verwerfen'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Übernehmen'),
            ),
          ],
        ),
      );
      if (apply == true && mounted) {
        setState(() => ctrl.text = text.trim());
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    } finally {
      if (mounted) setState(() => _improving = false);
    }
  }

  Future<void> _save({required bool therapy}) async {
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    if (!await deviceLooksOnline()) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error =
              'Dokumentationen brauchen Internet zum Speichern (Fotos & Sync).';
        });
      }
      return;
    }

    final sessionDate = DateTime(
      _date.year,
      _date.month,
      _date.day,
    ).toIso8601String().split('T').first;

    final therapySectionsMap = <String, String>{
      for (final e in _therapyFields.entries)
        if (e.value.text.trim().isNotEmpty) e.key: e.value.text.trim(),
    };
    String therapySummaryFallback() {
      for (final v in therapySectionsMap.values) {
        if (v.isNotEmpty) return v;
      }
      return _summary.text.trim();
    }

    final summary = therapy
        ? (therapySectionsMap['session_notes'] ??
                therapySectionsMap['chief_complaint'] ??
                therapySummaryFallback())
            .trim()
        : _summary.text.trim();
    final recommendations = therapy
        ? (therapySectionsMap['recommendations'] ??
                therapySectionsMap['interventions'] ??
                therapySectionsMap['treatment_plan'] ??
                _recommendations.text.trim())
            .trim()
        : _recommendations.text.trim();
    final hoofsJson = [for (final e in _hoofs.entries) e.value.toJson(e.key)];

    String wrapHtml(String text) {
      final t = text.trim();
      if (t.isEmpty) return '';
      return t.split(RegExp(r'\n{2,}')).map((p) => '<p>${p.trim()}</p>').join();
    }

    try {
      final fullHoof = <String, dynamic>{
        'user_id': userId,
        'horse_id': widget.horseId,
        'record_date': sessionDate,
        'record_type': _recordType,
        'hoof_condition': summary.isEmpty ? null : summary,
        'treatment': recommendations.isEmpty ? null : recommendations,
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'general_condition': _generalCondition,
        'gait': _gait,
        'handling_behavior': _handling,
        'horn_quality': _horn,
        if (!therapy) 'hoofs_json': hoofsJson,
        if (!therapy && _generalTreatment.text.trim().isNotEmpty)
          'checklist_json': {
            'general_treatment': _generalTreatment.text.trim(),
          },
        if (widget.appointmentId != null)
          'appointment_id': widget.appointmentId,
      };

      Map<String, dynamic> hoof;
      try {
        hoof = Map<String, dynamic>.from(
          await supabase
              .from('hoof_records')
              .insert(fullHoof)
              .select('id')
              .single(),
        );
      } catch (_) {
        hoof = Map<String, dynamic>.from(
          await supabase
              .from('hoof_records')
              .insert({
                'user_id': userId,
                'horse_id': widget.horseId,
                'record_date': sessionDate,
                'hoof_condition': summary.isEmpty ? null : summary,
                'treatment':
                    recommendations.isEmpty ? null : recommendations,
                'notes':
                    _notes.text.trim().isEmpty ? null : _notes.text.trim(),
              })
              .select('id')
              .single(),
        );
      }

      final hoofId = hoof['id'] as String;
      final year = _date.year;
      final suffix =
          hoofId.replaceAll('-', '').substring(hoofId.replaceAll('-', '').length - 4).toUpperCase();
      final docNumber = 'DOK-$year-$suffix';
      try {
        await supabase
            .from('hoof_records')
            .update({'doc_number': docNumber})
            .eq('id', hoofId)
            .eq('user_id', userId);
      } catch (_) {}

      final resolvedModuleId = isDocumentationModuleId(widget.moduleId)
          ? widget.moduleId!
          : (therapy ? 'heilpraktik' : 'hoof');
      final therapyDiscipline = switch (resolvedModuleId) {
        'physio' => 'physio',
        'osteo' => 'osteo',
        'heilpraktik' => 'heilpraktik',
        _ => null,
      };

      final docPayload = {
        'user_id': userId,
        'animal_id': widget.horseId,
        'session_date': sessionDate,
        'documentation_kind': therapy ? 'therapy' : 'hoof',
        if (therapyDiscipline != null) 'therapy_discipline': therapyDiscipline,
        'title': _recordType,
        'summary_html': wrapHtml(summary),
        'recommendations_html': wrapHtml(recommendations),
        'internal_notes':
            _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'doc_number': docNumber,
        'hoof_payload': {
          if (!therapy) 'hoofs_json': hoofsJson,
          'general_condition': _generalCondition,
          'gait': _gait,
          'handling_behavior': _handling,
          'horn_quality': _horn,
          if (!therapy && _generalTreatment.text.trim().isNotEmpty)
            'general_treatment': _generalTreatment.text.trim(),
          if (!therapy && _generalTreatment.text.trim().isNotEmpty)
            'checklist': {
              'general_treatment': _generalTreatment.text.trim(),
            },
        },
        if (therapy)
          'therapy_payload': {
            'schema_version': 1,
            'module_id': resolvedModuleId,
            'animal_type': _animalType,
            'sections': therapySectionsMap,
            'body_map': {
              'animal': const {'horse', 'dog', 'cat'}.contains(_animalType)
                  ? _animalType
                  : 'horse',
              'markers': [for (final m in _bodyMapMarkers) m.toJson()],
            },
          },
        'metadata': {
          'legacy_hoof_record_id': hoofId,
          'source': 'flutter_mobile',
          'documentation_module': resolvedModuleId,
          if (widget.appointmentId != null)
            'appointment_id': widget.appointmentId,
        },
      };

      Map<String, dynamic> doc;
      try {
        doc = Map<String, dynamic>.from(
          await supabase
              .from('documentation_records')
              .insert(docPayload)
              .select('id')
              .single(),
        );
      } catch (_) {
        final without = Map<String, dynamic>.from(docPayload)
          ..remove('doc_number');
        doc = Map<String, dynamic>.from(
          await supabase
              .from('documentation_records')
              .insert(without)
              .select('id')
              .single(),
        );
      }
      final docId = doc['id'] as String;

      var sort = 0;
      for (final shot in _shots.values) {
        final path =
            '$userId/${widget.horseId}/$docId/${shot.slot}_${DateTime.now().millisecondsSinceEpoch}.${shot.ext}';
        await supabase.storage.from('hoof-photos').uploadBinary(
              path,
              shot.bytes,
              fileOptions: FileOptions(
                contentType: 'image/${shot.ext}',
                upsert: false,
              ),
            );
        final ann = _annotationsBySlot[shot.slot];
        final hasAnn =
            ann != null && ((ann['items'] as List?)?.isNotEmpty ?? false);
        try {
          await supabase.from('documentation_photos').insert({
            'user_id': userId,
            'documentation_record_id': docId,
            'file_path': path,
            'photo_type': shot.slot,
            'sort_order': sort++,
            if (hasAnn) 'annotations_json': ann,
          });
        } catch (_) {
          await supabase.from('documentation_photos').insert({
            'user_id': userId,
            'documentation_record_id': docId,
            'file_path': path,
            'photo_type': shot.slot,
            if (hasAnn) 'annotations_json': ann,
          });
        }
        try {
          await supabase.from('hoof_photos').insert({
            'user_id': userId,
            'hoof_record_id': hoofId,
            'file_path': path,
            'photo_type': shot.slot,
            if (hasAnn) 'annotations_json': ann,
          });
        } catch (_) {}
      }

      if (!mounted) return;
      ref.invalidate(animalDetailProvider(widget.horseId));
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => RecordDetailScreen(
            horseId: widget.horseId,
            recordId: docId,
            isDocumentationRecord: true,
            horseName: widget.horseName,
          ),
        ),
      );
    } catch (e) {
      setState(() {
        _error = looksLikeOfflineError(e)
            ? 'Keine Verbindung. Bitte online speichern.'
            : 'Speichern fehlgeschlagen. Bitte erneut versuchen.';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = watchAppProfile(ref);
    final moduleId = isDocumentationModuleId(widget.moduleId)
        ? widget.moduleId!
        : null;
    final moduleDef = moduleId != null ? moduleCatalog[moduleId] : null;
    final therapy = moduleDef != null
        ? moduleDef.documentationKind == 'therapy'
        : profile.docType == DocType.therapy;
    final name = widget.horseName ?? profile.animalSingular;
    final dateFmt = DateFormat('dd.MM.yyyy', 'de');

    if (_loading) {
      return Scaffold(
        body: Column(
          children: [
            DarkPageHeader(title: name, showBack: true),
            const Expanded(child: Center(child: CircularProgressIndicator())),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AniDocsColors.background,
      body: Column(
        children: [
          DarkPageHeader(
            title: name,
            subtitle: _horseMeta,
            showBack: true,
            actions: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.circle, size: 8, color: Color(0xFF86EFAC)),
                    SizedBox(width: 6),
                    Text(
                      'Entwurf',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    icon: const Icon(TablerIcons.chevronLeft, size: 18),
                    label: const Text('Abbrechen'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _saving
                        ? null
                        : () => _save(therapy: therapy),
                    icon: _saving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.save_outlined, size: 18),
                    label: Text(_saving ? 'Speichern…' : 'Speichern'),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
              children: [
                _ctxStrip(dateFmt),
                const SizedBox(height: 12),
                if (!therapy) ...[
                  _progressCard(),
                  const SizedBox(height: 12),
                  _generalCard(),
                  const SizedBox(height: 12),
                  _hoofsCard(),
                  const SizedBox(height: 12),
                  _photosCard(),
                  const SizedBox(height: 12),
                ],
                if (therapy) ...[
                  _therapyModuleBadge(
                    moduleDef?.label ?? 'Therapie',
                  ),
                  const SizedBox(height: 12),
                  ..._therapySectionCards(
                    moduleId: moduleId ?? 'heilpraktik',
                  ),
                  if ((moduleDef?.supportsBodyMap ?? false) &&
                      (_animalType == 'horse' ||
                          _animalType == 'dog' ||
                          _animalType == 'cat')) ...[
                    _bodyMapCard(),
                    const SizedBox(height: 12),
                  ],
                ] else ...[
                  _measuresCard(therapy: false),
                  const SizedBox(height: 12),
                ],
                _notesCard(),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(color: Colors.red, fontSize: 13),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed:
                            _saving ? null : () => Navigator.pop(context),
                        child: const Text('Abbrechen'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: FilledButton.icon(
                        onPressed: _saving
                            ? null
                            : () => _save(therapy: therapy),
                        icon: const Icon(Icons.save_outlined),
                        label: Text(
                          _saving ? 'Wird gespeichert…' : 'Speichern',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _ctxStrip(DateFormat dateFmt) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: AniDocsColors.card(radius: AniDocsColors.cardRadiusSm),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: _pickDate,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Datum',
                    style: TextStyle(
                      fontSize: 11,
                      color: AniDocsColors.muted,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    dateFmt.format(_date),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Terminart',
                  style: TextStyle(fontSize: 11, color: AniDocsColors.muted),
                ),
                const SizedBox(height: 2),
                Text(
                  _recordType,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AniDocsColors.accentDark,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Letzter Termin',
                  style: TextStyle(fontSize: 11, color: AniDocsColors.muted),
                ),
                const SizedBox(height: 2),
                Text(
                  _lastVisit == null ? '–' : dateFmt.format(_lastVisit!),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _progressCard() {
    final gcDone = _generalCondition != null ||
        _gait != null ||
        _handling != null ||
        _horn != null;
    final hoofDone =
        _hoofs.values.every((h) => _hoofStatus(h) != 'empty');
    final photoDone = _shots.isNotEmpty;
    final summaryDone = _summary.text.trim().isNotEmpty;
    final steps = [
      ('Allgemeiner Eindruck', gcDone),
      ('Hufbefund pro Huf', hoofDone),
      ('Fotos aufnehmen', photoDone),
      ('Maßnahmen & Beobachtungen', summaryDone),
    ];
    final current = steps.indexWhere((s) => !s.$2);

    return Container(
      decoration: AniDocsColors.card(),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _progressOpen = !_progressOpen),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Row(
                children: [
                  Text('Fortschritt', style: AniDocsText.sectionTitle()),
                  const Spacer(),
                  Icon(
                    _progressOpen
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    size: 22,
                    color: AniDocsColors.muted,
                  ),
                ],
              ),
            ),
          ),
          if (_progressOpen)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                children: [
                  for (var i = 0; i < steps.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: steps[i].$2
                                  ? AniDocsColors.accent
                                  : i == current
                                      ? AniDocsColors.accentLight
                                      : AniDocsColors.border,
                            ),
                            child: steps[i].$2
                                ? const Icon(Icons.check,
                                    size: 14, color: Colors.white)
                                : Text(
                                    '${i + 1}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: i == current
                                          ? AniDocsColors.accentDark
                                          : AniDocsColors.secondary,
                                    ),
                                  ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            steps[i].$1,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: steps[i].$2
                                  ? AniDocsColors.secondary
                                  : AniDocsColors.foreground,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _generalCard() {
    return _sectionCard(
      icon: TablerIcons.eye,
      title: 'Allgemeiner Eindruck',
      hint: '~30 Sek.',
      child: Column(
        children: [
          _aeRow(
            'Allgemeinzustand',
            const ['Unauffällig', 'Auffällig'],
            _generalCondition,
            (v) => setState(() => _generalCondition = v),
          ),
          _aeRow(
            'Gangbild',
            const ['Taktrein', 'Leicht ungleichmäßig', 'Lahm'],
            _gait,
            (v) => setState(() => _gait = v),
          ),
          _aeRow(
            'Verhalten',
            const ['Kooperativ', 'Unruhig', 'Widersetzlich'],
            _handling,
            (v) => setState(() => _handling = v),
          ),
          _aeRow(
            'Hornqualität',
            const ['Stabil', 'Mittel', 'Brüchig', 'Weich'],
            _horn,
            (v) => setState(() => _horn = v),
            last: true,
          ),
        ],
      ),
    );
  }

  Widget _hoofsCard() {
    final overall = _overallStatus();
    final overallLabel = switch (overall) {
      'critical' => 'Problematisch',
      'warn' => 'Befund vorhanden',
      'empty' => 'Nicht erfasst',
      _ => 'Unauffällig',
    };
    final overallColor = switch (overall) {
      'critical' => const Color(0xFFFEE2E2),
      'warn' => const Color(0xFFFEF3C7),
      'empty' => const Color(0xFFF3F4F6),
      _ => const Color(0xFFDCFCE7),
    };
    final overallText = switch (overall) {
      'critical' => const Color(0xFF991B1B),
      'warn' => const Color(0xFF92400E),
      'empty' => const Color(0xFF9CA3AF),
      _ => const Color(0xFF166534),
    };
    final allOk = _allHoofsOk;

    return _sectionCard(
      icon: TablerIcons.search,
      title: 'Hufbefund pro Huf',
      hint: 'Freitext · Diktat',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Material(
            color: allOk ? const Color(0xFF2D7A3A) : const Color(0x0A2D7A3A),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(color: Color(0xFF2D7A3A), width: 2),
            ),
            child: InkWell(
              onTap: () async {
                final risk =
                    _hoofs.values.any((h) => h.hasOverwriteRisk);
                if (risk) {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Überschreiben?'),
                      content: const Text(
                        'Vorhandene individuelle Befunde überschreiben und alle Hufe als unauffällig markieren?',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Abbrechen'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Überschreiben'),
                        ),
                      ],
                    ),
                  );
                  if (ok != true) return;
                }
                setState(() {
                  for (final h in _hoofs.values) {
                    h.markUnauffaellig();
                  }
                });
              },
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      TablerIcons.check,
                      size: 18,
                      color: allOk ? Colors.white : const Color(0xFF2D7A3A),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Alle Hufe unauffällig',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: allOk ? Colors.white : const Color(0xFF2D7A3A),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: overallColor,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: overallText.withValues(alpha: 0.2),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.circle, size: 10, color: overallText),
                const SizedBox(width: 8),
                Text(
                  overallLabel,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: overallText,
                  ),
                ),
                if (overall != 'empty') ...[
                  const SizedBox(width: 6),
                  Text(
                    '· Automatisch erkannt',
                    style: TextStyle(fontSize: 12, color: overallText),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 8),
          for (final key in PhotoSlots.hoofKeys) _hoofAccordion(key),
          const SizedBox(height: 12),
          NativeDictationField(
            fieldId: 'general-treatment',
            controller: _generalTreatment,
            label: 'Allgemeine Behandlungsmaßnahmen',
            placeholder:
                'Maßnahmen, die mehrere oder alle Hufe betreffen ...',
            minLines: 2,
            onOptimize: () => _optimizeField(
              _generalTreatment,
              title: 'Allgemeine Maßnahmen – Vorschau',
            ),
          ),
        ],
      ),
    );
  }

  Widget _hoofAccordion(String key) {
    final h = _hoofs[key]!;
    final open = _openHoof == key;
    final st = _hoofStatus(h);
    final badge = switch (st) {
      'warn' => (
        'Befund vorhanden',
        const Color(0xFFFEF3C7),
        const Color(0xFF92400E),
      ),
      'empty' => (
        'Nicht erfasst',
        const Color(0xFFF3F4F6),
        const Color(0xFF9CA3AF),
      ),
      _ => (
        'Unauffällig',
        const Color(0xFFDCFCE7),
        const Color(0xFF166534),
      ),
    };
    final label = PhotoSlots.hoofNames[key]!;
    final short = PhotoSlots.hoofLabels[key]!;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        border: Border.all(color: AniDocsColors.border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () =>
                setState(() => _openHoof = open ? null : key),
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Icon(
                    Icons.circle,
                    size: 10,
                    color: badge.$3,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$short — $label',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: badge.$2,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      badge.$1,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: badge.$3,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(
                    open ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    size: 22,
                    color: AniDocsColors.muted,
                  ),
                ],
              ),
            ),
          ),
          if (open)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () async {
                        if (h.hasOverwriteRisk) {
                          final ok = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Überschreiben?'),
                              content: const Text(
                                'Vorhandenen Text überschreiben und Huf als unauffällig markieren?',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: const Text('Abbrechen'),
                                ),
                                FilledButton(
                                  onPressed: () => Navigator.pop(ctx, true),
                                  child: const Text('OK'),
                                ),
                              ],
                            ),
                          );
                          if (ok != true) return;
                        }
                        setState(h.markUnauffaellig);
                      },
                      child: const Text('Huf unauffällig'),
                    ),
                  ),
                  NativeDictationField(
                    fieldId: '$key-finding',
                    controller: h.findingCtrl,
                    label: 'Befund',
                    placeholder: 'Beschreibe den Zustand des Hufes ...',
                    minLines: 3,
                    onChanged: (_) => setState(h.syncMarkedFromFinding),
                    onOptimize: () => _optimizeField(
                      h.findingCtrl,
                      title: 'Befund – Vorschau',
                    ),
                  ),
                  const SizedBox(height: 12),
                  NativeDictationField(
                    fieldId: '$key-treatment',
                    controller: h.treatmentCtrl,
                    label: 'Durchgeführte Behandlung',
                    placeholder: 'Welche Maßnahmen wurden durchgeführt?',
                    minLines: 2,
                    onChanged: (_) => setState(() {}),
                    onOptimize: () => _optimizeField(
                      h.treatmentCtrl,
                      title: 'Behandlung – Vorschau',
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _photosCard() {
    final count = _shots.length;

    return _sectionCard(
      icon: TablerIcons.camera,
      title: 'Fotos aufnehmen',
      hint: count > 0 ? '$count Fotos' : null,
      onHeaderTap: () => setState(() => _photosOpen = !_photosOpen),
      trailing: Icon(
        _photosOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
        size: 22,
        color: AniDocsColors.muted,
      ),
      child: _photosOpen
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FilledButton.icon(
                  onPressed: _openPhotoWizard,
                  icon: const Icon(TablerIcons.camera, size: 18),
                  label: Text(
                    count == 0
                        ? 'Kamera mit Schablone öffnen'
                        : 'Fotos fortsetzen ($count)',
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Huf wählen · Perspektive · gestrichelte Oval-Schablone',
                  style: TextStyle(
                    fontSize: 12,
                    color: AniDocsColors.secondary,
                  ),
                ),
                if (_shots.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  const Text(
                    'Sohlenansicht (Solar)',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      color: AniDocsColors.secondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _photoGrid(PhotoSlots.solar),
                  const SizedBox(height: 14),
                  const Text(
                    'Seitenansicht (Lateral)',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      color: AniDocsColors.secondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _photoGrid(PhotoSlots.lateral),
                ],
              ],
            )
          : const SizedBox.shrink(),
    );
  }

  Widget _photoGrid(List<String> slots) {
    // 9:16 wie PWA `.photo-slot` (width/height)
    const aspect = 9 / 16;
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: aspect,
      children: [
        for (final slot in slots) _photoSlotTile(slot, aspect),
      ],
    );
  }

  Widget _photoSlotTile(String slot, double aspect) {
    final shot = _shots[slot];
    final ann = _annotationsBySlot[slot];
    final hasAnn = (ann?['items'] as List?)?.isNotEmpty == true;
    final label = PhotoSlots.labelFor(slot) ?? slot;

    return AspectRatio(
      aspectRatio: aspect,
      child: Material(
        color: AniDocsColors.surfaceMuted,
        borderRadius: BorderRadius.circular(8),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _captureSlot(slot),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AniDocsColors.border),
              image: shot != null
                  ? DecorationImage(
                      image: MemoryImage(shot.bytes),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: Stack(
              children: [
                if (shot != null && hasAnn)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: AnnotationOverlay(annotations: ann),
                    ),
                  ),
                if (shot == null)
                  Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          TablerIcons.camera,
                          color: AniDocsColors.muted,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          label,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AniDocsColors.secondary,
                          ),
                        ),
                        const Text(
                          'Antippen',
                          style: TextStyle(
                            fontSize: 10,
                            color: AniDocsColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                if (shot != null)
                  Positioned(
                    left: 6,
                    bottom: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                if (shot != null)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        color: AniDocsColors.accent,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check,
                        size: 12,
                        color: Colors.white,
                      ),
                    ),
                  ),
                if (shot != null)
                  Positioned(
                    right: 6,
                    bottom: 6,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _slotActionBtn(
                          icon: TablerIcons.camera,
                          onTap: () => _captureSlot(slot),
                        ),
                        const SizedBox(width: 4),
                        _slotActionBtn(
                          icon: TablerIcons.pencil,
                          active: hasAnn,
                          onTap: () => _annotateSlot(slot),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _slotActionBtn({
    required IconData icon,
    required VoidCallback onTap,
    bool active = false,
  }) {
    return Material(
      color: active ? AniDocsColors.accent : Colors.black54,
      borderRadius: BorderRadius.circular(6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: Icon(icon, size: 14, color: Colors.white),
        ),
      ),
    );
  }

  Widget _therapyModuleBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: AniDocsColors.card(),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AniDocsColors.accentLight,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              label,
              style: AniDocsText.fieldLabel(color: AniDocsColors.accentDark),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Therapie-Dokumentation',
              style: AniDocsText.fieldHelper(),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _therapySectionCards({required String moduleId}) {
    final sections = therapySectionsForModule(
      moduleId: moduleId,
      animalType: _animalType,
    );
    final out = <Widget>[];
    for (var i = 0; i < sections.length; i++) {
      final section = sections[i];
      final open = _isTherapySectionOpen(
        section.id,
        defaultOpen: i < 2,
      );
      out.add(
        _sectionCard(
          icon: TablerIcons.clipboardText,
          title: section.title,
          hint: section.optional ? 'optional' : null,
          onHeaderTap: () => setState(() {
            _therapySectionOpen[section.id] = !open;
          }),
          trailing: Icon(
            open ? TablerIcons.chevronDown : TablerIcons.chevronRight,
            size: 18,
            color: AniDocsColors.muted,
          ),
          child: open
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final field in section.fields) ...[
                      Text(field.label, style: AniDocsText.fieldLabel()),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _therapyCtrl(field.id),
                        minLines: 3,
                        maxLines: 8,
                        decoration: InputDecoration(
                          hintText: field.hint ?? 'Text eingeben…',
                          border: const OutlineInputBorder(),
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: VoiceRecorderButton(
                              animalName: widget.horseName,
                              buttonLabel: 'Einsprechen',
                              onResult: (text) {
                                final c = _therapyCtrl(field.id);
                                setState(() {
                                  if (c.text.trim().isEmpty) {
                                    c.text = text;
                                  } else {
                                    c.text = '${c.text.trim()}\n\n$text';
                                  }
                                });
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _improving
                                  ? null
                                  : () => _improveTherapyField(field.id),
                              icon: _improving
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(TablerIcons.sparkles, size: 18),
                              label: const Text('KI'),
                            ),
                          ),
                        ],
                      ),
                      if (field != section.fields.last)
                        const SizedBox(height: 16),
                    ],
                  ],
                )
              : const SizedBox.shrink(),
        ),
      );
      out.add(const SizedBox(height: 12));
    }
    return out;
  }

  Future<void> _improveTherapyField(String fieldId) async {
    final c = _therapyCtrl(fieldId);
    final raw = c.text.trim();
    if (raw.isEmpty || _improving) return;
    setState(() => _improving = true);
    try {
      final profile = watchAppProfile(ref);
      final text = await SpeechService.formatDocumentation(
        rawText: raw,
        therapyType: therapyAiTypeForProfile(profile),
        animalName: widget.horseName,
      );
      if (!mounted) return;
      if (text.isNotEmpty) setState(() => c.text = text);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst(RegExp(r'^Bad state: '), ''),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _improving = false);
    }
  }

  Widget _bodyMapCard() {
    final mapAnimal = (_animalType == 'dog' || _animalType == 'cat')
        ? _animalType
        : 'horse';
    return _sectionCard(
      icon: TablerIcons.mapPin,
      title: 'Körperkarte',
      hint: _bodyMapMarkers.isEmpty
          ? 'optional'
          : '${_bodyMapMarkers.length} Markierung(en)',
      onHeaderTap: () => setState(() => _bodyMapOpen = !_bodyMapOpen),
      trailing: Icon(
        _bodyMapOpen ? TablerIcons.chevronDown : TablerIcons.chevronRight,
        size: 18,
        color: AniDocsColors.muted,
      ),
      child: _bodyMapOpen
          ? BodyMapEditor(
              animalType: mapAnimal,
              markers: _bodyMapMarkers,
              onChanged: (next) {
                setState(() {
                  _bodyMapMarkers
                    ..clear()
                    ..addAll(next);
                });
              },
            )
          : TextButton(
              onPressed: () => setState(() => _bodyMapOpen = true),
              child: const Text('Körperkarte öffnen'),
            ),
    );
  }

  Widget _measuresCard({required bool therapy}) {
    return _sectionCard(
      icon: TablerIcons.fileText,
      title: therapy ? 'Hauptnotiz' : 'Maßnahmen & Beobachtungen',
      hint: 'Text, Diktat oder KI',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _summary,
            minLines: 4,
            maxLines: 10,
            decoration: const InputDecoration(
              hintText: 'Text eingeben oder per Diktierfunktion aufnehmen…',
              border: OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: VoiceRecorderButton(
                  animalName: widget.horseName,
                  buttonLabel: 'Sprachnotiz',
                  onResult: (text) {
                    setState(() {
                      if (_summary.text.trim().isEmpty) {
                        _summary.text = text;
                      } else {
                        _summary.text = '${_summary.text.trim()}\n\n$text';
                      }
                    });
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _improving ? null : _improveSummary,
                  icon: _improving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(TablerIcons.sparkles, size: 18),
                  label: Text(_improving ? '…' : 'Text verbessern'),
                ),
              ),
            ],
          ),
          if (therapy) ...[
            const SizedBox(height: 16),
            Text('Empfehlungen', style: AniDocsText.sectionTitle()),
            const SizedBox(height: 8),
            TextField(
              controller: _recommendations,
              minLines: 3,
              maxLines: 8,
              decoration: const InputDecoration(
                hintText: 'Empfehlungen (optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _notesCard() {
    return _sectionCard(
      icon: TablerIcons.lock,
      title: 'Interne Notiz',
      child: TextField(
        controller: _notes,
        minLines: 3,
        maxLines: 6,
        decoration: const InputDecoration(
          hintText: 'Interne Notizen (nur für dich sichtbar) …',
          border: OutlineInputBorder(),
        ),
      ),
    );
  }

  Widget _sectionCard({
    required IconData icon,
    required String title,
    String? hint,
    required Widget child,
    VoidCallback? onHeaderTap,
    Widget? trailing,
  }) {
    final header = Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AniDocsColors.accentLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: AniDocsColors.accentDark),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(title, style: AniDocsText.sectionTitle()),
          ),
          if (hint != null)
            Text(
              hint,
              style: const TextStyle(fontSize: 11, color: AniDocsColors.muted),
            ),
          if (trailing != null) ...[const SizedBox(width: 6), trailing],
        ],
      ),
    );

    return Container(
      decoration: AniDocsColors.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (onHeaderTap != null)
            InkWell(onTap: onHeaderTap, child: header)
          else
            header,
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: child,
          ),
        ],
      ),
    );
  }

  /// Zeile wie PWA `.mrf-ae-row` — feste Chip-Größe, kein Verspringen.
  Widget _aeRow(
    String label,
    List<String> options,
    String? value,
    ValueChanged<String?> onChanged, {
    bool last = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        border: last
            ? null
            : const Border(
                bottom: BorderSide(color: Color(0xFFF0EEEA)),
              ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AniDocsColors.secondary,
              ),
            ),
          ),
          Expanded(
            child: Wrap(
              spacing: 5,
              runSpacing: 5,
              alignment: WrapAlignment.end,
              children: [
                for (final o in options)
                  _AeChip(
                    label: o,
                    selected: value == o,
                    onTap: () => onChanged(value == o ? null : o),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

}

Color _aeChipColor(String label) {
  switch (label.toLowerCase()) {
    case 'unauffällig':
    case 'taktrein':
    case 'kooperativ':
    case 'stabil':
      return const Color(0xFF166534);
    case 'auffällig':
    case 'lahm':
    case 'widersetzlich':
      return const Color(0xFF991B1B);
    default:
      return const Color(0xFF92400E);
  }
}

Color _aeChipBg(String label) {
  switch (label.toLowerCase()) {
    case 'unauffällig':
    case 'taktrein':
    case 'kooperativ':
    case 'stabil':
      return const Color(0xFFDCFCE7);
    case 'auffällig':
    case 'lahm':
    case 'widersetzlich':
      return const Color(0xFFFEE2E2);
    default:
      return const Color(0xFFFEF3C7);
  }
}

Color _aeChipBorder(String label) {
  switch (label.toLowerCase()) {
    case 'unauffällig':
    case 'taktrein':
    case 'kooperativ':
    case 'stabil':
      return const Color(0xFF86EFAC);
    case 'auffällig':
    case 'lahm':
    case 'widersetzlich':
      return const Color(0xFFFECACA);
    default:
      return const Color(0xFFFDE68A);
  }
}

class _AeChip extends StatelessWidget {
  const _AeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? _aeChipBg(label) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(6),
        side: BorderSide(
          color: selected ? _aeChipBorder(label) : const Color(0xFFE5E2DC),
          width: 1.5,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? _aeChipColor(label) : AniDocsColors.secondary,
            ),
          ),
        ),
      ),
    );
  }
}

