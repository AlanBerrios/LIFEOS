import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
import { CustomAlertDialog } from '../../src/components/CustomAlertDialog';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';
import { SafeDatePicker } from '../../src/components/SafeDatePicker';
import { AppColorPickerSheet } from '../../src/components/AppColorPickerSheet';
import { FormSheet } from '../../src/components/FormSheet';
import { AppEmojiPickerSheet } from '../../src/components/AppEmojiPickerSheet';
import { FileText, Plus, Trash2 } from 'lucide-react-native';
import { AppButton, AppIconButton, EmptyState, ScreenHeader } from '../../src/components/ui';

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

const EMOJI_OPTIONS = [
  '📝', '✨', '💡', '📌', '🎯', '🧠', '📚', '💼',
  '🏠', '🛒', '🎵', '📊', '🧪', '🚀', '🔥', '✅'
];

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
  const [newNote, setNewNote] = useState({ title: '', content: '', emoji: '📝', color: '', reminderAt: '' });
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  function handleSave() {
    if (!newNote.title.trim() && !newNote.content.trim()) return;
    
    if (editingNoteId) {
      updateNote(editingNoteId, {
        title: newNote.title.trim() || 'Nota sin título',
        content: newNote.content.trim(),
        emoji: newNote.emoji.trim() || undefined,
        color: newNote.color.trim() || undefined,
        reminderAt: newNote.reminderAt || undefined
      });
    } else {
      addNote({
        title: newNote.title.trim() || 'Nota sin título',
        content: newNote.content.trim(),
        emoji: newNote.emoji.trim() || undefined,
        color: newNote.color.trim() || undefined,
        reminderAt: newNote.reminderAt || undefined
      });
    }
    
    setModalVisible(false);
    setEditingNoteId(null);
    setNewNote({ title: '', content: '', emoji: '📝', color: '', reminderAt: '' });
    setIsEmojiPickerVisible(false);
    setIsColorPickerVisible(false);
  }

  function openEdit(note: any) {
    setEditingNoteId(note.id);
    setNewNote({
      title: note.title,
      content: note.content,
      emoji: note.emoji || '📝',
      color: note.color || '',
      reminderAt: note.reminderAt || ''
    });
    setModalVisible(true);
  }

  function openCreate() {
    setEditingNoteId(null);
    setNewNote({ title: '', content: '', emoji: '📝', color: '', reminderAt: '' });
    setModalVisible(true);
  }

  function clearReminder() {
    setNewNote((prev) => ({ ...prev, reminderAt: '' }));
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 16) + 24
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Capturas"
          title="Notas"
          subtitle={`${notes.length} guardada${notes.length === 1 ? '' : 's'}`}
          action={<AppButton label="Nueva" icon={Plus} compact onPress={openCreate} />}
        />

      <View style={styles.list}>
        {notes.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon={FileText}
              title="Tu bloc está vacío"
              message="Guarda aquí una idea, referencia o recordatorio."
              actionLabel="Crear nota"
              onAction={openCreate}
            />
          </View>
        ) : (
          notes.map((note, idx) => (
            <Animated.View
              key={note.id}
              entering={FadeInDown.delay(idx * 50)}
              layout={Layout.springify()}
            >
              <Pressable
                style={[styles.noteCard, note.color ? { borderColor: note.color } : null]}
                onPress={() => openEdit(note)}
                accessibilityRole="button"
                accessibilityLabel={`Editar nota ${note.title}`}
              >
              <View style={styles.noteHdr}>
                <Text style={styles.noteTitle}>{note.emoji?.trim() || '📝'} {note.title}</Text>
                <AppIconButton
                  icon={Trash2}
                  label={`Eliminar nota ${note.title}`}
                  onPress={() => {
                    showAlert('Eliminar', '¿Borrar esta nota?', [
                      { text: 'No', style: 'cancel' },
                      { text: 'Sí, borrar', style: 'destructive', onPress: () => deleteNote(note.id) }
                    ]);
                  }}
                  size="small"
                  danger
                />
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

      </ScrollView>

      <FormSheet visible={modalVisible} onClose={() => setModalVisible(false)}>
            <Text style={styles.modalTitle}>{editingNoteId ? 'Editar Nota' : 'Nueva Nota'}</Text>
            
            <TextInput
              style={styles.inputTitle}
              value={newNote.title}
              onChangeText={(v) => setNewNote((prev) => ({ ...prev, title: v }))}
              placeholder="Título (opcional)"
              placeholderTextColor={lifeTheme.colors.muted}
            />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Emoji</Text>
                  <Pressable style={styles.selectorInput} onPress={() => setIsEmojiPickerVisible(true)}>
                    <Text style={styles.selectorEmojiValue}>{newNote.emoji || '📝'}</Text>
                    <Text style={styles.selectorHint}>Seleccionar</Text>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Color</Text>
                  <Pressable style={styles.selectorInput} onPress={() => setIsColorPickerVisible(true)}>
                    <View style={styles.colorPreviewRow}>
                      <View style={[styles.colorSwatch, { backgroundColor: newNote.color || lifeTheme.colors.primary }]} />
                      <Text style={styles.selectorColorText}>{(newNote.color || lifeTheme.colors.primary).toUpperCase()}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>

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
              <SafeDatePicker
                label="Recordatorio (día y hora)"
                value={parseReminder(newNote.reminderAt)}
                onClear={clearReminder}
                onConfirm={(d) => setNewNote((prev) => ({ ...prev, reminderAt: d.toISOString() }))}
              />
            </View>

            <View style={styles.modalBtns}>
              <View style={styles.modalAction}>
                <AppButton label="Cancelar" variant="outlined" onPress={() => setModalVisible(false)} fullWidth />
              </View>
              <View style={styles.modalActionWide}>
                <AppButton label={editingNoteId ? 'Guardar cambios' : 'Guardar'} onPress={handleSave} fullWidth />
              </View>
            </View>
      </FormSheet>
      <AppEmojiPickerSheet
        visible={isEmojiPickerVisible}
        value={newNote.emoji}
        options={EMOJI_OPTIONS}
        onClose={() => setIsEmojiPickerVisible(false)}
        onApply={(emoji) => setNewNote((current) => ({ ...current, emoji }))}
      />

      <AppColorPickerSheet
        visible={isColorPickerVisible}
        value={newNote.color || lifeTheme.colors.primary}
        onClose={() => setIsColorPickerVisible(false)}
        onClear={() => setNewNote((prev) => ({ ...prev, color: '' }))}
        onApply={(hex: string) => setNewNote((prev) => ({ ...prev, color: hex }))}
      />

      <CustomAlertDialog
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />

    </View>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  const ui = {
    radiusCard: 16,
    radiusInput: 12,
    radiusBtn: 12,
    border: lifeTheme.colors.border
  };

  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { paddingHorizontal: 16, gap: 16 },
  list: { gap: 12 },
  noteCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: lifeTheme.radius.md,
    borderWidth: 1, borderColor: ui.border, padding: 14, gap: 8
  },
  noteHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  noteTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  noteContent: { color: lifeTheme.colors.muted, fontSize: lifeTheme.typography.bodySm, lineHeight: lifeTheme.typography.lineHeight.bodySm },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  noteDate: { color: lifeTheme.colors.muted, fontSize: lifeTheme.typography.caption, fontWeight: '600' },
  reminderBadge: { backgroundColor: 'rgba(124,108,252,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  reminderText: { color: lifeTheme.colors.primary, fontSize: 11, fontWeight: '700' },
  emptyCard: { borderWidth: 1, borderColor: lifeTheme.colors.border, borderRadius: lifeTheme.radius.md, alignItems: 'center' },
  modalTitle: { color: lifeTheme.colors.text, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  label: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
  selectorInput: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderColor: ui.border,
    borderWidth: 1,
    borderRadius: ui.radiusInput,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectorHint: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '700' },
  selectorEmojiValue: { color: lifeTheme.colors.text, fontSize: 22 },
  colorPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: ui.border
  },
  selectorColorText: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
  inputTitle: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: ui.radiusInput, padding: 14, color: lifeTheme.colors.text, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: ui.border },
  inputContent: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: ui.radiusInput, padding: 14, color: lifeTheme.colors.text, fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: ui.border },
  reminderRow: { gap: 8, alignItems: 'stretch' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 10 },
  modalAction: { flex: 1 },
  modalActionWide: { flex: 2 },
  });
}
