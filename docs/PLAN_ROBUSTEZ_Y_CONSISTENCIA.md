# Plan de Robustez y Consistencia (Ejecucion)

Fecha: 15-04-2026

## Objetivo

Cerrar el cuello de botella actual del proyecto: coherencia, reglas e invariantes antes de expandir features nuevas.

## Estado de esta iteracion

### Completado

1. Fix critico de layout raiz:
- `app/_layout.tsx`: `CustomAlertDialog` integrado dentro del arbol JSX principal.

2. Fix critico de scheduler backend:
- `backend/scheduler.py`: implementadas funciones faltantes de `fixed_start/fixed_end`.
- agregada validacion dura de ventanas inconsistentes.
- timeline backend ahora respeta tiempos resueltos por CP-SAT.

3. Hardening basico backend:
- `backend/main.py`: CORS configurable por entorno + logging de excepciones.
- `backend/requirements.txt`: dependencias con rangos versionados.

4. Cobertura minima de regresion backend:
- `backend/tests/test_scheduler_fixed_windows.py`.

5. Base canonica de reglas:
- `docs/REGLAS_E_INVARIANTES_CANONICAS.md`.

## Plan por fases

## Fase 1 - Estabilizacion inmediata (0-2 dias)

1. Ejecutar y dejar verde:
- tests backend nuevos,
- `npm run typecheck`,
- `npm run test`.

2. Revisar llamadas que dependan de CORS abierto y parametrizar `LIFEOS_ALLOWED_ORIGINS` en entornos reales.

3. Actualizar checklist de release con los invariantes canonicos.

## Fase 2 - Coherencia de reglas (2-5 dias)

1. Mapear todas las transiciones de estado de tarea en una matriz unica.
2. Validar que `task status`, `ExecutionRecord` y timeline no diverjan entre slices.
3. Endurecer logs de replanificacion y razones.

## Fase 3 - Reduccion de deuda estructural (1-2 semanas)

1. Descomponer `src/types/index.ts` por subdominios.
2. Extraer logica de pantallas grandes a hooks y helpers.
3. Agregar tests de invariantes cruzadas store/scheduler.

## Fase 4 - Cierre de inteligencia contextual (despues de robustez)

1. Cerrar comportamiento formal de habitos y transito.
2. Expandir energia/telemetria con explicabilidad.
3. Reintroducir anti-distraccion y geofencing con guardrails.

## Definicion de "listo" de robustez

Se considera cerrada la fase de robustez cuando:
- no existen hallazgos criticos abiertos en layout/scheduler,
- los invariantes canonicos tienen cobertura minima de test o validacion repetible,
- la documentacion operativa refleja exactamente el estado real.
