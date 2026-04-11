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
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTodayStr } from '../../src/utils/date';
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
  const updateHabit = useLifeStore((s) => s.updateHabit);
  const logHabit = useLifeStore((s) => s.logHabit);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  
  const [newHabit, setNewHabit] = useState({
    name: '',
    emoji: '✨',
    goalValue: 1,
    goalUnit: 'check'
  });

  function handleSave() {
    if (!newHabit.name.trim()) return;
    
    if (editingHabitId) {
      updateHabit(editingHabitId, {
        ...newHabit,
        name: newHabit.name.trim()
      });
      setEditingHabitId(null);
    } else {
      addHabit({
        ...newHabit,
        name: newHabit.name.trim(),
        color: lifeTheme.colors.primary
      });
    }
    
    setModalVisible(false);
    setNewHabit({ name: '', emoji: '✨', goalValue: 1, goalUnit: 'check' });
  }

  function handleEdit(habit: any) {
    setEditingHabitId(habit.id);
    setNewHabit({
      name: habit.name,
      emoji: habit.emoji,
      goalValue: habit.goalValue,
      goalUnit: habit.goalUnit
    });
    setModalVisible(true);
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
        <Pressable style={styles.addBtn} onPress={() => { setEditingHabitId(null); setModalVisible(true); }}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </Pressable>
      </View>

      {/* Visualizador de Rachas (Gráfico de Barras Lateral) */}
      {habits.length > 0 && (() => {
        const maxStreak = Math.max(...habits.map(h => h.streak), 7);
        return (
          <View style={styles.streakPanel}>
            <Text style={styles.sectLabel}>Rachas Actuales</Text>
            <View style={styles.streakChart}>
              {habits.map(h => (
                <View key={h.id} style={styles.streakRow}>
                  <Text style={styles.streakRowEmoji}>{h.emoji}</Text>
                  <View style={styles.streakBarTrack}>
                    <View 
                      style={[
                        styles.streakBarFill, 
                        { 
                          width: `${(h.streak / maxStreak) * 100}%`,
                          backgroundColor: h.streak > 0 ? lifeTheme.colors.alert : lifeTheme.colors.border
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.streakRowVal}>🔥 {h.streak}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

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
                    habit.lastCompletedDate === getTodayStr() && styles.logBtnDone
                  ]}
                  onPress={() => handleLog(habit.id)}
                >
                  <Text style={styles.logBtnText}>
                    {habit.lastCompletedDate === getTodayStr() ? '✅ Hecho' : '💪 Marcar'}
                  </Text>
                </Pressable>
                
                <Pressable
                   style={styles.editBtn}
                   onPress={() => handleEdit(habit)}
                >
                   <Text style={styles.delBtnText}>✏️</Text>
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
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{editingHabitId ? 'Editar Hábito' : 'Nuevo Hábito'}</Text>

                <View style={styles.modalSuggestions}>
                  <Text style={styles.label}>Sugerencias rápidas</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionList}>
                    {SUGGESTIONS.map((s, i) => (
                      <Pressable 
                        key={i} 
                        style={styles.suggestionItemSmall}
                        onPress={() => setNewHabit({ 
                          name: s.name, 
                          emoji: s.emoji, 
                          goalValue: s.goalValue, 
                          goalUnit: s.goalUnit 
                        })}
                      >
                        <Text style={styles.suggestionEmojiSmall}>{s.emoji}</Text>
                        <Text style={styles.suggestionNameSmall}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                
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
                  <Pressable style={styles.cancelBtn} onPress={() => { setModalVisible(false); setEditingHabitId(null); }}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={handleSave}>
                    <Text style={styles.saveBtnText}>{editingHabitId ? 'Guardar' : 'Crear'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  modalSuggestions: { gap: 8, marginBottom: 8 },
  sectLabel: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginLeft: 4 },
  suggestionList: { gap: 10, paddingRight: 40 },
  suggestionItemSmall: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    borderRadius: 12, 
    backgroundColor: lifeTheme.colors.surfaceAlt, 
    borderWidth: 1, 
    borderColor: lifeTheme.colors.border,
    gap: 6
  },
  suggestionEmojiSmall: { fontSize: 14 },
  suggestionNameSmall: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '700' },
  streakPanel: { 
    backgroundColor: lifeTheme.colors.surface, 
    borderRadius: 20, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: lifeTheme.colors.border,
    marginBottom: 10,
    gap: 12
  },
  streakChart: { gap: 8 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakRowEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
  streakBarTrack: { flex: 1, height: 8, backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  streakBarFill: { height: '100%', borderRadius: 4 },
  streakRowVal: { color: lifeTheme.colors.text, fontWeight: '900', fontSize: 12, width: 34, textAlign: 'right' },
  list: { gap: 10 },
  habitCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: lifeTheme.colors.border, padding: 12, gap: 12
  },
  habitMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  habitEmoji: { fontSize: 24 },
  habitName: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '800' },
  habitGoal: { color: lifeTheme.colors.muted, fontSize: 12 },
  streakBadge: { backgroundColor: 'rgba(252,108,143,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  streakText: { color: lifeTheme.colors.alert, fontWeight: '900', fontSize: 12 },
  habitActions: { flexDirection: 'row', gap: 8 },
  logBtn: { flex: 1, backgroundColor: lifeTheme.colors.primary, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  logBtnDone: { backgroundColor: lifeTheme.colors.success },
  logBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  editBtn: { backgroundColor: lifeTheme.colors.surfaceAlt, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  delBtn: { backgroundColor: lifeTheme.colors.surfaceAlt, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  delBtnText: { fontSize: 14 },
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
