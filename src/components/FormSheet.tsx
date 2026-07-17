import type { ReactNode } from 'react';
import type { ReactElement } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';

type FormSheetProps = {
  visible: boolean;
  children: ReactNode;
  onClose: () => void;
  animationType?: 'none' | 'slide' | 'fade';
  align?: 'center' | 'bottom';
  maxHeight?: number | `${number}%`;
};

export function FormSheet({
  visible,
  children,
  onClose,
  animationType = 'slide',
  align = 'bottom',
  maxHeight = '92%'
}: FormSheetProps): ReactElement {
  const insets = useSafeAreaInsets();
  const lifeTheme = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardWrap}
      >
        <Pressable
          style={[
            styles.overlay,
            align === 'center' && styles.overlayCenter,
            { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) + 8 }
          ]}
          onPress={onClose}
        >
          <Pressable
            style={[
              styles.card,
              align === 'center' && styles.cardCenter,
              {
                maxHeight,
                backgroundColor: lifeTheme.colors.surface,
                borderColor: lifeTheme.colors.border
              }
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ gap: 14, paddingBottom: Math.max(insets.bottom, 12) }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16
  },
  overlayCenter: {
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  card: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16
  },
  cardCenter: {
    borderRadius: 20
  },
  scroll: {
    maxHeight: '100%'
  }
});
