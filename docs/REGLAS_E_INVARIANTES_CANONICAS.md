# Reglas e Invariantes Canonicas de LIFEOS

Fecha: 15-04-2026

## Objetivo

Definir las reglas operativas minimas que deben cumplirse siempre para mantener robustez y consistencia entre store, scheduler, UI y backend.

## 1. Invariantes del timeline

1. Un bloque con `isStaticEvent=true` no se mueve por acciones de reordenamiento de tareas.
2. Un bloque con `isRoutineBlock=true` solo se altera mediante overrides de rutina.
3. Un bloque `isCompletedGhost=true` es de solo lectura y no se usa para nuevas decisiones de scheduling.
4. Ningun bloque de tipo `task` puede solaparse con otro bloque `task` en un mismo timeline final.
5. Si un bloque tiene `task_id`, la tarea asociada debe existir en store (integridad referencial).

## 2. Invariantes de estado de tarea

1. `completed` es estado terminal salvo edicion explicita manual del usuario.
2. `postponed` debe guardar causa o contexto de replanificacion.
3. `skipped` y `postponed` deben registrar `ExecutionRecord` asociado para trazabilidad.
4. No puede existir una tarea `completed` con bloque activo no-ghost en el timeline.

## 3. Invariantes de replanificacion

1. Toda replanificacion debe registrar razon en `last_replan_reason` o `replan_history`.
2. Replanificar no debe eliminar evidencia historica de ejecucion del dia.
3. Si se activa overflow, la resolucion debe terminar en estado determinista: confirmar o descartar.

## 4. Invariantes de energia

1. Un `DailyEnergyReport` por fecha.
2. El ajuste de sugerencias (`energy_suggestion_bias`) debe quedar persistido.
3. Las sugerencias energizadas deben ser trazables en sesion (`suggested_task_ids`).

## 5. Invariantes backend scheduler

1. Si una tarea tiene `fixed_start`, se programa obligatoriamente a ese inicio o falla validacion.
2. Si una tarea tiene `fixed_end`, su final debe ser `<= fixed_end` o falla validacion.
3. Si `fixed_start + eta_minutes > fixed_end`, el scheduler debe rechazar el request (inconsistente).
4. El timeline retornado por backend debe respetar los tiempos resueltos por el solver.

## 6. Criterios de aceptacion por cambio

1. Prueba automatizada o de regresion para cada invariante impactado.
2. Evidencia en changelog/PR de que no rompe la UX principal.
3. Validacion minima: typecheck + tests unitarios + smoke test funcional.
