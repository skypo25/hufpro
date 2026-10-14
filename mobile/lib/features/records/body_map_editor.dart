import 'package:flutter/material.dart';

import '../../theme/anidocs_colors.dart';
import '../../theme/anidocs_text.dart';

/// Platzhalter-Körperkarte (Pferd/Hund/Katze), Koordinaten 0–1 — analog Web.
class BodyMapMarkerData {
  BodyMapMarkerData({
    required this.id,
    required this.view,
    required this.templateId,
    required this.templateVersion,
    required this.x,
    required this.y,
    required this.markerType,
    this.findingText = '',
    this.treatmentText = '',
  });

  final String id;
  final String view;
  final String templateId;
  final int templateVersion;
  double x;
  double y;
  String markerType;
  String findingText;
  String treatmentText;

  Map<String, dynamic> toJson() => {
        'id': id,
        'view': view,
        'templateId': templateId,
        'templateVersion': templateVersion,
        'x': x,
        'y': y,
        'markerType': markerType,
        'findingText': findingText,
        'treatmentText': treatmentText,
        'updatedAt': DateTime.now().toUtc().toIso8601String(),
      };
}

const _viewLabels = <String, String>{
  'left': 'Links',
  'right': 'Rechts',
  'front': 'Vorne',
  'back': 'Hinten',
};

const _typeLabels = <String, String>{
  'finding': 'Befund',
  'treatment': 'Behandlung',
  'pain': 'Schmerz',
  'note': 'Notiz',
};

Color _markerColor(String type) {
  switch (type) {
    case 'pain':
      return const Color(0xFFDC2626);
    case 'treatment':
      return const Color(0xFF3B82F6);
    case 'note':
      return const Color(0xFFF59E0B);
    default:
      return AniDocsColors.accent;
  }
}

class BodyMapEditor extends StatefulWidget {
  const BodyMapEditor({
    super.key,
    required this.animalType,
    required this.markers,
    required this.onChanged,
  });

  /// horse | dog | cat
  final String animalType;
  final List<BodyMapMarkerData> markers;
  final ValueChanged<List<BodyMapMarkerData>> onChanged;

  @override
  State<BodyMapEditor> createState() => _BodyMapEditorState();
}

class _BodyMapEditorState extends State<BodyMapEditor> {
  static const _views = ['left', 'right', 'front', 'back'];
  String _view = 'left';
  String _markerType = 'finding';
  String? _selectedId;

  List<BodyMapMarkerData> get _viewMarkers =>
      widget.markers.where((m) => m.view == _view).toList();

  String get _templateId => 'bodymap_${widget.animalType}_${_view}_v1';

  BodyMapMarkerData? get _selected {
    for (final m in widget.markers) {
      if (m.id == _selectedId) return m;
    }
    return null;
  }

  void _addAt(Offset local, Size size) {
    final x = (local.dx / size.width).clamp(0.0, 1.0);
    final y = (local.dy / size.height).clamp(0.0, 1.0);
    final id = 'm_${DateTime.now().millisecondsSinceEpoch}';
    final next = [
      ...widget.markers,
      BodyMapMarkerData(
        id: id,
        view: _view,
        templateId: _templateId,
        templateVersion: 1,
        x: x,
        y: y,
        markerType: _markerType,
      ),
    ];
    setState(() => _selectedId = id);
    widget.onChanged(next);
  }

  String get _animalLabel {
    switch (widget.animalType) {
      case 'dog':
        return 'Hund';
      case 'cat':
        return 'Katze';
      default:
        return 'Pferd';
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selected;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Körperkarte', style: AniDocsText.sectionTitle()),
        const SizedBox(height: 4),
        Text(
          'Antippen setzt eine Markierung · Ziehen verschiebt',
          style: AniDocsText.fieldHelper(),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final v in _views)
              ChoiceChip(
                label: Text(_viewLabels[v] ?? v),
                selected: _view == v,
                onSelected: (_) => setState(() => _view = v),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final t in _typeLabels.keys)
              ChoiceChip(
                label: Text(_typeLabels[t]!),
                selected: _markerType == t,
                selectedColor: _markerColor(t).withValues(alpha: 0.2),
                onSelected: (_) => setState(() => _markerType = t),
              ),
          ],
        ),
        const SizedBox(height: 10),
        AspectRatio(
          aspectRatio: 4 / 3,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final size = Size(constraints.maxWidth, constraints.maxHeight);
              return GestureDetector(
                onTapDown: (d) => _addAt(d.localPosition, size),
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F7F4),
                    border: Border.all(color: AniDocsColors.border),
                    borderRadius:
                        BorderRadius.circular(AniDocsColors.cardRadiusSm),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: CustomPaint(
                          painter: _SilhouettePainter(
                            animal: widget.animalType,
                            view: _view,
                          ),
                        ),
                      ),
                      Positioned(
                        left: 10,
                        top: 8,
                        child: Text(
                          '$_animalLabel · ${_viewLabels[_view] ?? _view}',
                          style: AniDocsText.fieldHelper(),
                        ),
                      ),
                      for (final m in _viewMarkers)
                        Positioned(
                          left: m.x * size.width - 9,
                          top: m.y * size.height - 9,
                          child: GestureDetector(
                            onPanUpdate: (d) {
                              m.x = (m.x + d.delta.dx / size.width)
                                  .clamp(0.0, 1.0);
                              m.y = (m.y + d.delta.dy / size.height)
                                  .clamp(0.0, 1.0);
                              widget.onChanged([...widget.markers]);
                              setState(() {});
                            },
                            onTap: () => setState(() => _selectedId = m.id),
                            child: Container(
                              width: 18,
                              height: 18,
                              decoration: BoxDecoration(
                                color: _markerColor(m.markerType),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: _selectedId == m.id
                                      ? AniDocsColors.foreground
                                      : Colors.white,
                                  width: 2,
                                ),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x33000000),
                                    blurRadius: 2,
                                    offset: Offset(0, 1),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        if (selected != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AniDocsColors.surface,
              borderRadius: BorderRadius.circular(AniDocsColors.cardRadiusSm),
              border: Border.all(color: AniDocsColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Markierung (${_typeLabels[selected.markerType] ?? selected.markerType})',
                        style: AniDocsText.fieldLabel(),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        widget.onChanged(
                          widget.markers
                              .where((m) => m.id != selected.id)
                              .toList(),
                        );
                        setState(() => _selectedId = null);
                      },
                      style: TextButton.styleFrom(foregroundColor: Colors.red),
                      child: const Text('Löschen'),
                    ),
                  ],
                ),
                TextFormField(
                  key: ValueKey('finding_${selected.id}'),
                  initialValue: selected.findingText,
                  decoration: const InputDecoration(
                    labelText: 'Befund',
                    isDense: true,
                  ),
                  maxLines: 2,
                  onChanged: (v) {
                    selected.findingText = v;
                    widget.onChanged([...widget.markers]);
                  },
                ),
                const SizedBox(height: 8),
                TextFormField(
                  key: ValueKey('treatment_${selected.id}'),
                  initialValue: selected.treatmentText,
                  decoration: const InputDecoration(
                    labelText: 'Behandlung',
                    isDense: true,
                  ),
                  maxLines: 2,
                  onChanged: (v) {
                    selected.treatmentText = v;
                    widget.onChanged([...widget.markers]);
                  },
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _SilhouettePainter extends CustomPainter {
  _SilhouettePainter({required this.animal, required this.view});

  final String animal;
  final String view;

  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint()
      ..color = animal == 'dog'
          ? const Color(0xFFB8C4CE)
          : animal == 'cat'
              ? const Color(0xFFD4C4B0)
              : const Color(0xFFC4B5A0);
    final stroke = Paint()
      ..color = const Color(0xFF5B5248)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    final mirror = view == 'right';
    if (mirror) {
      canvas.translate(size.width, 0);
      canvas.scale(-1, 1);
    }

    final sx = size.width / 400;
    final sy = size.height / 300;
    canvas.scale(sx, sy);

    final frontOrBack = view == 'front' || view == 'back';

    if (animal == 'horse') {
      if (frontOrBack) {
        _ellipse(canvas, const Offset(200, 90), 36, 42, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(170, 120, 60, 100), 12, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(175, 215, 18, 50), 4, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(207, 215, 18, 50), 4, fill, stroke);
      } else {
        _ellipse(canvas, const Offset(280, 95), 40, 32, fill, stroke);
        _ellipse(canvas, const Offset(180, 140), 90, 50, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(120, 175, 16, 70), 4, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(155, 180, 16, 65), 4, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(200, 180, 16, 65), 4, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(235, 175, 16, 70), 4, fill, stroke);
      }
    } else if (animal == 'dog') {
      if (frontOrBack) {
        canvas.drawCircle(const Offset(200, 100), 34, fill);
        canvas.drawCircle(const Offset(200, 100), 34, stroke);
        _ellipse(canvas, const Offset(200, 175), 45, 55, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(175, 220, 14, 40), 3, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(211, 220, 14, 40), 3, fill, stroke);
      } else {
        canvas.drawCircle(const Offset(270, 120), 28, fill);
        canvas.drawCircle(const Offset(270, 120), 28, stroke);
        _ellipse(canvas, const Offset(180, 150), 70, 40, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(130, 180, 12, 50), 3, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(160, 185, 12, 45), 3, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(200, 185, 12, 45), 3, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(230, 180, 12, 50), 3, fill, stroke);
      }
    } else {
      if (frontOrBack) {
        canvas.drawCircle(const Offset(200, 95), 30, fill);
        canvas.drawCircle(const Offset(200, 95), 30, stroke);
        _ellipse(canvas, const Offset(200, 170), 38, 48, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(178, 210, 12, 45), 3, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(210, 210, 12, 45), 3, fill, stroke);
      } else {
        canvas.drawCircle(const Offset(260, 115), 24, fill);
        canvas.drawCircle(const Offset(260, 115), 24, stroke);
        _ellipse(canvas, const Offset(180, 150), 55, 32, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(140, 175, 10, 45), 3, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(165, 180, 10, 40), 3, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(195, 180, 10, 40), 3, fill, stroke);
        _rrect(canvas, const Rect.fromLTWH(220, 175, 10, 45), 3, fill, stroke);
      }
    }
  }

  void _ellipse(
    Canvas canvas,
    Offset c,
    double rx,
    double ry,
    Paint fill,
    Paint stroke,
  ) {
    final r = Rect.fromCenter(center: c, width: rx * 2, height: ry * 2);
    canvas.drawOval(r, fill);
    canvas.drawOval(r, stroke);
  }

  void _rrect(
    Canvas canvas,
    Rect rect,
    double radius,
    Paint fill,
    Paint stroke,
  ) {
    final rr = RRect.fromRectAndRadius(rect, Radius.circular(radius));
    canvas.drawRRect(rr, fill);
    canvas.drawRRect(rr, stroke);
  }

  @override
  bool shouldRepaint(covariant _SilhouettePainter oldDelegate) =>
      oldDelegate.animal != animal || oldDelegate.view != view;
}
