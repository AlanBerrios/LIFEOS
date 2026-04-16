import type { StateCreator } from 'zustand';
import type { AlertButtonConfig } from '../../components/CustomAlertDialog';
import type { LifeStore } from '../lifeStore.types';

export const createGlobalAlertSlice: StateCreator<LifeStore, [], [], Pick<LifeStore, 'showGlobalAlert' | 'dismissGlobalAlert'>> = (set) => ({
  showGlobalAlert: (title: string, message?: string, buttons?: AlertButtonConfig[]) => {
    set({
      global_alert: {
        visible: true,
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }]
      }
    });
  },

  dismissGlobalAlert: () => {
    set((state) => ({
      global_alert: state.global_alert
        ? { ...state.global_alert, visible: false }
        : undefined
    }));
  }
});