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
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View
          style={[
            styles.dialog,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {/* Title */}
          <Text
            style={[
              styles.title,
              { color: theme.colors.text, fontFamily: 'System', fontWeight: '600' },
            ]}
          >
            {title}
          </Text>

          {/* Message */}
          {message && (
            <Text
              style={[
                styles.message,
                { color: theme.colors.muted, fontFamily: 'System' },
              ]}
            >
              {message}
            </Text>
          )}

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => {
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel' || buttons.length > 1 && index > 0;
              
              return (
                <Pressable
                  key={index}
                  style={[
                    styles.button,
                    isCancel && styles.buttonCancel,
                    index < buttons.length - 1 && styles.buttonBorder,
                    {
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: isDestructive
                          ? '#FF5F7A'
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
  },
  dialog: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxWidth: 340,
    width: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 12,
      },
    }),
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginHorizontal: -24,
    marginBottom: -20,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  buttonBorder: {
    borderRightWidth: 1,
  },
  buttonCancel: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
