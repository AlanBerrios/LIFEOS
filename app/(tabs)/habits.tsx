import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  Modal,
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
import { lifeTheme } from '../../src/theme';

const EMOJI_OPTIONS = ['💧', '🏃', '🥗', '🧘', '📚', '💊', '🍎', '💤', '🚶', '💪', '🧠', '✨'];

const SUGGESTIONS = [
  { name: 'Meditar', emoji: '🧘', goalValue: 10, goalUnit: 'min', color: '#a78bfa' },
  { name: 'Leer', emoji: '📖', goalValue: 20, goalUnit: 'páginas', color: '#fbbf24' },
  { name: 'Comer sano', emoji: '🥗', goalValue: 3, goalUnit: 'comidas', color: '#34d399' },
  { name: 'Dormir 8h', emoji: '💤', goalValue: 8, goalUnit: 'horas', color: '#60a5fa' },
  { name: 'Sin Cafeína', emoji: '☕', goalValue: 1, goalUnit: 'día', color: '#f87171' }
];

export default function HabitsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const habits = useLifeStore((s) => s.habits);
  const addHabit = useLifeStore((s) => s.addHabit);
  const deleteHabit = useLifeStore((s) => s.deleteHabit);
  const logHabit = useLifeStore((s) => s.logHabit);

  const [modalVisible, setModalVisible] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: '',
    emoji: '✨',
    goalValue: 1,
    goalUnit: 'check'
  });

  function handleCreate() {
    if (!newHabit.name.trim()) return;
    addHabit({
      ...newHabit,
      name: newHabit.name.trim(),
      color: lifeTheme.colors.primary
    });
    setModalVisible(false);
    setNewHabit({ name: '', emoji: '✨', goalValue: 1, goalUnit: 'check' });
  }

  function handleLog(id: string) {
    logHabit(id, 1);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hdr}>
        <Text style={styles.title}>🌟 Mis Hábitos</Text>
        <Pressable style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </Pressable>
      </View>

      <View style={styles.suggestionsSect}>
        <Text style={styles.sectLabel}>Sugerencias rápidas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionList}>
          {SUGGESTIONS.map((s, i) => (
            <Pressable 
              key={i} 
              style={styles.suggestionItem}
              onPress={() => addHabit(s)}
            >
              <Text style={styles.suggestionEmoji}>{s.emoji}</Text>
              <Text style={styles.suggestionName}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.list}>
        {habits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No tienes hábitos configurados.{'\n'}¡Crea uno para empezar tu racha!</Text>
          </View>
        ) : (
          habits.map((habit, idx) => (
            <Animated.View
              key={habit.id}
              entering={FadeInDown.delay(idx * 50)}
              layout={Layout.springify()}
              style={styles.habitCard}
            >
              <View style={styles.habitMain}>
                <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  <Text style={styles.habitGoal}>Meta: {habit.goalValue} {habit.goalUnit}</Text>
                </View>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {habit.streak}</Text>
                </View>
              </View>

              <View style={styles.habitActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.logBtn,
                    pressed && { opacity: 0.7 },
                    habit.lastCompletedDate === new Date().toISOString().slice(0, 10) && styles.logBtnDone
                  ]}
                  onPress={() => handleLog(habit.id)}
                >
                  <Text style={styles.logBtnText}>
                    {habit.lastCompletedDate === new Date().toISOString().slice(0, 10) ? '✅ Hecho' : '💪 Marcar'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.delBtn}
                  onPress={() => {
                    Alert.alert('Eliminar', `¿Borrar hábito "${habit.name}"?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Eliminar', style: 'destructive', onPress: () => deleteHabit(habit.id) }
                    ]);
                  }}
                >
                  <Text style={styles.delBtnText}>🗑</Text>
                </Pressable>
              </View>
            </Animated.View>
          ))
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo Hábito</Text>
            
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={newHabit.name}
              onChangeText={(v) => setNewHabit((prev) => ({ ...prev, name: v }))}
              placeholder="Ej: Meditar, Beber agua..."
              placeholderTextColor={lifeTheme.colors.muted}
            />

            <Text style={styles.label}>Emoji</Text>
            <View style={styles.emojiRow}>
              {EMOJI_OPTIONS.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.emojiBtn, newHabit.emoji === e && styles.emojiBtnActive]}
                  onPress={() => setNewHabit((prev) => ({ ...prev, emoji: e }))}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.goalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Meta</Text>
                <TextInput
                  style={styles.input}
                  value={String(newHabit.goalValue)}
                  onChangeText={(v) => setNewHabit((prev) => ({ ...prev, goalValue: Number(v) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.label}>Unidad</Text>
                <TextInput
                  style={styles.input}
                  value={newHabit.goalUnit}
                  onChangeText={(v) => setNewHabit((prev) => ({ ...prev, goalUnit: v }))}
                  placeholder="litros, km, etc."
                />
              </View>
            </View>

            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleCreate}>
                <Text style={styles.saveBtnText}>Crear Hábito</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { paddingHorizontal: 20, gap: 20 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: lifeTheme.colors.text, fontSize: 24, fontWeight: '900' },
  addBtn: { backgroundColor: lifeTheme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  suggestionsSect: { gap: 8 },
  sectLabel: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginLeft: 4 },
  suggestionList: { gap: 10, paddingRight: 40 },
  suggestionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 14, 
    backgroundColor: lifeTheme.colors.surface, 
    borderWidth: 1, 
    borderColor: lifeTheme.colors.border,
    gap: 8
  },
  suggestionEmoji: { fontSize: 18 },
  suggestionName: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
  list: { gap: 12 },
  habitCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: lifeTheme.colors.border, padding: 16, gap: 14
  },
  habitMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitEmoji: { fontSize: 32 },
  habitName: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800' },
  habitGoal: { color: lifeTheme.colors.muted, fontSize: 12 },
  streakBadge: { backgroundColor: 'rgba(252,108,143,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  streakText: { color: lifeTheme.colors.alert, fontWeight: '900', fontSize: 13 },
  habitActions: { flexDirection: 'row', gap: 10 },
  logBtn: { flex: 1, backgroundColor: lifeTheme.colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  logBtnDone: { backgroundColor: lifeTheme.colors.success },
  logBtnText: { color: '#fff', fontWeight: '800' },
  delBtn: { backgroundColor: lifeTheme.colors.surfaceAlt, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  delBtnText: { fontSize: 16 },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { color: lifeTheme.colors.muted, textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: lifeTheme.colors.surface, borderRadius: 24, padding: 24, gap: 16, borderWidth: 1, borderColor: lifeTheme.colors.border },
  modalTitle: { color: lifeTheme.colors.text, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  label: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  input: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12, padding: 14, color: lifeTheme.colors.text, fontSize: 16, borderWidth: 1, borderColor: lifeTheme.colors.border },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  emojiBtnActive: { borderColor: lifeTheme.colors.primary, backgroundColor: 'rgba(124,108,252,0.1)' },
  goalRow: { flexDirection: 'row', gap: 12 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: lifeTheme.colors.muted, fontWeight: '700' },
  saveBtn: { flex: 2, backgroundColor: lifeTheme.colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' }
});
