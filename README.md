# LifeOS

LifeOS es una app móvil local-first construida con React Native, Expo Router, Zustand y AsyncStorage. El sistema separa el **Task Pool** del **Timeline** y genera automáticamente el día a partir de un kernel determinístico.

## Stack

- Expo + React Native
- TypeScript estricto
- Expo Router
- Zustand
- AsyncStorage
- Expo Notifications

## Estructura

- `app/` rutas de Expo Router
- `src/core/` kernel de scheduling
- `src/store/` estado global persistente
- `src/components/` UI reutilizable
- `src/types/` contratos de datos

## Ejecutar

1. Instala dependencias con `npm install`.
2. Inicia la app con `npm run start`.
3. Usa `npm run typecheck` para validar tipos.

## Nota

El proyecto está preparado para seguir creciendo sin backend. Si luego quieres, se pueden añadir geofencing, energía del usuario, sincronización cloud o un scheduler más avanzado.
