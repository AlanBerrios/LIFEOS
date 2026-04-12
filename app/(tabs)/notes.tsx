import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';

function parseReminder(reminderAt?: string): Date | null {
  if (!reminderAt) return null;
  if (reminderAt.includes('T')) {
    const date = new Date(reminderAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const [h, m] = reminderAt.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date;
}

function formatReminder(reminderAt?: string): string {
  const parsed = parseReminder(reminderAt);
  if (!parsed) return '';
  return `${parsed.toLocaleDateString('es-ES')} · ${parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function NotesScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const notes = useLifeStore((s) => s.notes);
  const addNote = useLifeStore((s) => s.addNote);
  const updateNote = useLifeStore((s) => s.updateNote);
  const deleteNote = useLifeStore((s) => s.deleteNote);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState({ title: '', content: '', reminderAt: '' });
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [pendingReminderDate, setPendingReminderDate] = useState<Date | null>(null);

  function handleSave() {
    if (!newNote.title.trim() && !newNote.content.trim()) return;
    
    if (editingNoteId) {
      updateNote(editingNoteId, {
        title: newNote.title.trim() || 'Nota sin título',
        content: newNote.content.trim(),
        reminderAt: newNote.reminderAt || undefined
      });
    } else {
      addNote({
        ...newNote,
        title: newNote.title.trim() || 'Nota sin título'
      });
    }
    
    setModalVisible(false);
    setEditingNoteId(null);
    setNewNote({ title: '', content: '', reminderAt: '' });
    setShowReminderDatePicker(false);
    setShowReminderTimePicker(false);
    setPendingReminderDate(null);
  }

  function openEdit(note: any) {
    setEditingNoteId(note.id);
    setNewNote({ title: note.title, content: note.content, reminderAt: note.reminderAt || '' });
    setModalVisible(true);
  }

  function openCreate() {
    setEditingNoteId(null);
    setNewNote({ title: '', content: '', reminderAt: '' });
    setModalVisible(true);
  }

  function openReminderPicker() {
    setShowReminderDatePicker(true);
  }

  function clearReminder() {
    setNewNote((prev) => ({ ...prev, reminderAt: '' }));
    setPendingReminderDate(null);
  }

  function handleReminderDateChange(_event: unknown, selected?: Date) {
    setShowReminderDatePicker(false);
    if (!selected) return;

    if (Platform.OS === 'android') {
      setPendingReminderDate(selected);
      setShowReminderTimePicker(true);
      return;
    }

    const base = parseReminder(newNote.reminderAt) ?? new Date();
    selected.setHours(base.getHours(), base.getMinutes(), 0, 0);
    setNewNote((prev) => ({ ...prev, reminderAt: selected.toISOString() }));
  }

  function handleReminderTimeChange(_event: unknown, selected?: Date) {
    setShowReminderTimePicker(false);
    if (!selected || !pendingReminderDate) {
      setPendingReminderDate(null);
      return;
    }

    const merged = new Date(pendingReminderDate);
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setNewNote((prev) => ({ ...prev, reminderAt: merged.toISOString() }));
    setPendingReminderDate(null);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hdr}>
        <Text style={styles.title}>📝 Bloc de Notas</Text>
        <Pressable style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ Nueva</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {notes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Tu bloc está vacío.{'\n'}Captura tus ideas aquí.</Text>
          </View>
        ) : (
          notes.map((note, idx) => (
            <Animated.View
              key={note.id}
              entering={FadeInDown.delay(idx * 50)}
              layout={Layout.springify()}
            >
              <Pressable style={styles.noteCard} onPress={() => openEdit(note)}>
              <View style={styles.noteHdr}>
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Pressable
                  onPress={() => {
                    Alert.alert('Eliminar', '¿Borrar esta nota?', [
                      { text: 'No', style: 'cancel' },
                      { text: 'Sí, borrar', style: 'destructive', onPress: () => deleteNote(note.id) }
                    ]);
                  }}
                >
                  <Text style={styles.delIcon}>🗑</Text>
                </Pressable>
              </View>
              <Text style={styles.noteContent}>{note.content}</Text>
              <View style={styles.noteFooter}>
                <Text style={styles.noteDate}>
                  {note.createdAt.toLocaleDateString()} · {note.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {note.reminderAt && (
                  <View style={styles.reminderBadge}>
                    <Text style={styles.reminderText}>🔔 {formatReminder(note.reminderAt)}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
          ))
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingNoteId ? 'Editar Nota' : 'Nueva Nota'}</Text>
            
            <TextInput
              style={styles.inputTitle}
              value={newNote.title}
              onChangeText={(v) => setNewNote((prev) => ({ ...prev, title: v }))}
              placeholder="Título (opcional)"
              placeholderTextColor={lifeTheme.colors.muted}
            />

            <TextInput
              style={styles.inputContent}
              value={newNote.content}
              onChangeText={(v) => setNewNote((prev) => ({ ...prev, content: v }))}
              placeholder="Escribe algo..."
              placeholderTextColor={lifeTheme.colors.muted}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.reminderRow}>
              <Text style={styles.label}>Recordatorio (día y hora)</Text>
              <View style={styles.reminderActionRow}>
                <Pressable style={styles.reminderPickerBtn} onPress={openReminderPicker}>
                  <Text style={[styles.reminderPickerText, newNote.reminderAt ? styles.reminderPickerTextActive : null]}>
                    {newNote.reminderAt ? formatReminder(newNote.reminderAt) : 'Seleccionar fecha y hora'}
                  </Text>
                </Pressable>
                {newNote.reminderAt ? (
                  <Pressable style={styles.clearReminderBtn} onPress={clearReminder}>
                    <Text style={styles.clearReminderText}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {showReminderDatePicker ? (
              <DateTimePicker
                value={parseReminder(newNote.reminderAt) ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleReminderDateChange}
              />
            ) : null}

            {showReminderTimePicker ? (
              <DateTimePicker
                value={pendingReminderDate ?? new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleReminderTimeChange}
              />
            ) : null}

            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{editingNoteId ? 'Guardar Cambios' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { paddingHorizontal: 20, gap: 20 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: lifeTheme.colors.text, fontSize: 24, fontWeight: '900' },
  addBtn: { backgroundColor: lifeTheme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  list: { gap: 12 },
  noteCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: lifeTheme.colors.border, padding: 16, gap: 8
  },
  noteHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  noteTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  delIcon: { fontSize: 16, opacity: 0.6 },
  noteContent: { color: lifeTheme.colors.muted, fontSize: 14, lineHeight: 20 },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  noteDate: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '600' },
  reminderBadge: { backgroundColor: 'rgba(124,108,252,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  reminderText: { color: lifeTheme.colors.primary, fontSize: 11, fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { color: lifeTheme.colors.muted, textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: lifeTheme.colors.surface, borderRadius: 24, padding: 24, gap: 16, borderWidth: 1, borderColor: lifeTheme.colors.border },
  modalTitle: { color: lifeTheme.colors.text, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  label: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
  inputTitle: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12, padding: 14, color: lifeTheme.colors.text, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: lifeTheme.colors.border },
  inputContent: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12, padding: 14, color: lifeTheme.colors.text, fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: lifeTheme.colors.border },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderPickerBtn: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    minWidth: 180
  },
  reminderPickerText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '600' },
  reminderPickerTextActive: { color: lifeTheme.colors.text, fontWeight: '700' },
  clearReminderBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearReminderText: { color: lifeTheme.colors.muted, fontSize: 14, fontWeight: '800' },
  inputTime: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: lifeTheme.colors.text, fontSize: 14, width: 80, textAlign: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: lifeTheme.colors.muted, fontWeight: '700' },
  saveBtn: { flex: 2, backgroundColor: lifeTheme.colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' }
  });
}
