import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SmilePlus } from 'lucide-react-native';
import { useAppTheme } from '../theme';
import { FormSheet } from './FormSheet';
import { AppButton } from './ui';

type AppEmojiPickerSheetProps = {
  visible: boolean;
  value: string;
  options: string[];
  onApply: (emoji: string) => void;
  onClose: () => void;
};

export function AppEmojiPickerSheet({
  visible,
  value,
  options,
  onApply,
  onClose
}: AppEmojiPickerSheetProps): ReactElement {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) setDraft('');
  }, [visible]);

  function apply(emoji: string): void {
    const next = emoji.trim();
    if (!next) return;
    onApply(next);
    onClose();
  }

  return (
    <FormSheet visible={visible} onClose={onClose} align="center" animationType="fade">
      <View style={styles.content}>
        <View style={styles.header}>
          <SmilePlus size={22} color={theme.colors.primary} />
          <Text style={styles.title}>Selecciona un emoji</Text>
        </View>

        <View style={styles.customRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribe o pega un emoji"
            placeholderTextColor={theme.colors.muted}
            returnKeyType="done"
            onSubmitEditing={() => apply(draft)}
          />
          <AppButton label="Usar" compact onPress={() => apply(draft)} disabled={!draft.trim()} />
        </View>

        <View style={styles.grid}>
          {options.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${emoji}`}
              style={[styles.option, value === emoji && styles.optionSelected]}
              onPress={() => apply(emoji)}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </FormSheet>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    content: { gap: 14 },
    header: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { color: theme.colors.text, fontSize: theme.typography.titleSm, fontWeight: '800' },
    customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      color: theme.colors.text,
      paddingHorizontal: 12,
      fontSize: theme.typography.bodySm
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt
    },
    optionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softPrimary },
    emoji: { fontSize: 22 }
  });
}
