import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:tabler_icons_plus/tabler_icons_plus.dart';

import '../../core/animal_type.dart';
import '../../core/app_profile_provider.dart';
import '../../core/notifications/local_notifications.dart';
import '../../core/offline/offline_errors.dart';
import '../../core/offline/offline_store.dart';
import '../../core/offline/online_check.dart';
import '../../core/supabase.dart';
import '../../theme/anidocs_colors.dart';
import '../../theme/anidocs_form.dart';
import '../../theme/anidocs_text.dart';
import '../../widgets/dark_page_header.dart';
import '../animals/animals_list_screen.dart';
import '../animals/animals_repository.dart';
import '../customers/customers_list_screen.dart';
import 'appointment_detail_screen.dart';
import 'appointments_list_screen.dart';
import 'appointments_offline.dart';
import 'appointments_repository.dart';

class AppointmentFormScreen extends ConsumerStatefulWidget {
  const AppointmentFormScreen({
    super.key,
    this.existingId,
    this.initialCustomerId,
  });

  final String? existingId;
  final String? initialCustomerId;

  @override
  ConsumerState<AppointmentFormScreen> createState() =>
      _AppointmentFormScreenState();
}

class _AppointmentFormScreenState extends ConsumerState<AppointmentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notes = TextEditingController();
  static const _standardTypes = [
    'Ersttermin',
    'Regeltermin',
    'Kontrolle',
    'Sondertermin',
  ];

  /// Legacy-Werte (z. B. „Hufpflege“) bleiben erhalten und erscheinen in der Liste.
  String _type = 'Regeltermin';
  String? _documentationModule;

  DateTime _date = DateTime.now().add(const Duration(hours: 1));
  TimeOfDay _time = TimeOfDay(hour: DateTime.now().hour + 1, minute: 0);
  int _duration = 60;
  String _status = 'Geplant';
  int _reminderMinutes = 60;
  String? _customerId;
  final Set<String> _horseIds = {};

  List<Map<String, dynamic>> _customers = [];
  List<Map<String, dynamic>> _horses = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.existingId != null;

  @override
  void initState() {
    super.initState();
    _customerId = widget.initialCustomerId;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final customers = await ref.read(customersRepositoryProvider).list();
      _customers = customers
          .map((c) => {'id': c.id, 'name': c.displayName})
          .toList();

      if (_isEdit) {
        final apt =
            await AppointmentsRepository().getById(widget.existingId!);
        if (apt != null) {
          final when =
              DateTime.tryParse('${apt['appointment_date']}')?.toLocal();
          if (when != null) {
            _date = when;
            _time = TimeOfDay(hour: when.hour, minute: when.minute);
          }
          final rawType = '${apt['type'] ?? 'Regeltermin'}'.trim();
          _type = rawType.isEmpty ? 'Regeltermin' : rawType;
          final dm = '${apt['documentation_module'] ?? ''}'.trim();
          _documentationModule = dm.isEmpty ? null : dm;
          _status = '${apt['status'] ?? 'Geplant'}';
          _duration = (apt['duration_minutes'] as num?)?.toInt() ?? 60;
          _reminderMinutes =
              (apt['reminder_minutes_before'] as num?)?.toInt() ?? 60;
          if (![15, 30, 60, 120, 1440].contains(_reminderMinutes)) {
            _reminderMinutes = 60;
          }
          _notes.text = '${apt['notes'] ?? ''}';
          _customerId = apt['customer_id'] as String?;
          final horses = apt['horses'];
          if (horses is List) {
            for (final h in horses) {
              if (h is Map && h['id'] != null) _horseIds.add('${h['id']}');
            }
          }
        }
      }

      if (_customerId != null) await _loadHorses(_customerId!);
    } catch (_) {
      _error =
          'Offline-Daten fehlen. Bitte einmal online Termine & Kunden öffnen.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadHorses(String customerId) async {
    List<Map<String, dynamic>> all;
    try {
      all = await AnimalsRepository().list();
    } catch (_) {
      all = await ref.read(animalsListProvider('').future);
    }
    _horses = all.where((h) => h['customer_id'] == customerId).toList();
    _horseIds.removeWhere((id) => !_horses.any((h) => h['id'] == id));
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
      locale: const Locale('de'),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _time);
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _scheduleReminder(
    String appointmentId,
    DateTime whenLocal,
  ) async {
    Map<String, dynamic>? customer;
    for (final c in _customers) {
      if (c['id'] == _customerId) {
        customer = c;
        break;
      }
    }
    final name = customer?['name'] as String? ?? 'Termin';
    try {
      await LocalNotifications.instance.cancelAppointmentReminder(
        appointmentId,
      );
      await LocalNotifications.instance.scheduleAppointmentReminder(
        appointmentId: appointmentId,
        whenLocal: whenLocal,
        title: 'AniDocs Termin',
        body: '$name · ${_type.trim()} in $_reminderMinutes Min.',
        minutesBefore: _reminderMinutes,
      );
    } catch (_) {}
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_customerId == null) {
      setState(() => _error = 'Kunde wählen');
      return;
    }
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) return;

    final local = DateTime(
      _date.year,
      _date.month,
      _date.day,
      _time.hour,
      _time.minute,
    );
    final iso = local.toUtc().toIso8601String();

    setState(() {
      _saving = true;
      _error = null;
    });

    final online = await deviceLooksOnline();
    final store = ref.read(offlineStoreProvider);
    final horseNames = [
      for (final h in _horses)
        if (_horseIds.contains(h['id'])) '${h['name'] ?? ''}'.trim(),
    ].where((s) => s.isNotEmpty).toList();
    String? customerName;
    for (final c in _customers) {
      if (c['id'] == _customerId) {
        customerName = '${c['name'] ?? ''}';
        break;
      }
    }
    final basePayload = <String, dynamic>{
      'customer_id': _customerId,
      'appointment_date': iso,
      'type': _type.trim(),
      'status': _status,
      'duration_minutes': _duration,
      'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      'reminder_minutes_before': _reminderMinutes,
      'documentation_module': _documentationModule,
      'horse_ids': _horseIds.toList(),
      'horse_names': horseNames,
      if (customerName != null && customerName.isNotEmpty)
        'customers': {'name': customerName},
    };

    Future<void> saveOffline(String type, String aptId) async {
      final row = {...basePayload, 'id': aptId};
      await store.enqueueOutbox({
        'type': type,
        'appointmentId': aptId,
        'payload': row,
      });
      await upsertCachedAppointmentList(store, row);
      await cacheAppointmentDetail(store, {
        ...row,
        'horses': [
          for (final h in _horses)
            if (_horseIds.contains(h['id'])) h,
        ],
      });
      try {
        await _scheduleReminder(aptId, local);
      } catch (_) {}
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Offline gespeichert — wird synchronisiert, sobald Netz da ist.',
          ),
        ),
      );
      ref.invalidate(appointmentsListProvider);
      Navigator.of(context).pop(true);
    }

    try {
      if (_isEdit) {
        final aptId = widget.existingId!;
        if (online) {
          try {
            await supabase
                .from('appointments')
                .update({
                  'customer_id': _customerId,
                  'appointment_date': iso,
                  'type': _type.trim(),
                  'status': _status,
                  'duration_minutes': _duration,
                  'notes':
                      _notes.text.trim().isEmpty ? null : _notes.text.trim(),
                  'reminder_minutes_before': _reminderMinutes,
                  'documentation_module': _documentationModule,
                })
                .eq('user_id', userId)
                .eq('id', aptId);

            await supabase
                .from('appointment_horses')
                .delete()
                .eq('appointment_id', aptId)
                .eq('user_id', userId);

            if (_horseIds.isNotEmpty) {
              await supabase.from('appointment_horses').insert([
                for (final hid in _horseIds)
                  {
                    'user_id': userId,
                    'appointment_id': aptId,
                    'horse_id': hid,
                  },
              ]);
            }
            await _scheduleReminder(aptId, local);
            await upsertCachedAppointmentList(store, {
              ...basePayload,
              'id': aptId,
            });
            if (!mounted) return;
            Navigator.of(context).pop(true);
            return;
          } catch (e) {
            if (!looksLikeOfflineError(e)) rethrow;
          }
        }
        await saveOffline('update_appointment', aptId);
        return;
      }

      if (online) {
        try {
          final row = await supabase
              .from('appointments')
              .insert({
                'user_id': userId,
                'customer_id': _customerId,
                'appointment_date': iso,
                'type': _type.trim(),
                'status': _status,
                'duration_minutes': _duration,
                'notes':
                    _notes.text.trim().isEmpty ? null : _notes.text.trim(),
                'reminder_minutes_before': _reminderMinutes,
                'documentation_module': _documentationModule,
              })
              .select('id')
              .single();

          final aptId = row['id'] as String;
          if (_horseIds.isNotEmpty) {
            await supabase.from('appointment_horses').insert([
              for (final hid in _horseIds)
                {
                  'user_id': userId,
                  'appointment_id': aptId,
                  'horse_id': hid,
                },
            ]);
          }
          await _scheduleReminder(aptId, local);
          await upsertCachedAppointmentList(store, {
            ...basePayload,
            'id': aptId,
          });
          if (!mounted) return;
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => AppointmentDetailScreen(appointmentId: aptId),
            ),
          );
          return;
        } catch (e) {
          if (!looksLikeOfflineError(e)) rethrow;
        }
      }

      final localId = 'local_${DateTime.now().microsecondsSinceEpoch}';
      await saveOffline('create_appointment', localId);
    } catch (e) {
      setState(() {
        _error = looksLikeOfflineError(e)
            ? 'Offline gespeichert nicht möglich. Bitte später erneut versuchen.'
            : 'Speichern fehlgeschlagen. Bitte erneut versuchen.';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('EEEE, d. MMM yyyy', 'de').format(_date);
    final profile = watchAppProfile(ref);

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DarkPageHeader(
            title: _isEdit ? 'Termin bearbeiten' : 'Neuer Termin',
            showBack: true,
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : Theme(
                      data: AniDocsForm.overlay(Theme.of(context)),
                      child: Column(
                      children: [
                        Expanded(
                          child: Form(
                            key: _formKey,
                            child: ListView(
                              padding: const EdgeInsets.fromLTRB(
                                16,
                                12,
                                16,
                                32,
                              ),
                              children: [
                                AniDocsDropdownFormField<String>(
                                  value: _customerId,
                                  sheetTitle: 'Kunde wählen',
                                  decoration: const InputDecoration(
                                    labelText: 'Kunde *',
                                    hintText: 'Kunde wählen',
                                  ),
                                  items: [
                                    for (final c in _customers)
                                      anidocsDropdownItem(
                                        value: c['id'] as String,
                                        label: '${c['name'] ?? ''}',
                                      ),
                                  ],
                                  onChanged: (v) async {
                                    setState(() => _customerId = v);
                                    if (v != null) await _loadHorses(v);
                                  },
                                  validator: (v) =>
                                      v == null ? 'Kunde wählen' : null,
                                ),
                                const SizedBox(height: 12),
                                AniDocsDropdownFormField<String>(
                                  value: _type,
                                  sheetTitle: 'Terminart',
                                  decoration: const InputDecoration(
                                    labelText: 'Terminart',
                                  ),
                                  items: [
                                    for (final t in {
                                      ..._standardTypes,
                                      if (!_standardTypes.contains(_type)) _type,
                                    })
                                      anidocsDropdownItem(value: t, label: t),
                                  ],
                                  onChanged: (v) {
                                    if (v != null) setState(() => _type = v);
                                  },
                                ),
                                const SizedBox(height: 12),
                                AniDocsDropdownFormField<String>(
                                  value: _documentationModule ?? '',
                                  sheetTitle: 'Behandlungsmodul',
                                  decoration: const InputDecoration(
                                    labelText: 'Behandlungsmodul (optional)',
                                  ),
                                  items: [
                                    anidocsDropdownItem(
                                      value: '',
                                      label: 'Keine Vorauswahl',
                                    ),
                                    anidocsDropdownItem(
                                      value: 'hoof',
                                      label: 'Hufbearbeitung',
                                    ),
                                    anidocsDropdownItem(
                                      value: 'physio',
                                      label: 'Tierphysiotherapie',
                                    ),
                                    anidocsDropdownItem(
                                      value: 'osteo',
                                      label: 'Tierosteopathie',
                                    ),
                                    anidocsDropdownItem(
                                      value: 'heilpraktik',
                                      label: 'Tierheilpraktik',
                                    ),
                                  ],
                                  onChanged: (v) {
                                    setState(() {
                                      _documentationModule =
                                          (v == null || v.isEmpty) ? null : v;
                                    });
                                  },
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: _PickerTile(
                                        label: 'Datum',
                                        value: dateLabel,
                                        icon: TablerIcons.calendarEvent,
                                        onTap: _pickDate,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: _PickerTile(
                                        label: 'Uhrzeit',
                                        value: _time.format(context),
                                        icon: TablerIcons.clock,
                                        onTap: _pickTime,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                AniDocsDropdownFormField<int>(
                                  value: _duration,
                                  sheetTitle: 'Dauer',
                                  decoration: const InputDecoration(
                                    labelText: 'Dauer',
                                  ),
                                  items: const [
                                    AniDocsSelectOption(
                                      value: 30,
                                      label: '30 Min.',
                                    ),
                                    AniDocsSelectOption(
                                      value: 45,
                                      label: '45 Min.',
                                    ),
                                    AniDocsSelectOption(
                                      value: 60,
                                      label: '60 Min.',
                                    ),
                                    AniDocsSelectOption(
                                      value: 90,
                                      label: '90 Min.',
                                    ),
                                    AniDocsSelectOption(
                                      value: 120,
                                      label: '120 Min.',
                                    ),
                                  ],
                                  onChanged: (v) =>
                                      setState(() => _duration = v ?? 60),
                                ),
                                const SizedBox(height: 12),
                                AniDocsDropdownFormField<String>(
                                  value: _status,
                                  sheetTitle: 'Status',
                                  decoration: const InputDecoration(
                                    labelText: 'Status',
                                  ),
                                  items: const [
                                    AniDocsSelectOption(
                                      value: 'Geplant',
                                      label: 'Geplant',
                                    ),
                                    AniDocsSelectOption(
                                      value: 'Bestätigt',
                                      label: 'Bestätigt',
                                    ),
                                    AniDocsSelectOption(
                                      value: 'Erledigt',
                                      label: 'Erledigt',
                                    ),
                                    AniDocsSelectOption(
                                      value: 'Abgesagt',
                                      label: 'Abgesagt',
                                    ),
                                    AniDocsSelectOption(
                                      value: 'Vorgeschlagen',
                                      label: 'Vorgeschlagen',
                                    ),
                                  ],
                                  onChanged: (v) =>
                                      setState(() => _status = v ?? 'Geplant'),
                                ),
                                const SizedBox(height: 12),
                                AniDocsDropdownFormField<int>(
                                  value: _reminderMinutes,
                                  sheetTitle: 'Push-Erinnerung',
                                  decoration: const InputDecoration(
                                    labelText: 'Push-Erinnerung',
                                  ),
                                  items: const [
                                    AniDocsSelectOption(
                                      value: 15,
                                      label: '15 Minuten vorher',
                                    ),
                                    AniDocsSelectOption(
                                      value: 30,
                                      label: '30 Minuten vorher',
                                    ),
                                    AniDocsSelectOption(
                                      value: 60,
                                      label: '1 Stunde vorher',
                                    ),
                                    AniDocsSelectOption(
                                      value: 120,
                                      label: '2 Stunden vorher',
                                    ),
                                    AniDocsSelectOption(
                                      value: 1440,
                                      label: '1 Tag vorher',
                                    ),
                                  ],
                                  onChanged: (v) => setState(
                                    () => _reminderMinutes = v ?? 60,
                                  ),
                                ),
                                const SizedBox(height: 20),
                                Text(
                                  profile.animalsNav,
                                  style: AniDocsText.sectionTitle(),
                                ),
                                const SizedBox(height: 8),
                                if (_horses.isEmpty)
                                  Text(
                                    profile.noAnimalsForCustomer,
                                    style: const TextStyle(
                                      color: AniDocsColors.secondary,
                                    ),
                                  )
                                else
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      for (final h in _horses)
                                        _HorseSelectChip(
                                          label: (() {
                                            final name =
                                                ((h['name'] as String?) ?? '')
                                                    .trim();
                                            return name.isEmpty
                                                ? profile.animalSingular
                                                : name;
                                          })(),
                                          icon: iconForAnimalType(
                                            h['animal_type'] as String?,
                                          ),
                                          selected: _horseIds.contains(
                                            h['id'] as String,
                                          ),
                                          onTap: () {
                                            setState(() {
                                              final id = h['id'] as String;
                                              if (_horseIds.contains(id)) {
                                                _horseIds.remove(id);
                                              } else {
                                                _horseIds.add(id);
                                              }
                                            });
                                          },
                                        ),
                                    ],
                                  ),
                                const SizedBox(height: 16),
                                TextFormField(
                                  controller: _notes,
                                  decoration: const InputDecoration(
                                    labelText: 'Notizen',
                                  ),
                                  maxLines: 3,
                                ),
                                if (_error != null) ...[
                                  const SizedBox(height: 12),
                                  Text(
                                    _error!,
                                    style: const TextStyle(
                                      color: AniDocsColors.danger,
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 24),
                                FilledButton(
                                  onPressed: _saving ? null : _save,
                                  child: Text(
                                    _saving ? 'Speichern…' : 'Speichern',
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AniDocsColors.card(),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AniDocsColors.cardRadius),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 16, color: AniDocsColors.accent),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AniDocsColors.secondary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  value,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HorseSelectChip extends StatelessWidget {
  const _HorseSelectChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AniDocsColors.accentLight : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AniDocsColors.cardRadiusSm),
        side: BorderSide(
          color: selected ? AniDocsColors.accent : AniDocsColors.border,
          width: 1.5,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AniDocsColors.cardRadiusSm),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                selected ? TablerIcons.circleCheck : icon,
                size: 18,
                color: selected
                    ? AniDocsColors.accent
                    : AniDocsColors.secondary,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: selected
                      ? AniDocsColors.accentDark
                      : AniDocsColors.foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
