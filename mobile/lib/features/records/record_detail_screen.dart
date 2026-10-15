import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tabler_icons_plus/tabler_icons_plus.dart';

import '../../core/modules/therapy_templates.dart';
import '../../core/supabase.dart';
import '../../theme/anidocs_colors.dart';
import '../../theme/anidocs_text.dart';
import '../../widgets/async_body.dart';
import '../../widgets/dark_page_header.dart';
import '../../widgets/status_chip.dart';
import 'photo_annotator_screen.dart';

final recordDetailProvider = FutureProvider.autoDispose
    .family<
      Map<String, dynamic>?,
      ({String horseId, String recordId, bool isDoc})
    >((ref, args) async {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) return null;

      if (args.isDoc) {
        final row = await supabase
            .from('documentation_records')
            .select(
              'id, session_date, documentation_kind, therapy_discipline, title, summary_html, recommendations_html, internal_notes, doc_number, hoof_payload, therapy_payload, metadata',
            )
            .eq('user_id', userId)
            .eq('id', args.recordId)
            .maybeSingle();
        if (row == null) return null;
        return Map<String, dynamic>.from(row);
      }

      final row = await supabase
          .from('hoof_records')
          .select(
            'id, record_date, record_type, general_condition, gait, handling_behavior, horn_quality, hoof_condition, treatment, notes, doc_number, hoofs_json',
          )
          .eq('user_id', userId)
          .eq('id', args.recordId)
          .maybeSingle();
      if (row == null) return null;
      return Map<String, dynamic>.from(row);
    });

final recordPhotosProvider = FutureProvider.autoDispose
    .family<
      List<
        ({
          String id,
          String? type,
          String url,
          Map<String, dynamic>? annotations,
        })
      >,
      ({String recordId, bool isDoc})
    >((ref, args) async {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) return [];

      List<Map<String, dynamic>> photos;
      if (args.isDoc) {
        final rows = await supabase
            .from('documentation_photos')
            .select('id, file_path, photo_type, annotations_json')
            .eq('user_id', userId)
            .eq('documentation_record_id', args.recordId)
            .order('sort_order', ascending: true);
        photos = (rows as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } else {
        final rows = await supabase
            .from('hoof_photos')
            .select('id, file_path, photo_type, annotations_json')
            .eq('user_id', userId)
            .eq('hoof_record_id', args.recordId);
        photos = (rows as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }

      final paths = photos
          .map((p) => p['file_path'] as String?)
          .whereType<String>()
          .where((p) => p.isNotEmpty)
          .toList();
      if (paths.isEmpty) return [];

      final signed = await supabase.storage
          .from('hoof-photos')
          .createSignedUrlsResult(paths, 3600);
      final urlByPath = <String, String>{};
      for (final s in signed) {
        if (s case SignedUrlSuccess(:final path, :final signedUrl)) {
          if (signedUrl.isNotEmpty) urlByPath[path] = signedUrl;
        }
      }

      return [
        for (final p in photos)
          if (urlByPath[p['file_path'] as String?] != null)
            (
              id: p['id'] as String,
              type: p['photo_type'] as String?,
              url: urlByPath[p['file_path'] as String]!,
              annotations: p['annotations_json'] is Map
                  ? Map<String, dynamic>.from(p['annotations_json'] as Map)
                  : null,
            ),
      ];
    });

class RecordDetailScreen extends ConsumerWidget {
  const RecordDetailScreen({
    super.key,
    required this.horseId,
    required this.recordId,
    required this.isDocumentationRecord,
    this.horseName,
  });

  final String horseId;
  final String recordId;
  final bool isDocumentationRecord;
  final String? horseName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (
      horseId: horseId,
      recordId: recordId,
      isDoc: isDocumentationRecord,
    );
    final photoKey = (recordId: recordId, isDoc: isDocumentationRecord);
    final async = ref.watch(recordDetailProvider(key));
    final photosAsync = ref.watch(recordPhotosProvider(photoKey));
    final dateFmt = DateFormat("EEEE, d. MMMM · HH:mm", 'de');
    final dayFmt = DateFormat('dd.MM.yyyy', 'de');

    final headRow = async.asData?.value;
    String headTitle = 'Befund';
    String? headSubtitle = horseName;
    if (headRow != null) {
      final isTherapyHead = '${headRow['documentation_kind'] ?? ''}' == 'therapy';
      headTitle = isTherapyHead
          ? _therapyModuleLabel(headRow)
          : ((headRow['title'] as String?) ??
                (headRow['hoof_condition'] as String?) ??
                (headRow['documentation_kind'] as String?) ??
                (headRow['record_type'] as String?) ??
                'Dokumentation');
      final headDate = DateTime.tryParse(
        '${headRow['session_date'] ?? headRow['record_date']}',
      )?.toLocal();
      final now = DateTime.now();
      headSubtitle = [
        if (horseName != null && horseName!.trim().isNotEmpty) horseName!,
        if (headDate != null)
          (headDate.year == now.year &&
                  headDate.month == now.month &&
                  headDate.day == now.day)
              ? 'Heute, ${DateFormat('HH:mm', 'de').format(headDate)}'
              : dayFmt.format(headDate),
        if (headRow['doc_number'] != null) '${headRow['doc_number']}',
      ].join(' · ');
    }

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DarkPageHeader(
            title: headTitle,
            subtitle: headSubtitle,
            showBack: true,
            actions: [
              DarkHeaderButton(
                icon: TablerIcons.cameraPlus,
                tooltip: 'Foto hinzufügen',
                onPressed: () => _addPhoto(context, ref),
              ),
            ],
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: AsyncBody(
                value: async,
                onRetry: () => ref.invalidate(recordDetailProvider(key)),
                builder: (row) {
                  if (row == null) {
                    return const Center(child: Text('Nicht gefunden.'));
                  }
                  final dateRaw = row['session_date'] ?? row['record_date'];
                  final date = DateTime.tryParse('$dateRaw')?.toLocal();
                  final kind = '${row['documentation_kind'] ?? ''}';
                  final therapySections = _parseTherapySections(row);
                  final bodyMarkers = _parseBodyMapMarkers(row);
                  final isTherapy =
                      kind == 'therapy' ||
                      therapySections.isNotEmpty ||
                      bodyMarkers.isNotEmpty;
                  final summary = _stripHtml(
                    '${row['summary_html'] ?? row['hoof_condition'] ?? ''}',
                  );
                  final recommendations = _stripHtml(
                    '${row['recommendations_html'] ?? row['treatment'] ?? ''}',
                  );
                  final notes = '${row['notes'] ?? row['internal_notes'] ?? ''}'
                      .trim();
                  final hoofs = isTherapy ? const <_HoofView>[] : _parseHoofs(row);
                  final photos = photosAsync.asData?.value ?? const [];
                  final photosByHoof = _groupPhotosByHoof(photos);
                  final moduleLabel = _therapyModuleLabel(row);

                  return ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    children: [
                      if (isTherapy) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: AniDocsColors.card(),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                moduleLabel,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AniDocsColors.accent,
                                  letterSpacing: 0.4,
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Therapie-Dokumentation',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AniDocsColors.secondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        for (final section in therapySections) ...[
                          Text(section.title, style: AniDocsText.sectionTitle()),
                          const SizedBox(height: 10),
                          _CardColumn(
                            children: [
                              for (final field in section.fields)
                                _FindingBlock(
                                  label: field.label,
                                  body: field.value,
                                ),
                            ],
                          ),
                          const SizedBox(height: 20),
                        ],
                        if (bodyMarkers.isNotEmpty) ...[
                          Text('Körperkarte', style: AniDocsText.sectionTitle()),
                          const SizedBox(height: 10),
                          _CardColumn(
                            children: [
                              for (final group
                                  in _groupBodyMarkersByView(bodyMarkers))
                                _FindingBlock(
                                  label:
                                      '${group.label} · ${group.markers.length}',
                                  body: [
                                    for (var i = 0;
                                        i < group.markers.length;
                                        i++)
                                      '${i + 1}. ${group.markers[i].line}',
                                  ].join('\n'),
                                ),
                            ],
                          ),
                          const SizedBox(height: 20),
                        ],
                      ],
                      if (!isTherapy && hoofs.isNotEmpty) ...[
                        Text('Hufe', style: AniDocsText.sectionTitle()),
                        const SizedBox(height: 10),
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 2,
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                          childAspectRatio: 1.35,
                          children: [
                            for (final hoof in hoofs)
                              _HoofCard(
                                hoof: hoof,
                                photoCount:
                                    photosByHoof[hoof.position]?.length ?? 0,
                              ),
                          ],
                        ),
                        const SizedBox(height: 20),
                      ],
                      if (!isTherapy &&
                          (summary.isNotEmpty ||
                              row['general_condition'] != null ||
                              row['gait'] != null ||
                              row['handling_behavior'] != null ||
                              row['horn_quality'] != null)) ...[
                        Text('Befunde', style: AniDocsText.sectionTitle()),
                        const SizedBox(height: 10),
                        _CardColumn(
                          children: [
                            if (summary.isNotEmpty)
                              _FindingBlock(
                                label: 'Zusammenfassung',
                                body: summary,
                              ),
                            if (row['general_condition'] != null)
                              _FindingBlock(
                                label: 'Allgemein',
                                body: '${row['general_condition']}',
                              ),
                            if (row['gait'] != null)
                              _FindingBlock(
                                label: 'Gang',
                                body: '${row['gait']}',
                              ),
                            if (row['handling_behavior'] != null)
                              _FindingBlock(
                                label: 'Handling',
                                body: '${row['handling_behavior']}',
                              ),
                            if (row['horn_quality'] != null)
                              _FindingBlock(
                                label: 'Hornqualität',
                                body: '${row['horn_quality']}',
                              ),
                            for (final hoof in hoofs)
                              if (hoof.detailLine.isNotEmpty)
                                _FindingBlock(
                                  label: hoof.labelShort,
                                  body: hoof.detailLine,
                                  chip: hoof.statusLabel,
                                  tone: hoof.tone,
                                ),
                          ],
                        ),
                        const SizedBox(height: 20),
                      ],
                      if (!isTherapy &&
                          (recommendations.isNotEmpty || notes.isNotEmpty)) ...[
                        Text('Maßnahmen', style: AniDocsText.sectionTitle()),
                        const SizedBox(height: 10),
                        _CardColumn(
                          children: [
                            if (recommendations.isNotEmpty)
                              _FindingBlock(
                                label: 'Behandlung / Empfehlung',
                                body: recommendations,
                              ),
                            if (notes.isNotEmpty)
                              _FindingBlock(label: 'Notizen', body: notes),
                          ],
                        ),
                        const SizedBox(height: 20),
                      ],
                      if (isTherapy && notes.isNotEmpty) ...[
                        Text('Notizen', style: AniDocsText.sectionTitle()),
                        const SizedBox(height: 10),
                        _CardColumn(
                          children: [
                            _FindingBlock(label: 'Interne Notizen', body: notes),
                          ],
                        ),
                        const SizedBox(height: 20),
                      ],
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Fotos${photosAsync.asData != null ? ' · ${photos.length}' : ''}',
                              style: AniDocsText.sectionTitle(),
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () => _addPhoto(context, ref),
                            icon: const Icon(TablerIcons.cameraPlus, size: 18),
                            label: const Text('Hinzufügen'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      photosAsync.when(
                        loading: () => const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(child: CircularProgressIndicator()),
                        ),
                        error: (e, _) => Text(
                          'Fotos: $e',
                          style: const TextStyle(color: AniDocsColors.danger),
                        ),
                        data: (photoList) {
                          if (photoList.isEmpty) {
                            return Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(16),
                              decoration: AniDocsColors.card(),
                              child: const Text(
                                'Noch keine Fotos. Tippe „Hinzufügen“ oder den Kamera-Button.',
                                style: TextStyle(
                                  color: AniDocsColors.secondary,
                                ),
                              ),
                            );
                          }
                          return GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: photoList.length,
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  crossAxisSpacing: 8,
                                  mainAxisSpacing: 8,
                                ),
                            itemBuilder: (context, i) {
                              final p = photoList[i];
                              final hasMarkers =
                                  (p.annotations?['items'] as List?)
                                      ?.isNotEmpty ==
                                  true;
                              return GestureDetector(
                                onTap: () async {
                                  final changed = await Navigator.of(context)
                                      .push<Map<String, dynamic>>(
                                        MaterialPageRoute(
                                          builder: (_) => PhotoAnnotatorScreen(
                                            imageUrl: p.url,
                                            photoId: p.id,
                                            isDocumentationRecord:
                                                isDocumentationRecord,
                                            initialAnnotations: p.annotations,
                                          ),
                                        ),
                                      );
                                  if (changed != null) {
                                    ref.invalidate(
                                      recordPhotosProvider(photoKey),
                                    );
                                  }
                                },
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(AniDocsColors.cardRadius),
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      Image.network(p.url, fit: BoxFit.cover),
                                      Positioned(
                                        right: 6,
                                        top: 6,
                                        child: Container(
                                          padding: const EdgeInsets.all(4),
                                          decoration: BoxDecoration(
                                            color: Colors.black54,
                                            borderRadius: BorderRadius.circular(
                                              6,
                                            ),
                                          ),
                                          child: Icon(
                                            hasMarkers
                                                ? TablerIcons.notes
                                                : TablerIcons.edit,
                                            color: Colors.white,
                                            size: 14,
                                          ),
                                        ),
                                      ),
                                      if (p.type != null)
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
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              p.type!,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 10,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          );
                        },
                      ),
                      if (date != null) ...[
                        const SizedBox(height: 20),
                        Text(
                          dateFmt.format(date),
                          style: const TextStyle(
                            fontSize: 12,
                            color: AniDocsColors.muted,
                          ),
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _addPhoto(BuildContext context, WidgetRef ref) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(TablerIcons.camera),
              title: const Text('Kamera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(TablerIcons.photo),
              title: const Text('Galerie'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 2400,
    );
    if (file == null) return;

    final userId = supabase.auth.currentUser?.id;
    if (userId == null) return;

    final bytes = await file.readAsBytes();
    final ext = file.name.split('.').last.toLowerCase();
    final safeExt = (ext == 'png' || ext == 'webp' || ext == 'heic')
        ? ext
        : 'jpg';
    final path =
        '$userId/$horseId/$recordId/${DateTime.now().millisecondsSinceEpoch}.$safeExt';

    try {
      await supabase.storage
          .from('hoof-photos')
          .uploadBinary(
            path,
            bytes,
            fileOptions: FileOptions(
              contentType: 'image/$safeExt',
              upsert: false,
            ),
          );

      if (isDocumentationRecord) {
        await supabase.from('documentation_photos').insert({
          'user_id': userId,
          'documentation_record_id': recordId,
          'file_path': path,
          'photo_type': 'mobile_upload',
        });
      } else {
        await supabase.from('hoof_photos').insert({
          'user_id': userId,
          'hoof_record_id': recordId,
          'file_path': path,
          'photo_type': 'mobile_upload',
        });
      }

      ref.invalidate(
        recordPhotosProvider((
          recordId: recordId,
          isDoc: isDocumentationRecord,
        )),
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Foto gespeichert.')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Upload fehlgeschlagen: $e')));
      }
    }
  }

  static String _stripHtml(String html) {
    return html
        .replaceAll(RegExp(r'<[^>]*>'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static String _therapyModuleLabel(Map<String, dynamic> row) {
    final payload = row['therapy_payload'];
    final meta = row['metadata'];
    String? moduleId;
    if (meta is Map && meta['documentation_module'] != null) {
      moduleId = '${meta['documentation_module']}';
    }
    if (moduleId == null && payload is Map && payload['module_id'] != null) {
      moduleId = '${payload['module_id']}';
    }
    moduleId ??= '${row['therapy_discipline'] ?? ''}';
    return switch (moduleId) {
      'physio' => 'Physiotherapie',
      'osteo' => 'Osteopathie',
      'heilpraktik' => 'Heilpraktiker',
      _ => 'Therapie',
    };
  }

  static List<_TherapySectionView> _parseTherapySections(
    Map<String, dynamic> row,
  ) {
    final payload = row['therapy_payload'];
    if (payload is! Map) return const [];
    final sectionsRaw = payload['sections'];
    if (sectionsRaw is! Map) return const [];

    final values = <String, String>{};
    for (final e in sectionsRaw.entries) {
      final plain = _stripHtml('${e.value}');
      if (plain.isNotEmpty) values['${e.key}'] = plain;
    }
    if (values.isEmpty) return const [];

    final moduleId =
        '${payload['module_id'] ?? row['therapy_discipline'] ?? 'heilpraktik'}';
    final animalType = payload['animal_type'] as String?;
    final defs = therapySectionsForModule(
      moduleId: moduleId,
      animalType: animalType,
    );

    final out = <_TherapySectionView>[];
    for (final def in defs) {
      final fields = <_TherapyFieldView>[];
      for (final f in def.fields) {
        final v = values[f.id];
        if (v == null || v.isEmpty) continue;
        fields.add(_TherapyFieldView(label: f.label, value: v));
      }
      if (fields.isNotEmpty) {
        out.add(_TherapySectionView(title: def.title, fields: fields));
      }
    }
    if (out.isEmpty) {
      out.add(
        _TherapySectionView(
          title: 'Angaben',
          fields: [
            for (final e in values.entries)
              _TherapyFieldView(label: e.key, value: e.value),
          ],
        ),
      );
    }
    return out;
  }

  static List<_BodyMarkerView> _parseBodyMapMarkers(Map<String, dynamic> row) {
    final payload = row['therapy_payload'];
    if (payload is! Map) return const [];
    final body = payload['body_map'];
    if (body is! Map) return const [];
    final markers = body['markers'];
    if (markers is! List) return const [];

    const viewLabels = {
      'left': 'Links',
      'right': 'Rechts',
      'front': 'Vorne',
      'back': 'Hinten',
    };

    final out = <_BodyMarkerView>[];
    for (final raw in markers) {
      if (raw is! Map) continue;
      final view = '${raw['view'] ?? ''}';
      if (view.isEmpty) continue;
      final finding = '${raw['findingText'] ?? ''}'.trim();
      final treatment = '${raw['treatmentText'] ?? ''}'.trim();
      final type = '${raw['markerType'] ?? 'finding'}';
      final line = [
        if (finding.isNotEmpty) finding,
        if (treatment.isNotEmpty) treatment,
      ].join(' · ');
      out.add(
        _BodyMarkerView(
          view: view,
          label: viewLabels[view] ?? view,
          line: line.isNotEmpty ? line : type,
        ),
      );
    }
    return out;
  }

  static List<({String label, List<_BodyMarkerView> markers})>
  _groupBodyMarkersByView(List<_BodyMarkerView> markers) {
    final map = <String, List<_BodyMarkerView>>{};
    final labels = <String, String>{};
    for (final m in markers) {
      map.putIfAbsent(m.view, () => []).add(m);
      labels[m.view] = m.label;
    }
    return [
      for (final e in map.entries)
        (label: labels[e.key] ?? e.key, markers: e.value),
    ];
  }

  static List<_HoofView> _parseHoofs(Map<String, dynamic> row) {
    dynamic raw = row['hoofs_json'];
    final payload = row['hoof_payload'];
    if (raw == null && payload is Map) {
      raw = payload['hoofs_json'] ?? payload['hoofs'];
    }
    final list = <Map<String, dynamic>>[];
    if (raw is List) {
      for (final e in raw) {
        if (e is Map) list.add(Map<String, dynamic>.from(e));
      }
    }
    const order = ['vl', 'vr', 'hl', 'hr'];
    const labels = {'vl': 'VL', 'vr': 'VR', 'hl': 'HL', 'hr': 'HR'};
    final byPos = <String, Map<String, dynamic>>{};
    for (final m in list) {
      final pos = '${m['hoof_position'] ?? m['position'] ?? ''}'.toLowerCase();
      if (pos.isNotEmpty) byPos[pos] = m;
    }
    if (byPos.isEmpty) return const [];

    return [
      for (final pos in order) _HoofView.fromMap(pos, labels[pos]!, byPos[pos]),
    ];
  }

  static Map<String, List<dynamic>> _groupPhotosByHoof(
    List<
      ({String id, String? type, String url, Map<String, dynamic>? annotations})
    >
    photos,
  ) {
    final map = <String, List<dynamic>>{};
    for (final p in photos) {
      final t = (p.type ?? '').toLowerCase();
      for (final key in ['vl', 'vr', 'hl', 'hr']) {
        if (t.contains(key) || t.contains(key.toUpperCase())) {
          map.putIfAbsent(key, () => []).add(p);
        }
      }
    }
    return map;
  }
}

class _TherapyFieldView {
  const _TherapyFieldView({required this.label, required this.value});
  final String label;
  final String value;
}

class _TherapySectionView {
  const _TherapySectionView({required this.title, required this.fields});
  final String title;
  final List<_TherapyFieldView> fields;
}

class _BodyMarkerView {
  const _BodyMarkerView({
    required this.view,
    required this.label,
    required this.line,
  });
  final String view;
  final String label;
  final String line;
}

class _HoofView {
  const _HoofView({
    required this.position,
    required this.labelShort,
    required this.statusLabel,
    required this.tone,
    required this.detailLine,
  });

  final String position;
  final String labelShort;
  final String statusLabel;
  final StatusChipTone tone;
  final String detailLine;

  static _HoofView fromMap(String pos, String label, Map<String, dynamic>? m) {
    if (m == null) {
      return _HoofView(
        position: pos,
        labelShort: label,
        statusLabel: '—',
        tone: StatusChipTone.neutral,
        detailLine: '',
      );
    }
    final parts = <String>[
      if (m['toe_alignment'] != null) 'Zehe: ${m['toe_alignment']}',
      if (m['heel_balance'] != null) 'Trachten: ${m['heel_balance']}',
      if (m['frog_condition'] != null) 'Strahl: ${m['frog_condition']}',
      if (m['sole_condition'] != null) 'Sohle: ${m['sole_condition']}',
      if (m['notes'] != null && '${m['notes']}'.trim().isNotEmpty)
        '${m['notes']}',
      if (m['work_status'] != null) '${m['work_status']}',
    ];
    final frog = '${m['frog_condition'] ?? ''}'.toLowerCase();
    final sole = '${m['sole_condition'] ?? ''}'.toLowerCase();
    final work = '${m['work_status'] ?? ''}'.toLowerCase();
    var status = 'Unauffällig';
    var tone = StatusChipTone.success;
    final critical =
        work.contains('problem') ||
        frog.contains('fäule') ||
        frog.contains('faeule') ||
        sole.contains('abszess');
    final frogOdd = frog.isNotEmpty && frog != 'gesund' && frog != 'null';
    final soleOdd = sole.isNotEmpty && sole != 'stabil' && sole != 'null';
    if (critical) {
      status = 'Kritisch';
      tone = StatusChipTone.danger;
    } else if (work.contains('behand') ||
        frog.contains('empfindlich') ||
        sole.contains('empfindlich') ||
        frogOdd ||
        soleOdd) {
      status = 'Auffällig';
      tone = StatusChipTone.warning;
    }
    return _HoofView(
      position: pos,
      labelShort: label,
      statusLabel: status,
      tone: tone,
      detailLine: parts.join(' · '),
    );
  }
}

class _HoofCard extends StatelessWidget {
  const _HoofCard({required this.hoof, required this.photoCount});
  final _HoofView hoof;
  final int photoCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: AniDocsColors.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(hoof.labelShort, style: AniDocsText.sectionTitle()),
              const Spacer(),
              StatusChip(label: hoof.statusLabel, tone: hoof.tone),
            ],
          ),
          const Spacer(),
          Text(
            photoCount > 0 ? '$photoCount Fotos' : 'Keine Fotos',
            style: const TextStyle(
              fontSize: 13,
              color: AniDocsColors.secondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _CardColumn extends StatelessWidget {
  const _CardColumn({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final items = children.whereType<Widget>().toList();
    if (items.isEmpty) return const SizedBox.shrink();
    return Container(
      decoration: AniDocsColors.card(),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AniDocsColors.divider),
            items[i],
          ],
        ],
      ),
    );
  }
}

class _FindingBlock extends StatelessWidget {
  const _FindingBlock({
    required this.label,
    required this.body,
    this.chip,
    this.tone = StatusChipTone.neutral,
  });

  final String label;
  final String body;
  final String? chip;
  final StatusChipTone tone;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              if (chip != null) StatusChip(label: chip!, tone: tone),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            body,
            style: const TextStyle(
              fontSize: 15,
              height: 1.4,
              color: AniDocsColors.foreground,
            ),
          ),
        ],
      ),
    );
  }
}
