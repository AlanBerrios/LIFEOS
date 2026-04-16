import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import { useLifeStore } from '../store/useLifeStore';

WebBrowser.maybeCompleteAuthSession();

// You need to replace this with your actual Web Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com';

export function useGoogleCalendarAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: makeRedirectUri({
      scheme: 'lifeos' // Make sure this matches your app scheme
    }),
    scopes: ['https://www.googleapis.com/auth/calendar.events']
  });

  const handleLogin = async () => {
    if (GOOGLE_CLIENT_ID === 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com') {
      useLifeStore.getState().showGlobalAlert(
        'Falta Configuración',
        'Necesitas configurar tu Google Client ID en src/services/gcal.ts antes de iniciar sesión. Lee el Walkthrough para más detalles.'
      );
      return;
    }
    await promptAsync();
  };

  const saveToken = async (token: string) => {
    await AsyncStorage.setItem('@gcal_token', token);
  };

  const getToken = async () => {
    return await AsyncStorage.getItem('@gcal_token');
  };

  return { request, response, promptAsync: handleLogin, saveToken, getToken };
}

// Stub function to show how you would sync events later
export async function syncTimelineToCalendar(timeline: any[], dateString: string) {
  const token = await AsyncStorage.getItem('@gcal_token');
  if (!token) {
    useLifeStore.getState().showGlobalAlert('Error', 'No has iniciado sesión en Google Calendar.');
    return;
  }
  
  // Real implementation will map timeline blocks into Google Calendar Event API POST requests
  useLifeStore.getState().showGlobalAlert('Éxito', 'La infraestructura de exportación a Google Calendar está lista. (Simulado)');
}
