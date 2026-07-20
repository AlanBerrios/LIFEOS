import type { ReactNode } from 'react';
import type { ReactElement } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
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
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardWrap}
      >
        <Pressable
          style={[
            styles.overlay,
            align === 'center' && styles.overlayCenter,
            {
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
              backgroundColor: lifeTheme.colors.scrim
            }
          ]}
          onPress={onClose}
        >
          <Pressable
            style={[
              styles.card,
              {
                maxHeight,
                backgroundColor: lifeTheme.colors.surface,
                borderColor: lifeTheme.colors.border,
                borderTopLeftRadius: lifeTheme.radius.lg,
                borderTopRightRadius: lifeTheme.radius.lg,
                ...(align === 'center' ? { borderRadius: lifeTheme.radius.lg } : {})
              }
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            {align === 'bottom' ? (
              <View style={[styles.grabber, { backgroundColor: lifeTheme.colors.outlineStrong }]} />
            ) : null}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{
                gap: lifeTheme.spacing.sm,
                paddingBottom: Math.max(insets.bottom, lifeTheme.spacing.sm)
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
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
    paddingHorizontal: 12
  },
  overlayCenter: {
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  card: {
    width: '100%',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  scroll: {
    maxHeight: '100%'
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 10
  }
});
