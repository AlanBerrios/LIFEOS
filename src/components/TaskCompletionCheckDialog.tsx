import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PostponeReason, SkipReason, Task } from '../types';
import { lifeTheme } from '../theme';

type CompletionChoice = 'ok' | 'partial' | 'skipped' | 'postponed';

interface TaskCompletionCheckDialogProps {
  visible: boolean;
  task: Task | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirmOK: (taskId: string) => Promise<void> | void;
  onConfirmPartial: (taskId: string, notes: string) => Promise<void> | void;
  onReportSkipped: (taskId: string, reason: SkipReason, details: string) => Promise<void> | void;
  onReportPostponed: (
    taskId: string,
    reason: PostponeReason,
    details: string,
    postponedUntil: Date
  ) => Promise<void> | void;
}

const SKIP_REASON_OPTIONS: { value: SkipReason; label: string }[] = [
  { value: 'distraction', label: 'Me distraje' },
  { value: 'urgent_task', label: 'Salio algo urgente' },
  { value: 'low_energy', label: 'Baja energia' },
  { value: 'blocker', label: 'Tengo un bloqueador' },
  { value: 'system_issue', label: 'Problema tecnico' },
  { value: 'other', label: 'Otro' }
];

const POSTPONE_REASON_OPTIONS: { value: PostponeReason; label: string }[] = [
  { value: 'need_more_time', label: 'Necesito mas tiempo' },
  { value: 'blocked', label: 'Estoy bloqueado' },
  { value: 'deprioritized', label: 'Bajo prioridad por ahora' },
  { value: 'other', label: 'Otro' }
];

export function TaskCompletionCheckDialog({
  visible,
  task,
  isSubmitting = false,
  onClose,
  onConfirmOK,
  onConfirmPartial,
  onReportSkipped,
  onReportPostponed
}: TaskCompletionCheckDialogProps): ReactElement {
  const [choice, setChoice] = useState<CompletionChoice>('ok');
  const [details, setDetails] = useState('');
  const [partialNotes, setPartialNotes] = useState('');
  const [skipReason, setSkipReason] = useState<SkipReason>('distraction');
  const [postponeReason, setPostponeReason] = useState<PostponeReason>('need_more_time');
  const [postponeHours, setPostponeHours] = useState('2');

  const canSubmit = useMemo(() => {
    if (!task || isSubmitting) return false;
    if (choice === 'partial') return partialNotes.trim().length > 0;
    return true;
  }, [choice, isSubmitting, partialNotes, task]);

  async function handleSubmit(): Promise<void> {
    if (!task || !canSubmit) return;

    if (choice === 'ok') {
      await onConfirmOK(task.id);
      return;
    }

    if (choice === 'partial') {
      await onConfirmPartial(task.id, partialNotes.trim());
      return;
    }

    if (choice === 'skipped') {
      await onReportSkipped(task.id, skipReason, details.trim());
      return;
    }

    const delayHours = Number.parseInt(postponeHours, 10);
    const safeDelay = Number.isFinite(delayHours) && delayHours > 0 ? delayHours : 2;
    const postponedUntil = new Date(Date.now() + safeDelay * 60 * 60 * 1000);
    await onReportPostponed(task.id, postponeReason, details.trim(), postponedUntil);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Cierre de bloque</Text>
          <Text style={styles.subtitle}>
            {task ? `"${task.title}"` : 'Tarea actual'}
          </Text>

          <Text style={styles.label}>Resultado</Text>
          <View style={styles.choiceRow}>
            <ChoiceChip active={choice === 'ok'} label="Completa" onPress={() => setChoice('ok')} />
            <ChoiceChip active={choice === 'partial'} label="Parcial" onPress={() => setChoice('partial')} />
            <ChoiceChip active={choice === 'skipped'} label="Saltada" onPress={() => setChoice('skipped')} />
            <ChoiceChip active={choice === 'postponed'} label="Pospuesta" onPress={() => setChoice('postponed')} />
          </View>

          {choice === 'partial' ? (
            <View style={styles.section}>
              <Text style={styles.label}>Que se avanzo?</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={partialNotes}
                onChangeText={setPartialNotes}
                placeholder="Describe brevemente lo que alcanzaste"
                placeholderTextColor={lifeTheme.colors.muted}
                multiline
              />
            </View>
          ) : null}

          {choice === 'skipped' ? (
            <View style={styles.section}>
              <Text style={styles.label}>Motivo</Text>
              <View style={styles.reasonGrid}>
                {SKIP_REASON_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    active={skipReason === option.value}
                    label={option.label}
                    onPress={() => setSkipReason(option.value)}
                    compact
                  />
                ))}
              </View>
            </View>
          ) : null}

          {choice === 'postponed' ? (
            <View style={styles.section}>
              <Text style={styles.label}>Motivo y reintento</Text>
              <View style={styles.reasonGrid}>
                {POSTPONE_REASON_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    active={postponeReason === option.value}
                    label={option.label}
                    onPress={() => setPostponeReason(option.value)}
                    compact
                  />
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={postponeHours}
                onChangeText={setPostponeHours}
                keyboardType="number-pad"
                placeholder="Reintentar en X horas"
                placeholderTextColor={lifeTheme.colors.muted}
              />
            </View>
          ) : null}

          {choice === 'skipped' || choice === 'postponed' ? (
            <View style={styles.section}>
              <Text style={styles.label}>Detalles (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={details}
                onChangeText={setDetails}
                placeholder="Agrega contexto si ayuda a replanificar"
                placeholderTextColor={lifeTheme.colors.muted}
                multiline
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
              disabled={!canSubmit}
              onPress={() => void handleSubmit()}
            >
              <Text style={styles.confirmText}>{isSubmitting ? 'Guardando...' : 'Confirmar'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChoiceChip({
  active,
  label,
  onPress,
  compact = false
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  compact?: boolean;
}): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, compact && styles.chipCompact, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: lifeTheme.spacing.md
  },
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.md,
    gap: lifeTheme.spacing.sm
  },
  title: {
    color: lifeTheme.colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  subtitle: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    marginTop: -2
  },
  section: {
    gap: 8
  },
  label: {
    color: lifeTheme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderColor: lifeTheme.colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  chipActive: {
    borderColor: lifeTheme.colors.primary,
    backgroundColor: lifeTheme.colors.softPrimary
  },
  chipText: {
    color: lifeTheme.colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  chipTextActive: {
    color: lifeTheme.colors.text
  },
  input: {
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 12,
    color: lifeTheme.colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textArea: {
    minHeight: 68,
    textAlignVertical: 'top'
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12
  },
  cancelText: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12
  },
  confirmBtnDisabled: {
    opacity: 0.5
  },
  confirmText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800'
  }
});
