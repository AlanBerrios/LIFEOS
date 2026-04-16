import * as Location from 'expo-location';
import { useLifeStore } from '../store/useLifeStore';

// Helper to calculate distance in meters between two coordinates
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in m
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export async function requestLocationPermissions() {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    useLifeStore.getState().showGlobalAlert('Permiso denegado', 'Necesitamos tu ubicación para estimar tiempos de viaje.');
    return false;
  }
  return true;
}

export async function getCurrentLocation() {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return null;
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return loc.coords;
}

export async function checkGeofenceState() {
  const state = useLifeStore.getState();
  if (!state.settings.enableGeofencing) return;
  const { homeLocation, workLocation } = state.settings;
  if (!homeLocation && !workLocation) return;

  const currentLoc = await getCurrentLocation();
  if (!currentLoc) return;

  const logs = state.travelLogs;
  const lastState = logs.length > 0 ? logs[logs.length - 1].type : null;
  
  const HOME_RADIUS = 200; // meters
  const UNI_RADIUS = 200;

  // Check distances
  const distHome = homeLocation ? getDistanceFromLatLonInM(currentLoc.latitude, currentLoc.longitude, homeLocation.latitude, homeLocation.longitude) : Infinity;
  const distUni = workLocation ? getDistanceFromLatLonInM(currentLoc.latitude, currentLoc.longitude, workLocation.latitude, workLocation.longitude) : Infinity;

  const isAtHome = distHome <= HOME_RADIUS;
  const isAtUni = distUni <= UNI_RADIUS;

  // State Machine Transitions
  if (isAtHome && lastState !== 'arrive_home' && lastState !== 'leave_uni') {
    // If we just got home
    state.addTravelLog('arrive_home');
  } else if (!isAtHome && !isAtUni && lastState === 'arrive_home') {
    // Left home
    state.addTravelLog('leave_home');
  } else if (isAtUni && lastState !== 'arrive_uni') {
    // Arrived at uni
    state.addTravelLog('arrive_uni');
  } else if (!isAtUni && !isAtHome && lastState === 'arrive_uni') {
    // Left uni
    state.addTravelLog('leave_uni');
  }
}
