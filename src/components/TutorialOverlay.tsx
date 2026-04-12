import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions
} from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInUp, 
  SlideOutDown 
} from 'react-native-reanimated';
import { useAppTheme } from '../theme';

const { width, height } = Dimensions.get('window');

interface TutorialStep {
  title: string;
  description: string;
  target?: string; // Information for future highlighting logic
}

const STEPS: TutorialStep[] = [
  {
    title: '¡Bienvenido a LIFEOS!',
    description: 'Tu nuevo Sistema Operativo Personal. Aquí tienes una guía rápida de cómo funciona todo.'
  },
  {
    title: 'Dashboard: Tu Copiloto',
    description: 'En la parte superior verás tus estadísticas rápidas: tareas planeadas, hábitos de hoy y completados.'
  },
  {
    title: 'Acciones Rápidas',
    description: 'Usa los botones centrales para añadir Notas, Tareas o Eventos al instante. El botón de Almuerzo te ayuda a cronometrar tus comidas.'
  },
  {
    title: 'Timeline Líquido',
    description: 'Tu día se organiza automáticamente. Verás cómo tus tareas se "llenan" visualmente mientras transcurre el tiempo.'
  },
  {
    title: 'Hábitos y Salud',
    description: 'Abajo tienes tus burbujas de hábitos. Toca para marcar progreso y mantén tus rachas vivas 🔥.'
  },
  {
    title: 'Navegación',
    description: 'Usa las pestañas inferiores para ir al Calendario, gestionar el Pool de tareas, revisar tus Notas o ajustar tus Rutinas.'
  }
];

export function TutorialOverlay({ 
  visible, 
  onComplete 
}: { 
  visible: boolean; 
  onComplete: () => void; 
}) {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const [currentStep, setCurrentStep] = useState(0);

  if (!visible) return null;

  const isLast = currentStep === STEPS.length - 1;

  function next() {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        <Animated.View 
          entering={FadeIn} 
          exiting={FadeOut}
          style={styles.backdrop} 
        />
        
        <Animated.View 
          entering={SlideInUp.springify()} 
          exiting={SlideOutDown}
          style={styles.card}
        >
          <View style={styles.content}>
            <Text style={styles.stepIndicator}>Paso {currentStep + 1} de {STEPS.length}</Text>
            <Text style={styles.title}>{STEPS[currentStep].title}</Text>
            <Text style={styles.description}>{STEPS[currentStep].description}</Text>
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.skipBtn} onPress={onComplete}>
              <Text style={styles.skipText}>Saltar</Text>
            </Pressable>
            
            <Pressable style={styles.nextBtn} onPress={next}>
              <Text style={styles.nextText}>{isLast ? '¡Entendido!' : 'Siguiente'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)'
  },
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 28,
    width: '100%',
    padding: 24,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    shadowColor: lifeTheme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8
  },
  content: {
    gap: 12,
    marginBottom: 24
  },
  stepIndicator: {
    color: lifeTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  title: {
    color: lifeTheme.colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  description: {
    color: lifeTheme.colors.muted,
    fontSize: 16,
    lineHeight: 24
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  skipBtn: {
    padding: 12
  },
  skipText: {
    color: lifeTheme.colors.muted,
    fontWeight: '700'
  },
  nextBtn: {
    backgroundColor: lifeTheme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16
  },
  nextText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15
  }
  });
}
