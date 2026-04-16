import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useAppTheme } from '../theme';

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
      onRequestClose={onDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.68)' }]}>
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              shadowColor: '#000'
            },
          ]}
        >
          <View style={[styles.accentBar, { backgroundColor: theme.colors.primary }]} />
          <Text
            style={[
              styles.title,
              { color: theme.colors.text, fontWeight: '800' },
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
                <Pressable
                  key={index}
                  style={[
                    styles.button,
                    buttons.length > 2 && styles.buttonColumn,
                    isCancel && styles.buttonCancel,
                    buttons.length <= 2 && index < buttons.length - 1 && styles.buttonBorder,
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
                </Pressable>
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
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    maxWidth: 340,
    width: '85%',
    ...Platform.select({
      ios: {
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 14 },
      },
      android: {
        elevation: 18,
      },
    }),
  },
  accentBar: {
    width: 48,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
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
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  buttonBorder: {
    borderRightWidth: 0,
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
