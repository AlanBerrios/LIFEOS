import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useAppTheme } from '../theme';
import { AnimatedPressable } from './ui/AnimatedPressable';

export interface AlertButtonConfig {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButtonConfig[];
  onDismiss?: () => void;
}

export const CustomAlertDialog: React.FC<CustomAlertDialogProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  onDismiss,
}) => {
  const theme = useAppTheme();

  const handleButtonPress = (button: AlertButtonConfig) => {
    button.onPress?.();
    onDismiss?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: theme.colors.scrim }]}>
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            },
          ]}
        >
          <Text
            style={[
              styles.title,
                { color: theme.colors.text },
            ]}
          >
            {title}
          </Text>

          {message && (
            <Text
              style={[
                styles.message,
                { color: theme.colors.muted },
              ]}
            >
              {message}
            </Text>
          )}

          <View style={[styles.buttonsContainer, buttons.length > 2 && styles.buttonsColumn]}>
            {buttons.map((button, index) => {
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel' || buttons.length > 1 && index > 0;

              return (
                <AnimatedPressable
                  key={index}
                  style={[
                    styles.button,
                    buttons.length > 2 && styles.buttonColumn,
                    isCancel && styles.buttonCancel,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: isDestructive
                        ? theme.colors.softAlert
                        : isCancel
                        ? theme.colors.surfaceAlt
                        : theme.colors.primary,
                    },
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: isDestructive
                          ? theme.colors.alert
                          : isCancel
                          ? theme.colors.muted
                          : theme.colors.onPrimary,
                      },
                    ]}
                  >
                    {button.text}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dialog: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxWidth: 360,
    width: '100%',
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'left',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    textAlign: 'left',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 6,
  },
  buttonsColumn: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: 12,
  },
  buttonColumn: {
    width: '100%',
    flex: undefined,
  },
  buttonCancel: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
