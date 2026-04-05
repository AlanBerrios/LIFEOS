// ==== ENTORNO LOCAL (En tu PC) ====
const BACKEND_IP = '192.168.100.5';
const BACKEND_PORT = 8000;
const LOCAL_BACKEND_URL = `http://${BACKEND_IP}:${BACKEND_PORT}`;

// ==== ENTORNO PRODUCCIÓN (Render) ====
// Cuando tu backend esté vivo en Render, copia la URL que te da (ej: https://lifeos-backend-xxx.onrender.com)
// OJO: no dejar el / al final de la url
const PROD_BACKEND_URL = 'https://lifeos-backend-e8bq.onrender.com';

/** Cambia esto a PROD_BACKEND_URL cuando subas la app a Render */
export const BACKEND_URL = PROD_BACKEND_URL;

/** Timeout para las llamadas al backend (ms) */
export const API_TIMEOUT_MS = 6_000;
