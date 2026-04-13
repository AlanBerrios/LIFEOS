import { useCallback, useState } from 'react';
import { AlertButtonConfig } from '../components/CustomAlertDialog';

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButtonConfig[];
}

export const useCustomAlert = () => {
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: '',
    message: undefined,
    buttons: [],
  });

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: AlertButtonConfig[]
    ) => {
      setState({
        visible: true,
        title,
        message,
        buttons: buttons || [{ text: 'OK', style: 'default' }],
      });
    },
    []
  );

  const hideAlert = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    alertState: state,
    showAlert,
    hideAlert,
  };
};
