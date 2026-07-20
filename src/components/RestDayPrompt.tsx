import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import type { ReactElement } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react-native';
import { AppButton } from './ui';

interface RestDayPromptProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestDayPrompt({
  visible,
  onConfirm,
  onCancel
}: RestDayPromptProps): ReactElement {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Icono de confirmación */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <AlertTriangle size={48} color={theme.colors.primary} strokeWidth={1.5} />
              </View>
            </View>

            {/* Título */}
            <Text style={styles.title}>Confirmar día de descanso</Text>

            {/* Descripción */}
            <Text style={styles.description}>
              Declararás hoy como día de descanso. El scheduler no insistirá en tareas de productividad, 
              pero podrás añadir actividades manualmente si lo deseas.
            </Text>

            {/* Beneficios */}
            <View style={styles.benefitsContainer}>
              <Text style={styles.benefitsLabel}>¿Qué sucede?</Text>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitBullet}>✓</Text>
                <Text style={styles.benefitText}>Sin recordatorios de productividad</Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitBullet}>✓</Text>
                <Text style={styles.benefitText}>Plan del día vacío por defecto</Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitBullet}>✓</Text>
                <Text style={styles.benefitText}>Puedes añadir actividades manualmente</Text>
              </View>
            </View>

            {/* Acciones */}
            <View style={styles.actionsContainer}>
              <AppButton label="Confirmar descanso" icon={CheckCircle} onPress={onConfirm} fullWidth />
              <AppButton label="Cancelar" variant="outlined" onPress={onCancel} fullWidth />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center'
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
      justifyContent: 'flex-start'
    },
    scrollContent: {
      paddingVertical: 32,
      alignItems: 'center'
    },
    iconContainer: {
      marginBottom: 24,
      alignItems: 'center'
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${theme.colors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center'
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
      letterSpacing: 0,
      textAlign: 'center'
    },
    description: {
      fontSize: 14,
      color: theme.colors.muted,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 8
    },
    benefitsContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 28,
      width: '100%',
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    benefitsLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
      gap: 8
    },
    benefitBullet: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      marginTop: -2
    },
    benefitText: {
      fontSize: 13,
      color: theme.colors.text,
      flex: 1
    },
    actionsContainer: {
      width: '100%',
      gap: 12
    },
  });
