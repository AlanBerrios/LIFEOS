import type { ReactElement } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { lifeTheme } from '../theme';
import type { ScheduleBlock } from '../types';

interface ReplanificationPromptProps {
  visible: boolean;
  previousBlocks: ScheduleBlock[];
  nextBlocks: ScheduleBlock[];
  onConfirm: () => void;
  onReject: () => void;
}

function minutesDiff(previous: ScheduleBlock[], next: ScheduleBlock[]): number {
  const prev = previous.reduce((sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()), 0);
  const after = next.reduce((sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()), 0);
  return Math.round((after - prev) / 60_000);
}

export function ReplanificationPrompt({
  visible,
  previousBlocks,
  nextBlocks,
  onConfirm,
  onReject
}: ReplanificationPromptProps): ReactElement {
  const diffMinutes = minutesDiff(previousBlocks, nextBlocks);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onReject}>
      <Pressable style={styles.overlay} onPress={onReject}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Plan actualizado</Text>
          <Text style={styles.subtitle}>
            Se detecto un desvio y se preparo una replanificacion para el resto del dia.
          </Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiChip}>
              <Text style={styles.kpiLabel}>Bloques nuevos</Text>
              <Text style={styles.kpiValue}>{nextBlocks.length}</Text>
            </View>
            <View style={styles.kpiChip}>
              <Text style={styles.kpiLabel}>Cambio total</Text>
              <Text style={styles.kpiValue}>{diffMinutes >= 0 ? `+${diffMinutes}` : diffMinutes} min</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Nuevo orden sugerido</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {nextBlocks.map((block, index) => (
              <View key={`${block.id}-${index}`} style={styles.row}>
                <Text style={styles.time}>
                  {block.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{block.title}</Text>
                  <Text style={styles.rowMeta}>{block.type.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.rejectBtn} onPress={onReject}>
              <Text style={styles.rejectText}>Mantener plan actual</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmText}>Aceptar nuevo plan</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    maxHeight: '80%',
    backgroundColor: lifeTheme.colors.surface,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    borderRadius: lifeTheme.radius.md,
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
    lineHeight: 18
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8
  },
  kpiChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    borderRadius: 12,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  kpiLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 11,
    fontWeight: '700'
  },
  kpiValue: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  sectionLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  list: {
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    borderRadius: 12,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    minHeight: 140,
    maxHeight: 260
  },
  listContent: {
    padding: 10,
    gap: 8
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  time: {
    color: lifeTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    width: 48
  },
  rowBody: {
    flex: 1,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    borderRadius: 10,
    backgroundColor: lifeTheme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  rowTitle: {
    color: lifeTheme.colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  rowMeta: {
    color: lifeTheme.colors.muted,
    fontSize: 10,
    fontWeight: '700'
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  rejectBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    borderRadius: 12,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    paddingVertical: 12
  },
  rejectText: {
    color: lifeTheme.colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: lifeTheme.colors.primary,
    paddingVertical: 12
  },
  confirmText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800'
  }
});
