# LIFEOS

App Android local-first para organizar el dia, ejecutar tareas y replanificar con contexto.

LIFEOS no es una lista de tareas ni una web. Es una app Android construida con Expo/React Native donde el timeline diario, la task pool, las rutinas, los eventos, las notificaciones y las metricas trabajan como un solo sistema.

## Documentacion canonica

La documentacion raiz queda reducida a tres archivos:

- `LIFEOS_VISION_Y_CONTEXTO.txt`
- `DOCUMENTACION_COMPLETA.txt`
- `PROXIMOS_PASOS_UNIFICADOS.txt`

Si en el futuro aparece documentacion historica o auxiliar, estos tres archivos prevalecen.

## Rol del backend

- Runtime principal: scheduler local TypeScript dentro de la app.
- Backend Python: soporte de paridad, validacion y benchmark.
- La app debe funcionar como local-first y no depender del backend para organizar el dia.

## Stack

- Expo SDK 54
- React Native
- TypeScript
- Zustand persistente
- Expo Router
- Expo Notifications
- React Native Reanimated

## Navegacion actual

La barra inferior mantiene cinco destinos de uso frecuente: Hoy, Calendario, Tareas, Habitos y Mas. Las rutinas, notas, metricas, logros, recordatorios y ajustes viven en Mas y siguen estando a un maximo de dos toques.

## Comandos

```bash
npm install
npm run typecheck
npm test
npm run android:release:fast
```

Build release esperado:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## Estado reciente

Version actual: `4.2.0` (`versionCode` Android 7).

Validacion reciente:

- `npm run typecheck`: OK.
- `npm test`: OK, 4 archivos, 51 tests.
- `expo export --platform android --clear`: OK, bundle Hermes generado.

Foco actual:

- Confiabilidad Android.
- Scheduler/timeline coherente.
- Rutinas y formularios sin problemas de teclado.
- Recordatorios accionables y definicion futura de alarmas nativas reales.
- Metricas y logros mas utiles.
