# FUENTE DE VERDAD - LIFEOS

Fecha: 16-04-2026
Estado: Documento canónico vigente

## 1. Proposito

Este documento es la referencia principal y corta del estado real del proyecto.
Si existe conflicto con otros documentos historicos, este archivo prevalece.

## 2. Estado real del producto

- Runtime principal: local-first en app (Expo + Zustand + AsyncStorage).
- Scheduler operativo principal: local (TypeScript).
- Backend Python: soporte de paridad, validacion y benchmark tecnico.
- Fase actual: consolidacion de robustez y consistencia.
- Prioridad actual: cerrar invariantes y calidad de ejecucion antes de nuevas features grandes.

## 3. Arquitectura vigente (resumen)

- Frontend: Expo Router + React Native + TypeScript.
- Estado: Zustand por slices (tareas, ejecucion, contenido, habitos, settings, perfil).
- Persistencia: AsyncStorage con revive/partialize.
- Nucleo de planificacion: scheduler local en src/core/scheduler.ts.
- Backend: FastAPI + OR-Tools CP-SAT en backend/.
- Integracion local/remoto: comparacion de paridad en modo sombra.

## 4. Roadmap unico vigente

### Fase A - Confiabilidad

- Cerrar regresiones criticas.
- Mantener baseline verde: typecheck + tests.

### Fase B - Integridad funcional

- Reglas duras/blandas/hibridas del timeline.
- Invariantes de ejecucion y replanificacion.
- Rol oficial del backend y pruebas backend minimas.

### Fase C - Mantenibilidad

- Reducir complejidad de pantallas criticas.
- Descomponer tipos por subdominio.
- Auditar invariantes entre slices y side effects.

### Fase D - Inteligencia contextual

- Habitos, transito y energia con explicabilidad completa.
- Anti-distraccion y geofencing robustos.

## 5. Decisiones canonicas

1. El usuario es piloto; LIFEOS actua como copiloto estricto.
2. Local-first es la estrategia principal de ejecucion diaria.
3. El backend no reemplaza el runtime local en la fase actual.
4. Ninguna nueva feature de alta complejidad se abre sin baseline estable.
5. Las reglas de timeline deben ser explicitas y testeables.
6. Toda replanificacion debe dejar trazabilidad legible en UI.

## 6. Glosario funcional unificado

- task: unidad de trabajo planificable del usuario.
- eta_minutes: duracion estimada de una tarea, en minutos.
- priority: peso de importancia relativo de una tarea (numero mayor = mas prioridad).
- urgency: horizonte temporal de necesidad (today, this_week, this_month, someday).
- schedule block: bloque en timeline con inicio/fin (task, rest, meal, sleep, transit, habit).
- bloque duro: no debe desplazarse por reordenamiento regular (ejemplo: static event).
- bloque blando: bloque informativo o flexible que no impone restriccion dura (ejemplo: habit soft block).
- bloque hibrido: bloque con parte fija y parte flexible segun regla explicita.
- replanificacion: recalculo de timeline ante cambios de contexto o ejecucion.
- overflow: caso donde no caben todas las tareas del pool en el horizonte del dia.
- scheduler parity: comparacion entre timeline local y timeline remoto para medir divergencia.

## 7. Escala de madurez por feature (oficial)

Estados:

1. concepto
2. implementado
3. test unitario
4. qa manual
5. validado en dispositivo
6. estable

Regla:
Una feature solo se considera cerrada para release cuando llega a "estable".

## 8. Matriz de madurez actual (modulos clave)

| Modulo | Estado actual |
|---|---|
| Timeline base y scheduler local | test unitario |
| Nucleo de ejecucion (done/skip/postpone/replan) | qa manual |
| Observabilidad y explicabilidad (stats/replan history) | qa manual |
| Energia y sugerencias | qa manual |
| Habitos como bloques blandos | qa manual |
| Transito con llegada real | qa manual |
| Notificaciones accionables | qa manual |
| Backend scheduler (fixed windows + hygiene) | test unitario |
| Campana QA automatizable | implementado |

## 9. Evidencia minima para cerrar cambios

- Frontend: npm run typecheck y npm run test en verde.
- Backend: tests de scheduler/health/replan relevantes en verde.
- Documentacion: actualizar este archivo cuando cambie estado real o decision canonica.
