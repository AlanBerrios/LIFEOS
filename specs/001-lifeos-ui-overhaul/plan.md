# Implementation Plan: Rediseño Integral de LIFEOS

**Branch**: `main` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

## Summary

Construir un sistema visual Android coherente sobre la app existente y migrar todas
las rutas, menús, formularios y overlays sin modificar datos ni lógica de negocio.
La implementación empieza por tokens y primitivas, reduce la navegación persistente
a cinco destinos, y después migra cada flujo por frecuencia de uso.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81

**Primary Dependencies**: Expo SDK 54, Expo Router 6, Zustand 5, Reanimated 4,
React Native Gesture Handler, Safe Area Context, Lucide React Native

**Storage**: AsyncStorage con persistencia Zustand local

**Testing**: Vitest, TypeScript compiler, Android emulator/device QA

**Target Platform**: Android, orientación vertical, teléfonos compactos y anchos

**Project Type**: Aplicación móvil Expo/React Native con backend auxiliar

**Performance Goals**: Interacción perceptible bajo 100 ms, animaciones de UI de
150-250 ms, listas y calendario fluidos a 60 fps en un dispositivo Android medio

**Constraints**: Offline-first, sin migración de datos, sin nuevas dependencias,
tema oscuro/claro y acento configurable, safe area e IME obligatorios

**Scale/Scope**: 12 rutas de usuario, 12+ overlays compartidos/locales, tres vistas
de calendario y un sistema de navegación persistente

## Constitution Check

- Android-first: PASS. Material 3, Back, insets y 48 dp son requisitos explícitos.
- Daily flow: PASS. Hoy, Calendario y captura reciben prioridad P1.
- Shared design system: PASS. Tokens y primitivas bloquean la migración por pantalla.
- Purposeful motion: PASS. Solo feedback y cambios de estado, con reduced motion.
- Local-first safety: PASS. No se cambian store, scheduler ni persistencia.
- Evidence: PASS. Typecheck, tests y QA Android forman parte de la salida.

## Project Structure

### Documentation

```text
specs/001-lifeos-ui-overhaul/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- ui-contract.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code

```text
app/
|-- _layout.tsx
|-- (tabs)/
|   |-- _layout.tsx
|   |-- index.tsx
|   |-- calendar.tsx
|   |-- pool.tsx
|   |-- habits.tsx
|   |-- more.tsx
|   |-- routines.tsx
|   |-- notes.tsx
|   |-- stats.tsx
|   `-- settings.tsx
|-- achievements.tsx
|-- advanced-metrics.tsx
|-- alarms.tsx
`-- analytics.tsx

src/
|-- components/
|   |-- ui/                 # nuevos primitivos compartidos
|   |-- FormSheet.tsx
|   `-- *Prompt.tsx
|-- theme.ts
|-- store/                  # sin cambios de formato por este feature
`-- core/                   # sin cambios de scheduler por este feature
```

**Structure Decision**: Mantener Expo Router y la organización actual. Añadir un
paquete local `src/components/ui` y una ruta `more.tsx`; no mover rutas grandes
durante el rediseño para reducir riesgo de regresión.

## Complexity Tracking

No hay violaciones constitucionales previstas. La nueva ruta Más reduce complejidad
de navegación sin duplicar lógica ni introducir otro framework.
