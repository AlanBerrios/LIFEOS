# Tasks: Rediseño Integral de LIFEOS

**Input**: Documentos en `specs/001-lifeos-ui-overhaul/`

## Phase 1: Setup

- [x] T001 Documentar constitución, especificación, investigación, contrato UI y plan en `.specify/` y `specs/001-lifeos-ui-overhaul/`
- [x] T002 Registrar inventario de rutas y overlays en `specs/001-lifeos-ui-overhaul/contracts/ui-contract.md`

## Phase 2: Foundational

- [x] T003 Rediseñar tokens semánticos, tipografía, forma, elevación y movimiento en `src/theme.ts`
- [x] T004 Crear primitivas de botón, icon button, badge, header, section y empty state en `src/components/ui/`
- [x] T005 Crear feedback press/reduced-motion reutilizable en `src/components/ui/AnimatedPressable.tsx`
- [x] T006 Unificar hojas y diálogos Android-safe en `src/components/FormSheet.tsx` y `src/components/CustomAlertDialog.tsx`
- [x] T007 Rediseñar navegación a cinco destinos en `app/(tabs)/_layout.tsx` y `app/(tabs)/more.tsx`

## Phase 3: User Story 1 - Navegación diaria (P1)

**Independent Test**: Todos los destinos se alcanzan en dos toques y Back funciona.

- [x] T008 [US1] Aplicar shell y cabecera compartida a `app/(tabs)/index.tsx`
- [x] T009 [US1] Aplicar shell y controles de vista a `app/(tabs)/calendar.tsx`
- [x] T010 [US1] Aplicar shell y cabecera compartida a `app/(tabs)/pool.tsx`
- [x] T011 [US1] Aplicar shell y cabecera compartida a `app/(tabs)/habits.tsx`
- [x] T012 [US1] Completar centro Más y estados de navegación en `app/(tabs)/more.tsx`

## Phase 4: User Story 2 - Plan y calendario (P1)

**Independent Test**: Hoy y Mes/Semana/Día son legibles en Android compacto.

- [x] T013 [US2] Rediseñar resumen, energía, acciones y hábitos de hoy en `app/(tabs)/index.tsx`
- [x] T014 [US2] Rediseñar tarjetas y estados del timeline en `app/(tabs)/index.tsx`
- [x] T015 [US2] Rediseñar selector temporal y navegación del calendario en `app/(tabs)/calendar.tsx`
- [x] T016 [US2] Rediseñar vista Mes y panel de día en `app/(tabs)/calendar.tsx`
- [x] T017 [US2] Rediseñar vista Semana, zoom y bloques en `app/(tabs)/calendar.tsx`
- [x] T018 [US2] Rediseñar vista Día, leyenda y bloques en `app/(tabs)/calendar.tsx`
- [x] T019 [US2] Rediseñar formularios/detalles de calendario en `app/(tabs)/calendar.tsx`

## Phase 5: User Story 3 - Captura y ejecución (P1)

**Independent Test**: Captura y edición funcionan con teclado y acciones explícitas.

- [x] T020 [US3] Rediseñar lista, filtros, tarjeta swipe y formulario en `app/(tabs)/pool.tsx` y `src/components/SwipeableTaskCard.tsx`
- [x] T021 [US3] Rediseñar progreso, stepper hold y formulario en `app/(tabs)/habits.tsx`
- [x] T022 [US3] Rediseñar editor compacto y formulario en `app/(tabs)/routines.tsx`
- [x] T023 [US3] Rediseñar lista, vacío y editor en `app/(tabs)/notes.tsx`
- [x] T024 [US3] Unificar completion, quick capture y meal/break sheets en `src/components/TaskCompletionCheckDialog.tsx` y `app/(tabs)/index.tsx`

## Phase 6: User Story 4 - Consulta y configuración (P2)

**Independent Test**: Todas las pantallas secundarias comparten jerarquía y controles.

- [x] T025 [US4] Rediseñar métricas y detalle de atributos en `app/(tabs)/stats.tsx`
- [x] T026 [US4] Rediseñar grilla y estados de logros en `app/achievements.tsx`
- [x] T027 [US4] Rediseñar métricas avanzadas y detalle en `app/advanced-metrics.tsx`
- [x] T028 [US4] Rediseñar analítica en `app/analytics.tsx`
- [x] T029 [US4] Rediseñar ajustes y acordeones en `app/(tabs)/settings.tsx`
- [x] T030 [US4] Rediseñar recordatorios y corregir semántica en `app/alarms.tsx`

## Phase 7: User Story 5 - Overlays y movimiento (P2)

**Independent Test**: Overlays son coherentes, seguros y reducen movimiento.

- [x] T031 [US5] Rediseñar selectores en `src/components/AppDateTimePickerSheet.tsx` y `src/components/AppColorPickerSheet.tsx`
- [x] T032 [US5] Rediseñar prompts globales en `src/components/DailyStartPrompt.tsx`, `src/components/RestDayPrompt.tsx` y `src/components/ReplanificationPrompt.tsx`
- [x] T033 [US5] Rediseñar prompts de scheduler en `src/components/ScheduleOverflowPrompt.tsx` y `src/components/FreeBlockOpportunityPrompt.tsx`
- [x] T034 [US5] Retirar `src/components/TutorialOverlay.tsx`, obsoleto tras pasar de ocho a cinco destinos
- [x] T035 [US5] Rediseñar splash y estados de carga en `src/components/AppLoadingSplash.tsx`

## Phase 8: Polish and Validation

- [x] T036 Revisar contraste, 48 dp, texto largo, tema/acento y reduced motion en todas las rutas
- [x] T037 Ejecutar `npm run typecheck`, `npm test` y `git diff --check`
- [ ] T038 Ejecutar QA Android y capturas según `specs/001-lifeos-ui-overhaul/quickstart.md` (bloqueado: el AVD necesita más espacio que los 1,34 GB libres)
- [x] T039 Corregir regresiones funcionales detectadas por revisión estática, typecheck, tests y bundle; la pasada visual queda vinculada a T038
- [x] T040 Documentar cambios y riesgos restantes en `DOCUMENTACION_COMPLETA.txt` y `PROXIMOS_PASOS_UNIFICADOS.txt`

## Dependencies

- T003-T007 bloquean la migración por pantallas.
- T008-T012 habilitan navegación y shell principal.
- T013-T035 pueden avanzar por pantalla después de la base compartida.
- T036-T040 requieren completar las pantallas en alcance.

## Implementation Strategy

1. Construir la base visual y navegación.
2. Completar Hoy y Calendario como referencia de calidad.
3. Migrar flujos de captura y ejecución.
4. Migrar consulta, configuración y todos los overlays.
5. Validar en Android, corregir y documentar.
