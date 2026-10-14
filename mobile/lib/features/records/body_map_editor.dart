import 'package:flutter/material.dart';

/// Platzhalter-Körperkarte (Pferd/Hund/Katze) mit normalisierten Koordinaten 0–1.
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

class BodyMapEditor extends StatefulWidget {
  const BodyMapEditor({
    super.key,
    required this.animalType,
    required this.markers,
    required this.onChanged,
  });

  final String animalType; // horse | dog | cat
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

  String get _templateId =>
      'bodymap_${widget.animalType}_${_view}_v1';

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

  @override
  Widget build(BuildContext context) {
    final selected = widget.markers.cast<BodyMapMarkerData?>().firstWhere(
          (m) => m?.id == _selectedId,
          orElse: () => null,
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          children: [
            for (final v in _views)
              ChoiceChip(
                label: Text(v),
                selected: _view == v,
                onSelected: (_) => setState(() => _view = v),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final t in ['finding', 'treatment', 'pain', 'note'])
              ChoiceChip(
                label: Text(t),
                selected: _markerType == t,
                onSelected: (_) => setState(() => _markerType = t),
              ),
          ],
        ),
        const SizedBox(height: 8),
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
                    border: Border.all(color: const Color(0xFFE5E2DC)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Text(
                          'Platzhalter ${widget.animalType} · $_view',
                          style: const TextStyle(color: Color(0xFF9CA3AF)),
                        ),
                      ),
                      for (final m in _viewMarkers)
                        Positioned(
                          left: m.x * size.width - 8,
                          top: m.y * size.height - 8,
                          child: GestureDetector(
                            onPanUpdate: (d) {
                              final nx = (m.x + d.delta.dx / size.width)
                                  .clamp(0.0, 1.0);
                              final ny = (m.y + d.delta.dy / size.height)
                                  .clamp(0.0, 1.0);
                              m.x = nx;
                              m.y = ny;
                              widget.onChanged([...widget.markers]);
                              setState(() {});
                            },
                            onTap: () => setState(() => _selectedId = m.id),
                            child: Container(
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                color: m.markerType == 'pain'
                                    ? Colors.red
                                    : m.markerType == 'treatment'
                                        ? Colors.blue
                                        : Colors.green,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: _selectedId == m.id
                                      ? Colors.black
                                      : Colors.white,
                                  width: 2,
                                ),
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
          TextFormField(
            key: ValueKey('finding_${selected.id}'),
            initialValue: selected.findingText,
            decoration: const InputDecoration(labelText: 'Befund'),
            onChanged: (v) {
              selected.findingText = v;
              widget.onChanged([...widget.markers]);
            },
          ),
          TextFormField(
            key: ValueKey('treatment_${selected.id}'),
            initialValue: selected.treatmentText,
            decoration: const InputDecoration(labelText: 'Behandlung'),
            onChanged: (v) {
              selected.treatmentText = v;
              widget.onChanged([...widget.markers]);
            },
          ),
          TextButton(
            onPressed: () {
              widget.onChanged(
                widget.markers.where((m) => m.id != selected.id).toList(),
              );
              setState(() => _selectedId = null);
            },
            child: const Text('Markierung löschen'),
          ),
        ],
      ],
    );
  }
}
