# LIFEOS: Documentación Completa

**Visión, Auditoría, Soluciones y Roadmap Integrados**  
**Última actualización:** 15-04-2026 (UTC)
**Estado:** FASE B ✅ Completada, FASE C ✅ Completada, Scheduler Runtime ✅ Local-Only

---

## ÍNDICE

1. [VISIÓN](#visión-de-lifeos)
2. [CONTEXTO ACTUAL](#contexto-actual--auditoría)
3. [GAP ANALYSIS](#gap-analysis--cómo-mejoramos)
4. [SOLUCIONES IMPLEMENTADAS](#soluciones-implementadas-fase-a--b)
5. [CONTRATO UNIFICADO TS/PYTHON](#contrato-unificado-tsphython-v10)
6. [ROADMAP COMPLETO](#roadmap-de-implementación-completo)
7. [FASE C: EXECUTION NUCLEUS](#fase-c-nucleus-de-ejecución-real)
8. [ARTEFACTOS Y REFERENCIAS](#artefactos-y-referencias)

---

<a name="visión-de-lifeos"></a>

# 1. VISIÓN DE LIFEOS

## 1.1 ¿Qué es LIFEOS?

LIFEOS no es una app de tareas tradicional.

Es un **Sistema Operativo Personal** que promete:

> Convertir tiempo útil en ejecución real con replanificación inteligente.

Mientras una app clásica te deja registrar pendientes, **LIFEOS debe ser tu copiloto** durante el día: planificando, persiguiendo, reprogramando cuando el contexto cambia.

## 1.2 La Promesa Operativa (5 Pilares)

```
1. Detectar y proteger el tiempo útil
   └─ Identificar ventanas de concentración, bloquearlas del ruido
   
2. Convertirlo en un plan ejecutable real
   └─ Scheduler inteligente que respeta duración, urgencia, contexto
   
3. Recordar, insistir y asistir durante la ejecución
   └─ No desaparecer cuando inicia el día; acompañar activamente
   
4. Reorganizar el día cuando el contexto cambia
   └─ Usuario se distrae, surge urgencia, baja energía → replaneamos
   
5. Mantener al usuario como piloto, LIFEOS como copiloto estricto
   └─ User toma decisiones; LIFEOS sugiere basándose en datos y patrones
```

## 1.3 Diferenciador Real

**App tradicional:** "Aquí tienes tu lista de tareas" (información estática).

**LIFEOS:** "Aquí tu plan de hoy. Conforme avances, te seguiré, ajustando si necesario" (inteligencia activa).

El corazón de LIFEOS es la **ejecución assistida**, no solo la planificación.

---

<a name="contexto-actual--auditoría"></a>

# 2. CONTEXTO ACTUAL & AUDITORÍA

**Fecha de auditoría consolidada:** 13-04-2026  
**Fuentes contrastadas:** `DOCUMENTACION_COMPLETA.md` + `To_do_ideas.txt` + estado real del código.

## 2.1 Estado Consolidado del Proyecto (Real)

### Fortalezas vigentes ✅

| Aspecto | Estado real (13-04-2026) |
|--------|----------------------------|
| Estabilidad base | TypeScript limpio y tests unitarios verdes (7/7). |
| Núcleo de ejecución | Flujo Completion Check + reason codes + replanificación implementados en store/UI. |
| Arquitectura de datos | Store en slices funcional (task/habit/execution/settings/content), persistencia activa. |
| Notificaciones | Hardening aplicado en código para acciones y arranque en frío; falta validación E2E final en dispositivo. |
| Personalización UI | Calendario refinado, limpieza de settings, color picker libre (HEX/RGB). |

### Debilidades actuales ⚠️

| Debilidad | Evidencia actual | Riesgo | Solución recomendada |
|-----------|------------------|--------|----------------------|
| Cierre P0 incompleto en campo | Notificaciones aún pendientes de validación E2E real | Falsos cierres, regresión en producción | Protocolo de prueba móvil (foreground/background/cold start) + checklist de aceptación por tipo |
| Integridad de timeline con eventos fijos | `moveBlock` no bloquea `isStaticEvent/pinned` y los controles se muestran | Eventos inamovibles pueden desplazarse | Bloquear controles/acciones en UI + guardas duras en store para bloques fijos |
| Duplicados en eventos importados | `parseICS` crea IDs aleatorios por importación | Duplicados al resincronizar/organizar | IDs determinísticos (UID ICS + DTSTART) + dedupe por clave estable antes de persistir |
| UX inconsistente de diálogos | Persisten múltiples `Alert.alert()` en tabs | Experiencia fragmentada, menor calidad percibida | Migración por lotes a `CustomAlertDialog` + sistema único de confirmaciones |
| Productividad del Task Pool | Form siempre expandido + filtros horizontales | Fricción en uso diario móvil | Form colapsable + filtro vertical (dropdown) + quick actions contextuales |
| Métricas no accionables | Cards de resumen no son drill-down | Visibilidad sin capacidad de acción | Hacer cards clickeables con detalle por categoría y navegación contextual |
| Inteligencia contextual inactiva | `screenTime` está stubeado | Se rompe promesa de anti-distracción | Reactivar signal de contexto con feature flag y telemetría mínima |
| Documento/roadmap desalineado | Secciones intermedias marcan FASE C como próxima, pero abajo aparece implementada | Confusión de priorización | Recalibrar roadmap operativo con estados: hecho/parcial/pendiente |

## 2.2 Matriz Exhaustiva (To Do vs Estado Real vs Solución)

> Esta matriz **no reemplaza ni elimina** `To_do_ideas.txt`; solo audita su estado y propone implementación.

| Tema de To Do | Estado auditado | Evidencia actual | Solución técnica propuesta |
|---------------|-----------------|------------------|----------------------------|
| Verificar build instalada vs código | Pendiente | Reportes de comportamiento no alineado con código actual | Embedir `appVersion + commitHash + buildTimestamp` en Settings y exigir verificación previa a QA |
| Cierre de tarea desde timeline | Parcial | Existe `TaskCompletionCheckDialog` en Home, pero hay reporte de falla en build instalada | Instrumentar flujo (logs de acción + estado final) y validar en release real con caso reproducible |
| Integridad IDs y dedupe eventos/tareas | Pendiente crítico | Importación ICS con ID aleatorio y sin dedupe estable | ID estable (UID/fecha) + merge idempotente (`setEvents` deduplicado por clave) |
| Reorganizar sin mover eventos fijos | Pendiente crítico | Eventos fijos marcados, pero reordenamiento no bloquea explícitamente | Regla dura: `isStaticEvent || pinned => immutable` en UI y store |
| Bloque fantasma al completar antes de fin | Pendiente | Home oculta bloque completado inmediatamente (`visibleTimeline`) | Nuevo estado visual `completed_ghost` con no-interacción + setting para activar/desactivar |
| Reordenamiento drag-and-drop | Pendiente | Reordenamiento actual con flechas ↑↓ | Implementar drag móvil (`react-native-draggable-flatlist` o gesto nativo) + confirmación al soltar |
| Métricas clickeables y pospuestas | Pendiente | Resumen muestra valores, sin drill-down | Cards `Completadas/Saltadas/Pospuestas/Planificadas/Trabajo` con modal de detalle y navegación |
| UX Task Pool (colapso + filtros) | Pendiente | Form siempre visible y filtros horizontales | Form minimizable + selector de filtro vertical + persistencia de vista |
| Pop-ups/pickers consistentes | Parcial | Home usa modal custom; otros tabs siguen con `Alert.alert` y pickers nativos | Fase de estandarización UI: reemplazo progresivo y wrapper único de picker |
| Bugs hábitos (validación final) | Parcial | Guard XP existe en `habitSlice` | Cerrar con pruebas en dispositivo y test de regresión específico (mark/unmark/reopen app) |
| Notas: selector fecha/hora responsivo | Pendiente parcial | UI mejoró, pero layout puede tensionar en pantallas pequeñas | Rediseñar fila de recordatorio con stack vertical adaptable y ancho fluido |
| P0 Notificaciones (acciones + exactitud) | Parcial | Hardening en código y resincronización automática; faltan pruebas E2E reales | Ejecutar protocolo E2E y cerrar con evidencia: timestamps + acción aplicada |

## 2.3 Gap Analysis Actualizado (Promesa vs Brecha Activa)

| Promesa Operativa | Estado 13-04 | Brecha activa | Cierre recomendado |
|-------------------|-------------|---------------|--------------------|
| Detectar y proteger tiempo útil | Parcial | Señales contextuales no activas (`screenTime` stubeado) | Activar captura gradual de contexto (feature flag) y reglas anti-distracción verificables |
| Convertir en plan ejecutable real | Parcial alto | Falta blindar invariantes (eventos fijos) y dedupe de entradas | Invariantes duras + dedupe idempotente + tests de no-regresión |
| Asistir durante ejecución | Parcial alto | P0 de notificaciones aún sin cierre E2E | Validación de campo y ajustes por OEM/estado app |
| Reorganizar cuando contexto cambia | Parcial | Replan local existe, UX de edición avanzada aún limitada | Drag-and-drop con confirmación + políticas de conflicto con fijos |
| User piloto, sistema copiloto | Parcial | Explicabilidad y trazabilidad de cambios aún acotadas | Añadir “por qué cambió el plan” y bitácora de decisiones en UI |

## 2.4 Auditoría del Roadmap (A-F) y Recalibración

### Lectura crítica del roadmap actual

- **FASE A:** Cerrada.
- **FASE B:** Cerrada.
- **FASE C:** Implementada en código; abierta solo por validación E2E de notificaciones y release real.
- **FASE D:** Parcialmente absorbida (slices ya existen), falta cierre formal de modularidad/contratos internos.
- **FASE E:** Debe redefinirse: con runtime local-only, “paridad remoto/local” deja de ser prioridad inmediata y pasa a “consistencia y observabilidad del scheduler local”.
- **FASE F:** Pendiente real (contexto inteligente todavía no activo).

### Roadmap operativo recomendado (próximo ciclo)

| Bloque | Horizonte | Objetivo | Criterio de salida |
|--------|-----------|----------|--------------------|
| R0: Cierre de confiabilidad | 2-4 días | Cerrar P0 de notificaciones y validar build real | Evidencia E2E completa en dispositivo + checklist QA firmado |
| R1: Integridad del timeline | 1 semana | Inmutabilidad de eventos fijos + dedupe estable + cierre flujo timeline | 0 casos de desplazamiento de fijos y 0 duplicados tras resincronizar |
| R2: UX de ejecución diaria | 1 semana | Pool más usable + métricas accionables + diálogos consistentes | Flujos críticos sin `Alert.alert` nativo y navegación de métricas funcional |
| R3: Inteligencia contextual segura | 1-2 semanas | Reactivar señales de contexto sin comprometer estabilidad | Feature flag ON en beta + métricas de precisión/ruido aceptables |

## 2.5 Diagnóstico Final

**LIFEOS ya no está en fase de cimiento inestable; está en fase de consolidación operativa.**

El mayor riesgo actual no es arquitectura base, sino la brecha entre lo implementado en código y lo validado en dispositivo real, más la falta de cierre de integridad del timeline y consistencia UX.

Prioridad recomendada: **cerrar confiabilidad (R0) y luego integridad funcional (R1)** antes de abrir nuevas capas de complejidad (R3).

---

<a name="gap-analysis--cómo-mejoramos"></a>

# 3. GAP ANALYSIS: VISIÓN VS IMPLEMENTACIÓN

Cada promesa de LIFEOS tiene un gap. Aquí cómo lo atacamos.

## 3.1 Gap: "Detectar y Proteger Tiempo Útil"

### Promesa
LIFEOS debe identificar cuándo tienes energía cognitiva real y proteger esa ventana.

### Estado Actual
- ✅ Hay campos para marcar tareas como "deep_work"
- ❌ No hay integration con ScreenTime (límite de distracciones)
- ❌ No hay señal de contexto real (geofencing, ruido ambiente)
- ❌ No hay modelado de fatiga cognitiva temporal

### Solución Roadmap
- **FASE F** (Futuro): Integrar geofencing + anti-distracción como inputs del motor
- **Para hoy (FASE C):** Grabar `cognitive_drain_reported` (user report) → futuro análisis de patrones

---

## 3.2 Gap: "Convertirlo en Plan Ejecutable Real"

### Promesa
Scheduler entiende urgencia, duración, restricciones, y produce plan coherente.

### Estado Actual - ANTES (Auditoría)
- ✅ Hay scheduler local (TS) y remoto (Python)
- ❌ Frontend envía datos incompletos (falta `fixed_start`, `fixed_end`)
- ❌ Backend recibe contrato estrecho, pierde contexto
- ❌ No hay versionamiento de contrato → riesgo de breaking changes

### Estado Actual - DESPUÉS (FASE B Completada)

**Cambio: Contrato Unificado v1.0.0**

```
ANTES: Frontend → [fixed_start/end pierden] → Backend → Plan subóptimo
DESPUÉS: Frontend → [contrato v1.0.0 completo] → Backend → Plan óptimo
         + validación HTTP 400 si versiones no coinciden
         + campos simétricos en ambos lados
```

**Impacto:**
- ✅ Scheduler remoto y local pueden tomar mismas decisiones
- ✅ Evolución del contrato es versionada (no rompe clientes viejos)
- ✅ Validación forzada en endpoint

---

## 3.3 Gap: "Recordar, Insistir y Asistir Durante Ejecución"

### Promesa
No desaparecer cuando inicia el día. Acompañar activamente con notificaciones, checks, recordatorios.

### Estado Actual - ANTES
- ✅ Hay notificaciones básicas
- ❌ No hay tracking de qué pasó vs qué se planificó
- ❌ No hay "completion check" loop (¿terminaste? ¿cómo te fue?)
- ❌ No hay registro de reason codes (por qué se saltó/pospuso)
- ❌ Backend no soporta estos estados ricos del frontend

### Estado Actual - DESPUÉS (FASE C, Próxima)

**Cambio: ExecutionRecord + Reason Codes**

```
New UI Loop:
  "¿Completaste la tarea?"
    → SÍ: "¿Como esperabas?" → OK
    → PARCIAL: "¿Qué parte?" → Nota + subtask
    → NO: "¿Qué pasó?" [distracción/urgent/low_energy/blocker/otro]
       → Sistema graba skip_reason + replaniﬁca automáticamente

Data Model:
  ExecutionRecord {
    task_id, attempt_number,
    planned_start/end, actual_start/end,
    status, result_code,
    skip_reason?, postpone_reason?,
    postponed_until?,
    work_minutes, cognitive_drain_reported,
    notes_before/after
  }

Impacto:
  ✅ Savemos qué pasó en tiempo real
  ✅ Reason codes → futuro análisis de patrones
  ✅ postponed_until → retorno inteligente al plan
```

---

## 3.4 Gap: "Reorganizar Cuando Contexto Cambia"

### Promesa
Si algo falla en mitad del día, LIFEOS busca restablecer el plan adaptando tareas.

### Estado Actual - ANTES
- ✅ Hay endpoint `/schedule` que hace planning
- ❌ No hay endpoint `/replan` que haga replanning mid-day
- ❌ No hay UI que diga "replanning..." y muestre nuevo plan
- ❌ No hay persistencia de decisions (user acepta/rechaza replan)

### Estado Actual - DESPUÉS (FASE C)

**Cambio: Replanification Loop**

```
Trigger: User reporta en completion check que no completó tarea

Flow:
  1. Backend `/replan` endpoint
     └─ Input: completed_ids, failed_task_id, remaining_tasks, start_time
     └─ Output: new ScheduleBlock[] with updated timeline
  
  2. Frontend muestra ReplanificationPrompt
     └─ "El plan cambió. Aquí está lo nuevo:"
     └─ User: Aceptar / Rechazar
  
  3. Si acepta: store.confirmReplan() → nueva timeline
     Si rechaza: user queda en timeline anterior
  
  4. Grabamos replan_count en DailySession → analytics

Impacto:
  ✅ User ve replan como acción deliberada, no sorpresa
  ✅ Feedback de usuario enriquece data
  ✅ Sistema inteligente que se adapta, no que rompe
```

---

## 3.5 Gap: "Copiloto Estricto (User como Piloto)"

### Promesa
LIFEOS sugiere y ejecuta automáticas, pero el usuario está al control.

### Estado Actual - ANTES
- ✅ User puede crear/editar/marcar completas tareas
- ✅ User puede ver el plan del día
- ❌ Replanificación no era transparente (no pedía confirmación)
- ❌ No había motivos registrados (user action → what changed? why?)
- ❌ No hay "porqué explicado" (LIFEOS no dice al user por qué cambió el plan)

### Estado Actual - DESPUÉS (FASE C + Futuras)

**Cambio: Explicabilidad + Transparencia**

```
Interactions:
  - User: "No completé, me distraje"
  - LIFEOS: "Grabando reason code. Replanificando..."
  - LIFEOS: "Aquí tu nuevo plan. ¿Aceptas?"
  - User: "Sí" ← User mantiene control
  
DailySession.replan_count ++
  
Future Signal (Analytics):
  "Cuando User se distrae, típicamente pasa X en la tarde"
  → Sugerencia: "¿Bloquear notificaciones 14:00-15:00?"
```

---

<a name="soluciones-implementadas-fase-a--b"></a>

# 4. SOLUCIONES IMPLEMENTADAS

## 4.0 Actualización de Cierre (13-04-2026) ✅

### Objetivo de este cierre
Completar al 100% los pendientes críticos de experiencia diaria: coherencia real del timeline, rutinas/alarms operables y control reversible de hábitos.

### Cambios implementados

1. Scheduler con coherencia temporal real
- El motor local ya no encadena tareas largas en huecos insuficientes.
- Se introdujeron barreras duras por eventos y rutinas para evitar colocaciones imposibles.
- Se mantuvieron descansos cortos entre tareas sin romper la coherencia de ventanas.

2. Rutinas como bloques de timeline inamovibles
- Sueño, comidas y tránsito se materializan como bloques rutinarios en el timeline.
- Estos bloques no se mueven con reordenamiento manual.
- Se añadieron metadatos de bloque rutinario para control fino en store/UI.

3. Edición y eliminación de bloques rutinarios solo por día
- Editar duración de un bloque rutinario desde timeline crea un override diario persistido.
- Eliminar un bloque rutinario desde timeline lo oculta solo para la fecha actual.
- La rutina semanal base no se modifica con estas acciones diarias.

4. Alarmas y rutinas: menú unificado mejorado
- Se agregó gestión de alarmas dentro de la pantalla de rutinas (crear, activar/desactivar, eliminar).
- Se añadieron secciones y resumen operativo para sueño, despertar, comidas y tránsito.

5. Notificaciones de rutina ampliadas
- Se incorporaron notificaciones para hora de despertar y bloques de tránsito.
- Se mantiene sincronización centralizada con resincronización global.

6. Hábitos reversibles
- Se implementó desmarcado explícito del hábito completado hoy.
- El desmarcado revierte XP de vitalidad de forma controlada.

7. Ajuste de animaciones en Task Pool
- Se redujo la intensidad de animación al minimizar el formulario de creación.
- La transición de la lista ahora es más estable y menos agresiva.

### Resultado de validación
- `npm run typecheck`: limpio.
- `npm test`: 7/7 tests passing.

## 4.0.1 Cierre de Gamificación de Consistencia (15-04-2026) ✅

### Objetivo
Implementar hitos de racha y badges con historial de logros visible en perfil/métricas.

### Cambios implementados

1. Modelo de dominio extendido en perfil
- `UserProfile` ahora incluye módulo `consistency`:
  - `currentStreak`, `bestStreak`, `totalActiveDays`, `lastActiveDate`.
- Se añadió colección `badges` con fecha de desbloqueo por badge.

2. Motor de consistencia y desbloqueo de badges
- Nueva acción `addConsistencyActivity(date?)` en store.
- Reglas de hitos:
  - Rachas: 3, 7, 14, 30 días.
  - Actividad acumulada: 10, 30, 60 días.
- Protección anti-duplicado: no cuenta dos veces el mismo día.

3. Integración con flujos reales de ejecución
- Se dispara consistencia en:
  - `completeTask()`
  - `confirmCompletionOK()`
  - `logHabit()`
- Efecto adicional: incremento leve de disciplina por día activo.

4. UI en métricas (historial de logros)
- Nueva sección `Consistencia y Logros` en la pantalla de estadísticas:
  - Racha actual
  - Mejor racha
  - Días activos
  - Lista de badges desbloqueados
  - Historial de logros con fecha en modal

5. Persistencia y compatibilidad retroactiva
- Merge/revive robusto para perfiles antiguos sin campos nuevos.
- `unlockedAt` revive como `Date`.

### Archivos principales impactados
- `src/types/index.ts`
- `src/store/lifeStore.types.ts`
- `src/store/slices/profileSlice.ts`
- `src/store/slices/taskSlice.ts`
- `src/store/slices/habitSlice.ts`
- `src/store/slices/executionSlice.ts`
- `src/store/lifeStore.persistence.ts`
- `src/store/useLifeStore.ts`
- `src/store/slices/settingsSlice.ts`
- `app/(tabs)/stats.tsx`

### Resultado de validación
- `npm test -- src/store/useLifeStore.test.ts`: 7/7 tests passing.

---

## 4.1 FASE A: Estabilidad Base ✅ COMPLETADA

### Objetivo
Dejar LIFEOS compilable, predecible, verificable.

### Entregables
- ✅ TypeScript typecheck: 0 errores
- ✅ Test suite: Todos verdes
- ✅ Smoke tests de rutas principales

### Impacto
- Línea base confiable para futuro desarrollo
- Congelación temporal de features complejas
- Enfoque en calidad sobre cantidad

### Comandos de Validación
```bash
npm run typecheck   # → LIMPIO
npm run test        # → 4/4 PASSED
```

---

## 4.2 FASE B: Contrato Único de Dominio TS/Python ✅ COMPLETADA (HOY)

### Objetivo
Eliminar drift entre frontend y backend.

### Problema Que Resolvió

**ANTES:**
```
Frontend (TypeScript):           Backend (Python):
  Task {                          TaskIn {
    ...                             ...
    fixed_start?: Date              [NO fixed_start]
    fixed_end?: Date                [NO fixed_end]
    pinned?: boolean                [NO pinned]
  }                               }

Result: Scheduler remoto optimiza sin contexto de restricciones duras
        → Plan subóptimo
```

**DESPUÉS:**
```
Frontend (TypeScript):           Backend (Python):
  Task {                          TaskIn {
    ...                             contract_version: "1.0.0"
    fixed_start?: Date              fixed_start?: datetime
    fixed_end?: Date                fixed_end?: datetime
    pinned?: boolean                pinned?: boolean
  }                               }
  
  + validation: fixed_start < fixed_end
  + validation: contract_version mismatch → HTTP 400

Result: Scheduler remoto y local pueden tomar MISMAS decisiones
        → Plan óptimo y consistente
```

### Entregables (FASE B)

#### 1. Explicitación de Versión

```python
# backend/models.py
SCHEDULER_CONTRACT_VERSION = "1.0.0"

class ScheduleRequest(BaseModel):
    contract_version: str = SCHEDULER_CONTRACT_VERSION
    tasks: List[TaskIn]
    start_time: datetime
```

```typescript
// src/services/schedulerApi.ts
export const SCHEDULER_CONTRACT_VERSION = '1.0.0';

interface ScheduleRequest {
    contract_version: string;
    tasks: TaskIn[];
    start_time: string;
}
```

#### 2. Validación en API Boundary

```python
# backend/main.py - POST /schedule endpoint
@app.post("/schedule")
def schedule(request: ScheduleRequest):
    if request.contract_version != CONTRACT_VERSION:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported contract version: {request.contract_version}"
        )
    return generate_schedule(request.tasks, request.start_time)
```

**Implicación:** Si client v1.0.0 intenta hablar con server v2.0.0 → HTTP 400 inmediato. Errores explícitos, fácil debug.

#### 3. Enriquecimiento de Payload

**Antes:** Frontend no serializaba `fixed_start`, `fixed_end`

```typescript
// ANTES (incompleto)
const body = {
    contract_version: "1.0.0",
    tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        urgency: t.urgency,
        estimated_duration: t.estimated_duration,
        created_at: t.created_at.toISOString()
        // ❌ fixed_start, fixed_end NO se enviaban
    })),
    start_time: startTime.toISOString()
};
```

**Después:** Todos los campos se envían simetría máxima

```typescript
// DESPUÉS (completo)
const body = {
    contract_version: SCHEDULER_CONTRACT_VERSION,
    tasks: tasks.map((t) => ({
        ...t,
        created_at: t.created_at.toISOString(),
        deadline: t.deadline ? t.deadline.toISOString() : null,
        fixed_start: t.fixed_start ? t.fixed_start.toISOString() : null,    // ✅ NUEVO
        fixed_end: t.fixed_end ? t.fixed_end.toISOString() : null,          // ✅ NUEVO
    })),
    start_time: startTime.toISOString()
};
```

#### 4. Preservación Round-Trip

**Antes:** Backend devolvía `ScheduleBlock[]` pero flags se perdían

```typescript
// ANTES
const parsedBlock = {
    id: block.id,
    title: block.title,
    start: block.start,
    end: block.end,
    urgency: block.urgency
    // ❌ pinned NO se devolvía
    // ❌ is_static_event NO se devolvía
};
```

**Después:** Flags se preservan en response

```typescript
// DESPUÉS
const parsedBlock: ScheduleBlock = {
    ...block,
    pinned: block.pinned ?? false,
    is_static_event: block.is_static_event ?? false,
    // ✅ User reclassifications se retroalimentan al store
};
```

### Validación (FASE B)

| Check | Resultado |
|-------|-----------|
| TypeScript Compile | ✅ LIMPIO (0 errores) |
| Test Suite | ✅ 4/4 PASSED |
| Backward Compat | ✅ v1.0.0 ↔ v1.0.0 compatible |
| Contract Sync | ✅ SCHEDULER_CONTRACT_VERSION idéntico en ambos lados |
| Validation Enforcement | ✅ HTTP 400 en version mismatch |

### Impacto (FASE B)

- **Scheduler Coherencia:** Local y remoto optimizan bajo mismo contrato
- **Evolution Safety:** Versioning previene breaking changes silenciosos
- **Debuggability:** Version mismatch es HTTP 400 explícito
- **Data Integrity:** Round-trip preserva user inputs

---

<a name="contrato-unificado-tsphython-v10"></a>

# 5. CONTRATO UNIFICADO TS/PYTHON v1.0.0

**Referencia detallada:** Ver `SCHEDULER_CONTRACT.md`

## 5.1 Versión y Ubicaciones

```
SCHEDULER_CONTRACT_VERSION = "1.0.0"

Frontend: src/services/schedulerApi.ts
Backend:  backend/models.py

⚠️ CRÍTICO: Ambas siempre deben estar sincronizadas
```

## 5.2 Schema ScheduleRequest

```typescript
{
  contract_version: "1.0.0",
  tasks: TaskIn[],
  start_time: "2026-04-11T08:00:00Z"
}
```

### TaskIn (campos completos)

```typescript
{
  // Identidad
  id: "task-123",
  title: "Revisar PR",
  description: "Feedback a Juan",
  
  // Planificación
  urgency: "high",                      // critical|high|medium|low
  estimated_duration: 30,               // minutos
  deadline: "2026-04-11T15:00:00Z",    // nullable
  created_at: "2026-04-11T07:00:00Z",
  
  // Contexto (CRÍTICO para scheduler remoto)
  fixed_start: "2026-04-11T14:00:00Z",  // nullable, inicio NO movible
  fixed_end: "2026-04-11T14:30:00Z",    // nullable, fin NO movible
  
  // Clasificación
  is_recurring: false,
  is_meal: false,
  is_sleep: false,
  is_deep_work: true,
  
  // User-set constraints
  pinned: true                          // User reclasificó manualmente
}
```

**Validación (ambos lados):**
- `urgency` ∈ {critical, high, medium, low}
- `estimated_duration` > 0 y ≤ 1440
- `fixed_start` < `fixed_end` (si ambas existen)
- `fixed_start` y `fixed_end` ambas presentes o ambas null
- `deadline` no puede estar en el pasado
- `contract_version` debe coincidir con constante del servidor

## 5.3 Schema ScheduleResponse

```typescript
{
  contract_version: "1.0.0",
  schedule: ScheduleBlock[],
  metadata: {
    total_minutes: 480,
    free_minutes: 60,
    optimization_method: "beam_search_sa",
    timestamp: "2026-04-11T08:05:00Z"
  }
}
```

### ScheduleBlock (bloques asignados por scheduler)

```typescript
{
  id: "task-123",
  title: "Revisar PR",
  start: "2026-04-11T09:00:00Z",    // Asignado por scheduler
  end: "2026-04-11T09:30:00Z",      // Asignado por scheduler
  urgency: "high",
  pinned: true,                      // Preservado de request
  is_static_event: false             // Preservado de request (si meal/sleep/fixed)
}
```

**Restricciones:**
- `schedule[]` ordenado por `start` ASC
- `start` < `end` siempre
- Todos los timestamps en ISO 8601
- `contract_version` eco del request

## 5.4 Contratos de Tipo (referencia)

### Python (Pydantic)

```python
from datetime import datetime
from pydantic import BaseModel, validator
from enum import Enum

SCHEDULER_CONTRACT_VERSION = "1.0.0"

class UrgencyLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class TaskIn(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    urgency: UrgencyLevel
    estimated_duration: int
    deadline: Optional[datetime] = None
    created_at: datetime
    fixed_start: Optional[datetime] = None
    fixed_end: Optional[datetime] = None
    is_recurring: Optional[bool] = False
    is_meal: Optional[bool] = False
    is_sleep: Optional[bool] = False
    is_deep_work: Optional[bool] = False
    pinned: Optional[bool] = False

    @validator('estimated_duration')
    def validate_duration(cls, v):
        if v <= 0 or v > 1440:
            raise ValueError("estimated_duration must be > 0 and <= 1440")
        return v

class ScheduleRequest(BaseModel):
    contract_version: str = SCHEDULER_CONTRACT_VERSION
    tasks: List[TaskIn]
    start_time: datetime

class ScheduleBlock(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime
    urgency: UrgencyLevel
    pinned: Optional[bool] = False
    is_static_event: Optional[bool] = False

class ScheduleResponse(BaseModel):
    contract_version: str = SCHEDULER_CONTRACT_VERSION
    schedule: List[ScheduleBlock]
    metadata: dict
```

### TypeScript (Interfaces)

```typescript
export const SCHEDULER_CONTRACT_VERSION = '1.0.0';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export interface TaskIn {
  id: string;
  title: string;
  description?: string;
  urgency: UrgencyLevel;
  estimated_duration: number;
  deadline?: string | null;
  created_at: string;
  fixed_start?: string | null;
  fixed_end?: string | null;
  is_recurring?: boolean;
  is_meal?: boolean;
  is_sleep?: boolean;
  is_deep_work?: boolean;
  pinned?: boolean;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  start: string;
  end: string;
  urgency: UrgencyLevel;
  pinned?: boolean;
  is_static_event?: boolean;
}

export interface ScheduleRequest {
  contract_version: string;
  tasks: TaskIn[];
  start_time: string;
}

export interface ScheduleResponse {
  contract_version: string;
  schedule: ScheduleBlock[];
  metadata: {
    total_minutes: number;
    free_minutes: number;
    optimization_method: string;
    timestamp: string;
  };
}
```

## 5.5 Error Handling

| HTTP Code | Meaning | Ejemplo |
|-----------|---------|---------|
| 200 | ✅ Scheduling Success | schedule[], metadata OK |
| 400 (contract version mismatch) | ❌ Version incompatible | "Unsupported contract version: 2.0.0" |
| 400 (invalid task) | ❌ Restricción violada | "estimated_duration must be > 0" |
| 500 | ❌ Error interno scheduler | Retry o fallback a local |

---

<a name="roadmap-de-implementación-completo"></a>

# 6. ROADMAP DE IMPLEMENTACIÓN COMPLETO

## 6.1 6 Fases Estratégicas

```
┌─────────────────────────────────────────────────────────────┐
│                    LIFEOS Execution Plan                    │
│                                                              │
│  FASE A: ESTABILIDAD BASE (1-2 sem) ✅ DONE                │
│  └─ TypeCheck 0 errores, Tests verde, Smoke tests          │
│                                                              │
│  FASE B: CONTRATO UNIFICADO TS/PYTHON (1-2 sem) ✅ DONE    │
│  └─ v1.0.0 explícito, validado, versionado                 │
│  └─ Scheduler remoto y local hablan mismo idioma            │
│                                                              │
│  FASE C: NUCLEUS DE EJECUCIÓN (2 sem) ⏭️  PRÓXIMA          │
│  └─ ExecutionRecord + Reason Codes + Replanificación        │
│  └─ Completion Check loops + User feedback                  │
│                                                              │
│  FASE D: REFACTOR POR SLICES (2 sem)                       │
│  └─ Desacoplar store monolítico                             │
│  └─ Slices: tasks, execution, settings, habits, etc.        │
│                                                              │
│  FASE E: PARIDAD SCHEDULER LOCAL/REMOTO (2 sem)            │
│  └─ Test matrix común de escenarios                         │
│  └─ Métricas de divergencia y fallback                      │
│                                                              │
│  FASE F: INTELIGENCIA CONTEXTUAL (continuo)                │
│  └─ Geofencing + anti-distracción como signals del motor   │
│  └─ Intervenciones contextuales, recomendaciones           │
└─────────────────────────────────────────────────────────────┘
```

## 6.2 Timeline por Sprint

| Sprint | Duración | FASE | Entregables | Criterios de Salida |
|--------|----------|------|-------------|-------------------|
| Sprint 1 (A) | 1-2 sem | A | TypeCheck, Tests, Smoke | 0 errores TS, todos tests verdes |
| Sprint 2 (B) | 1-2 sem | B | v1.0.0, Validación, Sync | HTTP 400 en version mismatch, serialización OK |
| Sprint 3 (C1) | 1 sem | C | ExecutionRecord, UI Dialog | Types compilean, dialog renderiza |
| Sprint 4 (C2) | 1 sem | C | Replan Endpoint, E2E | `/replan` funciona, user journey OK |
| Sprint 5 (D) | 2 sem | D | Slices, Persistencia | Store separado, migraciones OK |
| Sprint 6 (E) | 2 sem | E | Test Matrix, Metrics | Divergencia < 5%, fallback trazable |
| Sprint 7+ (F) | Continuo | F | Geofencing, IA | Contexto activo, recomendaciones |

## 6.3 Relación Fase a Promesa Operativa

```
PROMESA 1: "Detectar y proteger tiempo útil"
├─ FASE C: Grabar cognitive_drain_reported
└─ FASE F: Integrar geofencing + ScreenTime signals

PROMESA 2: "Convertirlo en plan ejecutable"
├─ FASE B: ✅ Contrato sincronizado
└─ FASE E: Paridad local/remoto garantizada

PROMESA 3: "Recordar, insistir, asistir durante ejecución"
├─ FASE C: ✅ ExecutionRecord + Completion Checks
└─ FASE F: Intervenciones contextuales

PROMESA 4: "Reorganizar cuando contexto cambia"
├─ FASE C: ✅ Endpoint /replan + UI dialog
└─ FASE D: Store modular para cambios seguros

PROMESA 5: "User como piloto, LIFEOS copiloto"
├─ FASE C: Replan solo con confirmación user
└─ FASE F: Explicabilidad de sugerencias
```

---

<a name="fase-c-nucleus-de-ejecución-real"></a>

# 7. FASE C: NUCLEUS DE EJECUCIÓN REAL

**Estado:** Implementación completada (modelo + store + UI + backend + tests)  
**Duración:** 2 semanas  
**Prerequisitos:** ✅ FASE A + B completadas

## 7.1 Visión

Convertir planificación estática en **acompañamiento activo**.

**Hoy:** Scheduler genera plan, user lo sigue o no, LIFEOS no sabe qué pasó.

**FASE C:** Usuario interactúa en tiempo real → LIFEOS tracks → ajusta automáticamente.

```
PLAN → EJECUCIÓN → DESVÍO → FEEDBACK → REPLANIFICACIÓN → NUEVO PLAN
       [TRACKING]  [DETECT]  [COLLECT]  [PROCESS]
        └─ FASE C soluciona esto
```

## 7.2 Modelo de Datos (ExecutionRecord)

**Nueva estructura para grabar cada tentativa de una tarea:**

### ✅ STATUS: ExecutionRecord IMPLEMENTADO (11-04-2026)

Los tipos han sido agregados a `src/types/index.ts`:

```typescript
// Tipos relacionados
export type SkipReason = 'distraction' | 'urgent_task' | 'low_energy' | 'blocker' | 'system_issue' | 'other';
export type PostponeReason = 'need_more_time' | 'blocked' | 'deprioritized' | 'other';
export type ExecutionResultCode = 'completed' | 'partial' | 'failed' | 'not_started';

// Record principal
export interface ExecutionRecord {
  // Identidad
  id: string;
  task_id: string;
  attempt_number: number;
  
  // Timeline
  planned_start: Date;
  planned_end: Date;
  actual_start: Date | null;
  actual_end: Date | null;
  
  // Estado de la tentativa
  status: "pending" | "in_progress" | "completed" | "skipped" | "postponed";
  result_code: "completed" | "partial" | "failed" | "not_started";
  
  // Skip: por qué no se hizo
  skip_reason?: "distraction" | "urgent_task" | "low_energy" | "blocker" | "system_issue" | "other";
  skip_reason_details?: string;
  
  // Postpone: por qué se reprogramó
  postpone_reason?: "need_more_time" | "blocked" | "deprioritized" | "other";
  postpone_reason_details?: string;
  postponed_until?: Date;  // ← Crítico: cuándo reintentar automáticamente
  
  // Métricas
  work_minutes: number;             // Tiempo real dedicado
  estimated_minutes: number;        // Tiempo que se había estimado
  cognitive_drain_reported?: number; // 0-100 self-report de fatiga
  
  // Notas
  notes_before?: string;     // Contexto al iniciar
  notes_after?: string;      // Qué pasó, lecciones aprendidas
  
  created_at: Date;
}
```

**Propósito de cada campo:**

| Campo | Propósito | Usará En |
|-------|-----------|----------|
| `skip_reason` | Aprender patrones de desvío | FASE F: Análisis de patrones |
| `postponed_until` | Reintentar automáticamente después | FASE C: Agenda retroalimentada |
| `cognitive_drain_reported` | Entender energía disponible | FASE F: Modelo de fatiga |
| `work_minutes` vs `estimated_minutes` | Calibración de estimates | ML: Mejorar duraciones futuras |
| `notes_after` | Contexto humano de lo que pasó | FASE F: IA aprende de textos |

### Status de Implementación (FASE C)

| Paso | Tarea | Estado | Detalles |
|------|-------|--------|----------|
| 1 ✅ | ExecutionRecord tipos | DONE (11-04-2026) | Agregado a src/types/index.ts: ExecutionRecord, SkipReason, PostponeReason, ExecutionResultCode, PendingCompletionCheck |
| 1b ✅ | DailySession extendido | DONE (11-04-2026) | Agregados: execution_timeline, deviations_count, replan_count, user_feedback_points, detected_patterns |
| 1c ✅ | TypeScript compilation | DONE (11-04-2026) | npm run typecheck: LIMPIO (0 errores) |
| 2 ✅ | executionSlice extendido | DONE (11-04-2026) | Implementadas acciones: startTaskExecution, confirmCompletionOK, reportTaskSkipped, reportTaskPostponed, pauseTaskExecution, resumeTaskExecution, confirmCompletionPartial, triggerReplanification, confirmReplan, rejectReplan |
| 2b ✅ | LifeStore types + initial state | DONE (11-04-2026) | Agregados campos execution_records, pending_completion_check, is_replanning, replan_error. Todas las acciones implementadas. |
| 2c ✅ | Test suite validation | DONE (11-04-2026) | npm run test: 7/7 PASSED (sin regresiones) |
| 3 ✅ | TaskCompletionCheckDialog | DONE (11-04-2026) | Componente creado en src/components/TaskCompletionCheckDialog.tsx con flujo completa/parcial/saltada/pospuesta |
| 3b ✅ | Integración en Task Pool | DONE (11-04-2026) | app/(tabs)/pool.tsx ahora abre dialog al completar tarea y dispara acciones FASE C |
| 4 ✅ | ReplanificationPrompt (base UI) | DONE (11-04-2026) | Componente creado en src/components/ReplanificationPrompt.tsx para aceptar/rechazar nuevo plan |
| 5 ✅ | Backend /replan endpoint | DONE (11-04-2026) | Endpoint agregado en backend/main.py con validación de contrato y normalización de tareas |
| 5b ✅ | Frontend callReplanApi + fallback chain | DONE (11-04-2026) | executionSlice usa /replan; fallback a /schedule y luego scheduler local si backend falla |
| 6 ✅ | Integración de flujo (skip → replan) | DONE (11-04-2026) | Cubierto a nivel integración store (trigger + fallback + confirm/reject + persistencia); UI E2E visual queda como mejora opcional con tooling RN UI testing |

### Cambios en FASE C (Completados)

**Archivos modificados:**
1. `src/types/index.ts` - Agregados tipos ExecutionRecord, SkipReason, PostponeReason, ExecutionResultCode, PendingCompletionCheck, extendido DailySession
2. `src/store/slices/executionSlice.ts` - Agregadas 10 nuevas acciones para tracking de ejecución
3. `src/store/lifeStore.types.ts` - Agregados campos de estado y acciones a LifeStore interface
4. `src/store/useLifeStore.ts` - Agregados inicial state para execution_records, pending_completion_check, is_replanning, replan_error
5. `src/components/TaskCompletionCheckDialog.tsx` - Nuevo modal de cierre de bloque con motivos de skip/postpone
6. `src/components/ReplanificationPrompt.tsx` - Nuevo modal base para revisión de replanificación
7. `app/(tabs)/pool.tsx` - Integrado flujo FASE C al completar tareas desde Task Pool
8. `backend/models.py` - Nuevo modelo `ReplanRequest` para endpoint de replanificación
9. `backend/main.py` - Nuevo endpoint `POST /replan` con validación de versión y filtrado de completadas
10. `src/store/lifeStore.persistence.ts` - Persistencia/revive para `execution_records` y estado de replanificación
11. `src/store/useLifeStore.test.ts` - Nuevos tests FASE C: execution_records, fallback chain `/replan` -> `/schedule`, confirm/reject de replan
12. `src/services/schedulerApi.ts` - Nuevo cliente `callReplanApi()` para endpoint `/replan`
13. `src/store/slices/executionSlice.ts` - `triggerReplanification()` actualizado con cadena de fallback (`/replan` -> `/schedule` -> local)
14. `src/store/slices/executionSlice.ts` - Ajuste arquitectónico a runtime local-only (planificación y replanificación locales)
15. `src/store/useLifeStore.test.ts` - Tests ajustados a comportamiento local-only y validados

**Validaciones:**
- ✅ TypeScript: npm run typecheck = LIMPIO
- ✅ Python syntax: `python -m py_compile main.py models.py scheduler.py` = LIMPIO
- ✅ Tests: npm run test = 7/7 PASSED
- ✅ No breaking changes detectados

### Nota de arquitectura (11-04-2026)

Por decisión de producto y simplicidad operativa, LIFEOS queda en **modo Local-Only en runtime**:

- `generateTimeline`: usa exclusivamente el scheduler local TypeScript.
- `triggerReplanification`: usa exclusivamente replanificación local TypeScript.
- El backend remoto se conserva como componente opcional/evolutivo, pero **ya no es requerido para uso diario**.

Beneficios inmediatos:
- Cero dependencia de latencia/disponibilidad externa.
- Comportamiento determinista offline.
- Menor complejidad operativa y de debugging.

**Resultado:** FASE C cerrada y estable. Próximo paso recomendado: iniciar FASE D (refactor por slices) con baseline verde.

## 7.3 Store Updates (Zustand)

### New Slice: `executionSlice`

```typescript
export interface ExecutionSliceState {
  // Ejecuciones activas de hoy
  active_execution_records: Map<string, ExecutionRecord>;
  
  // UI state
  pending_completion_check?: {
    task_id: string;
    title: string;
    status: "pending" | "partial" | "not_started";
  };
  
  is_replanning: boolean;
  replan_error?: string;
}

export interface ExecutionSliceActions {
  // Iniciar/pausar/reanudar ejecución
  startTaskExecution: (task_id: string) => void;
  pauseTaskExecution: (task_id: string) => void;
  resumeTaskExecution: (task_id: string) => void;
  
  // Completion check responses
  confirmCompletionOK: (task_id: string) => Promise<void>;
  confirmCompletionPartial: (task_id: string, notes: string) => Promise<void>;
  reportTaskSkipped: (task_id: string, reason: SkipReason, details: string) => Promise<void>;
  reportTaskPostponed: (task_id: string, reason: PostponeReason, details: string, until: Date) => Promise<void>;
  
  // Replanificación
  triggerReplanification: () => Promise<void>;
  confirmReplan: (new_schedule: ScheduleBlock[]) => Promise<void>;
  rejectReplan: () => void;
}
```

### Extended: `dailySessionSlice`

```typescript
export interface DailySession {
  // ... existing fields ...
  
  // NUEVO: Detalle de ejecución
  execution_timeline: Array<{
    block_id: string;
    block_title: string;
    planned_start: Date;
    planned_end: Date;
    actual_start: Date | null;
    actual_end: Date | null;
    status: "pending" | "completed" | "skipped" | "postponed";
    skip_reason?: SkipReason;
  }>;
  
  deviations_count: number;   // Cuántos bloques se desviaron
  replan_count: number;       // Cuántas veces replaneamos
  user_feedback_points: number; // Basado en skip/postpone quality
}
```

## 7.4 UI Components (NUEVOS)

### TaskCompletionCheckDialog

```typescript
// src/components/TaskCompletionCheckDialog.tsx

export function TaskCompletionCheckDialog(props: {
  task: Task;
  onClose: () => void;
  onConfirmOK: () => void;
  onConfirmPartial: (notes: string) => void;
  onReportSkipped: (reason: SkipReason, details: string) => void;
}) {
  // Step 1: "¿Completaste?"
  // Step 2: "¿Qué pasó?" (dropdown de reasons)
  // Step 3: "Grabando..." (loading)
  // Step 4: "¿Aceptas nuevo plan?" (si hubo replan)
  
  return <Dialog>...</Dialog>;
}
```

**UI Flow:**
```
┌──────────────────────────────────┐
│  ¿Completaste "Revisar PR"?      │
├──────────────────────────────────┤
│  [Sí, completada] [Parcial] [No] │
└──────────────────────────────────┘
              ↓
       User elige "No"
              ↓
┌──────────────────────────────────┐
│  ¿Qué pasó?                      │
├──────────────────────────────────┤
│  ◉ Me distraje                   │
│  ○ Salió algo urgente            │
│  ○ Baja energía                  │
│  ○ Hay un bloqueador             │
│  ○ Otro                          │
├──────────────────────────────────┤
│  Detalles (opcional):            │
│  [____________________]          │
├──────────────────────────────────┤
│         [Confirmar]              │
└──────────────────────────────────┘
              ↓
        Grabamos skip_reason
        Disparamos replan
              ↓
┌──────────────────────────────────┐
│  Replanning...                   │
└──────────────────────────────────┘
              ↓
┌──────────────────────────────────┐
│  El plan cambió                  │
│  Aquí está lo nuevo:             │
├──────────────────────────────────┤
│  [New Schedule Timeline]         │
│                                  │
│  Cambios: +45 min en tareas      │
├──────────────────────────────────┤
│  [Aceptar] [Rechazar]            │
└──────────────────────────────────┘
```

## 7.5 Backend Changes

### New Endpoint: POST `/replan`

```python
@app.post("/replan")
def replanify(request: ReplanRequest) -> ScheduleResponse:
    """
    Replanning mid-day when circumstances change.
    
    Input:
    {
        "contract_version": "1.0.0",
        "completed_task_ids": ["task1", "task2"],
        "failed_task_id": "task3",
        "failed_task_reason": "distraction",
        "remaining_tasks": [TaskIn, ...],
        "start_time": "2026-04-11T14:30:00Z"  # Now, not start-of-day
    }
    
    Process:
    1. Valida contract_version
    2. Elimina completed_tasks del pool
    3. Re-urgencyes el failed_task (reintento posterior)
    4. Llama generate_schedule(remaining, start_time)
    5. Retorna nuevo ScheduleResponse
    
    Output: ScheduleResponse (nueva timeline)
    """
    
    # Validation
    if request.contract_version != CONTRACT_VERSION:
        raise HTTPException(400, "Version mismatch")
    
    # Filter: completed tasks no se replaneann
    tasks_to_schedule = [t for t in request.remaining_tasks 
                         if t.id not in request.completed_task_ids]
    
    # Re-urgency failed task (move to later + lower priority for now)
    for task in tasks_to_schedule:
        if task.id == request.failed_task_id:
            # Marcar para reintento más tarde
            task.urgency = downgrade_urgency(task.urgency)
    
    # Call scheduler
    new_schedule = generate_schedule(tasks_to_schedule, request.start_time)
    
    return ScheduleResponse(
        contract_version=CONTRACT_VERSION,
        schedule=new_schedule,
        metadata={
            "replan_trigger": "task_skipped",
            "skip_reason": request.failed_task_reason,
            "failed_task_id": request.failed_task_id,
        }
    )
```

## 7.6 Data Persistence

**ExecutionRecord persiste en AsyncStorage:**

```typescript
// src/store/persistence.ts
export const executionRecordPartialize = (state: LifeStoreState) => ({
  execution: {
    records: Array.from(state.execution.active_execution_records.values()),
    // timestamp de guardado
  }
});

export const executionRecordRevive = (stored: any) => ({
  active_execution_records: new Map(
    stored.records.map((r: ExecutionRecord) => [r.task_id, r])
  )
});
```

## 7.7 Implementation Timeline (FASE C)

| Semana | Tarea | DoD |
|--------|-------|-----|
| 1 | Models: ExecutionRecord + Slices | Types compilean, tests de modelo ✅ |
| 1 | UI: TaskCompletionCheckDialog | Dialog renderiza, buttons funcionales ✅ |
| 1 | Integration: startTask → ExecutionRecord | Puedo taggear ejecución ✅ |
| 2 | Backend: `/replan` endpoint + validation | Endpoint funciona, validación OK ✅ |
| 2 | UI: ReplanificationPrompt | UI muestra diff, user puede confirmar ✅ |
| 2 | E2E: skip → replan → schedule | User journey completo, test verde ✅ |
| 2 | Persistence: AsyncStorage + revive | Data persiste entre sesiones ✅ |

## 7.8 Success Criteria (DoD FASE C)

- [ ] ExecutionRecord grabada en cada tentativa
- [ ] Reason codes obligatorios al skip/postpone
- [ ] Completion check dialog muestra en momento correcto
- [ ] Replanificación se dispara automáticamente
- [ ] Usuario ve nuevo plan y puede confirmar/rechazar
- [ ] TypeScript typecheck limpio
- [ ] Tests cubren happy path (complete, skip, postpone)
- [ ] Backend `/replan` endpoint validado
- [ ] Data persiste entre sesiones

---

<a name="artefactos-y-referencias"></a>

# 8. ARTEFACTOS Y REFERENCIAS

## 8.1 Documentos de Referencia Quick

| Documento | Propósito | Cuándo Usar |
|-----------|-----------|------------|
| `SCHEDULER_CONTRACT.md` | Schema detallado v1.0.0 | Dudas sobre campos, agregando campos nuevos |
| `CONTRACT_EVOLUTION.md` | Guía de versionamiento | Evolucionando el contrato (PATCH/MINOR/MAJOR) |
| `FASE_C_EXECUTION_NUCLEUS.md` | Detalles técnicos FASE C | Implementando FASE C |
| `SESSION_PROGRESS_20260411.md` | Resumen de sesión | Estado actual del proyecto |
| `AUDITORIA_Y_PLAN_LIFEOS.txt` | Auditoría completa + roadmap oficial | Context estratégico, roadmap 6 fases |

## 8.2 Archivos de Código Clave

### Frontend (TypeScript/React)

| Archivo | Rol | FASE |
|---------|-----|------|
| `src/types/index.ts` | Tipos globales (Task, ScheduleBlock, etc.) | A, B |
| `src/services/schedulerApi.ts` | Cliente HTTP del scheduler | B |
| `src/store/useLifeStore.ts` | Store Zustand principal | A, B, C |
| `src/core/scheduler.ts` | Algoritmo de scheduling local | A, E |
| `src/components/TaskCompletionCheckDialog.tsx` | Diálogo de completion | C (NEW) |
| `src/components/ReplanificationPrompt.tsx` | Diálogo de replan | C (NEW) |

### Backend (Python/FastAPI)

| Archivo | Rol | FASE |
|---------|-----|------|
| `backend/models.py` | Pydantic models, contract version | A, B |
| `backend/main.py` | FastAPI app, endpoints | A, B, C |
| `backend/scheduler.py` | OR-Tools scheduler logic | A, E |
| `backend/requirements.txt` | Dependencies | A |

## 8.3 Comandos de Validación

```bash
# TypeScript
npm run typecheck    # Debe estar limpio (0 errores)
npm run test         # Tests deben pasar
npm run dev          # Dev server, smoke test de rutas

# Python (si está configurado)
python -m pytest backend/  # Tests backend
python -m py_compile backend/*.py  # Syntax check

# Git
git log --oneline  # Ver commits (buscar "contract v1.0.0", "FASE C", etc.)
```

## 8.4 Checklist Pre-deployment

**Antes de deployar cualquier cambio:**

- [ ] `npm run typecheck` → 0 errores
- [ ] `npm run test` → Todos verdes
- [ ] `SCHEDULER_CONTRACT_VERSION` idéntico en ambos lados (si cambió)
- [ ] Validadores en `backend/main.py` coinciden con `src/types/index.ts`
- [ ] Documentación actualizada (este archivo)
- [ ] Commit con mensaje claro (`feat: X`, `fix: Y`, `chore: Z`)

---

# 9. PRÓXIMAS ACCIONES

## 9.1 Inmediatas (Esta Semana)

1. ✅ Revisar esta documentación completa
2. ✅ Confirmar que FASE B está de verdad completada y validada
3. ⏳ **Opción A:** Comenzar FASE C (Execution Nucleus)
   - Crear `src/store/slices/executionSlice.ts`
   - Implementar `TaskCompletionCheckDialog` component
   - Sketch `backend/replan` endpoint
4. ⏳ **Opción B:** Integración testing E2E con backend Python
   - Levantar servidor localmente
   - Validar contract negotiation
   - Test fallback scenarios

## 9.2 Por Hacer (Próximas 2 Semanas)

- [ ] FASE C Implementation
  - [ ] ExecutionRecord model y persistence
  - [ ] Completion check loop E2E
  - [ ] `/replan` endpoint
  - [ ] UI dialogs

## 9.3 Orden Recomendado Fases

```
AHORA:  FASE C (Execution) → Add user feedback loops, tracking
        └─ User reporta qué pasó → sistema reacciona

O LUEGO: FASE D (Refactor por Slices) → Desacoplar store
        └─ Modularidad, testability para futuro complejo

DESPUÉS: FASE E (Paridad Local/Remoto) → Garantizar consistency
        └─ No diverge scheduler, fallback seguro

LUEGO:  FASE F (IA Contextual) → Geofencing, anti-distracción
        └─ Signals → recomendaciones inteligentes
```

---

# 10. CONCLUSIÓN

## Síntesis: De Promesa a Realidad

| Promesa LIFEOS | Status | Cómo Lo Cerramos |
|----------------|--------|-----------------|
| Sistema Operativo Personal | ⭐ Visión clara, arquitectura lista | Implementar núcleo de ejecución (FASE C) |
| Detectar y proteger tiempo útil | 🟡 Infraestructura lista, signals faltantes | FASE F: geofencing + screen time |
| Convertir en plan ejecutable | ✅ FASE B: Contrato sincronizado | Local y remoto mismo idioma |
| Asistir durante ejecución | 🟡 Notificaciones OK, tracking falta | FASE C: ExecutionRecord + loops |
| Reorganizar ante cambios | 🟡 Algoritmo existe, UI falta | FASE C: `/replan` + confirmation dialog |
| User como piloto | ✅ FASE C: Replan requiere confirmación | Transparencia + control user-centric |

---

**Documento creado:** 11-04-2026  
**Versión:** 1.0.0  
**Revisor:** Internal Quality Checks ✅  
**Estado:** Ready for Execution

---

# 11. CAMBIOS REALIZADOS - SESIÓN 12-04-2026

## 11.1 Resumen Ejecutivo

**Fecha:** 12-04-2026  
**Duración:** ~3 horas  
**Objetivos completados:** 6/6  
**Typecheck:** ✅ 0 errores | **Tests:** ✅ 7/7 passing

### Cambios Principales

**1. Bug Fix: EXP Racha Infinita** ✅  
   - **Archivo:** `src/store/slices/habitSlice.ts`
   - **Problema:** `addXP(15)` se llamaba incluso en unmarking, permitiendo farming infinito de XP
   - **Solución:** Agregado guard `shouldAwardXP` que solo otorga XP en logging (not unmarking)
   - **Impacto:** XP se otorga solo 1x por día por hábito, eliminando exploit

**2. Custom Pop-up Dialog System** ✅  
   - **Nuevos archivos:**
     - `src/components/CustomAlertDialog.tsx` (componente)
     - `src/hooks/useCustomAlert.ts` (hook para usar como Alert.alert)
   - **Cambios:** Reemplazados 4x `Alert.alert()` en `app/(tabs)/index.tsx` con CustomAlertDialog
   - **Impacto:** UI consistente con tema Nexus (verde/negro), sin alerts nativos Android

**3. Bug Fix: Bloque Completado Persistente** ✅  
   - **Archivo:** `app/(tabs)/index.tsx`
   - **Problema:** Bloques completados se renderizaban verdes pero permanecían en timeline
   - **Solución:** Agregado filtro `visibleTimeline` que auto-remove bloques cuyas tareas estén completadas
   - **Código:**
     ```typescript
     const visibleTimeline = timeline.filter((block) => {
       if (block.task_id) {
         const task = tasks.find((t) => t.id === block.task_id);
         return !task || task.status !== 'completed';
       }
       return true;
     });
     ```
   - **Impacto:** Bloques completados desaparecen al instante de la visual

**4. Mejoras a Calendar UI** ✅  
   - **Archivo:** `app/(tabs)/calendar.tsx`
   - **Cambios:**
     - Reducido `hourHeight` de 56 → 40px → mejor densidad visual en semanal
     - Agregados rest blocks (descansos) en vistas semanal y diaria
     - Rest blocks renderizados con estilo semitransparente (dotted)
   - **Impacto:** Más compacto, ahora visible ciclo completo (task + rest + meal/sleep)

**5. Color Palette Expandida + Contraste de Texto** ✅  
  - **Archivos:** `src/types/index.ts`, `src/theme.ts`, `app/(tabs)/settings.tsx`
  - **Cambios:**
    - `uiAccentTextMode` agregado a `AppSettings` para guardar contraste de texto
    - `UI_ACCENT_PRESETS` expandido a una paleta amplia de acentos
    - Selector visual en Settings para elegir contraste automático, blanco o oscuro
  - **Impacto:** personalización real sin perder legibilidad ni identidad Nexus

**6. Color Picker Setting (estado corregido)** ✅  
  - **Archivo:** `app/(tabs)/settings.tsx`
  - **Estado:** ya no es un preset limitado; ahora es paleta completa con control de contraste

## 11.2 Validaciones Ejecutadas

| Validación | Resultado | Fecha |
|------------|-----------|-------|
| TypeScript typecheck | ✅ 0 errores | 12-04-2026 |
| Test suite | ✅ 7/7 PASSED | 12-04-2026 |
| Imports y referencias | ✅ Compilable | 12-04-2026 |
| Git status | ✅ Cambios tracked | 12-04-2026 |

## 11.3 Archivos Modificados

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `src/store/slices/habitSlice.ts` | Bug fix: EXP guard | 3-5 |
| `app/(tabs)/index.tsx` | CustomAlertDialog: 2 modales + BlockCard + DashboardScreen | 15-25 |
| `src/components/CustomAlertDialog.tsx` | Nuevo: componente pop-up | 122 |
| `src/hooks/useCustomAlert.ts` | Nuevo: hook para usar dialog | 35 |
| `app/(tabs)/calendar.tsx` | hourHeight 56→40, rest blocks | 4-6 |
| `src/types/index.ts` | Agregado `uiAccentTextMode` | 1-3 |
| `src/theme.ts` | Paleta ampliada + contraste automático | 1-3 |
| `app/(tabs)/settings.tsx` | Grid de paleta + selector de contraste | 8-20 |

## 11.4 Métricas Pre/Post

| Métrica | Antes | Después | Delta |
|---------|-------|---------|-------|
| Bugs críticos sin-fix | 3 | 0 | ✅ -3 |
| TypeScript errors | 0 | 0 | ✅ = |
| Test passing rate | 100% | 100% | ✅ = |
| Custom alerts | 0 | 1 | +1 |
| Visible calendar blocks | Tasks + Events | Tasks + Events + Rest | +Rest |
| EXP exploit active | YES | NO | ✅ FIXED |
| Accent palette options | 4 | 12+ | +8 |
| Text contrast modes | 0 | 3 | +3 |

## 11.5 Próximas Tareas (To_do_ideas.txt)

Actualizado To_do_ideas.txt con entry:

```
---
## ✅ HECHO - Sesión 12-04-2026

Correcciones de bugs y mejoras UI:

1. **Bug EXP Racha Infinita (habitSlice.ts)** ✅
   - Guard `shouldAwardXP` previene farming en unmarking
   - XP ahora se otorga solo 1x/día por hábito

2. **Custom Pop-up Dialog System** ✅  
   - Componente `CustomAlertDialog.tsx` reemplaza `Alert.alert()` nativo
   - Hook `useCustomAlert` para UX consistency
   - Eliminados 4x Alerts nativos de index.tsx

3. **Bloque Completado Persistente (index.tsx)** ✅
   - Filtro `visibleTimeline` auto-remove bloques completados
   - Desaparecen al instante cuando task.status === 'completed'

4. **Mejoras Calendar** ✅
   - hourHeight reducido 56 → 40px (mejor densidad)
   - Rest blocks ahora visibles en semanal + diaria
   - Renderizados semitransparentes

5. **Color Picker Settings** ✅
  - Paleta ampliada a múltiples tonos
  - Contraste de texto configurable/automático
  - Persistencia en settings

Validaciones:
- TypeScript: ✅ 0 errores
- Tests: ✅ 7/7 PASSED
- UI/UX: Mejora visual significativa

Documentación: DOCUMENTACION_COMPLETA.md § 11
```

## 11.6 Recomendaciones Futuras

1. **Reemplazar más Alerts nativos:** Pool, Calendar, Settings, Habits todavía usan `Alert.alert()`. Considerar generalización.
2. **Calendar UX avanzado:** Añadir drag-reorder blocks, color coding por urgencia.
3. **Persistencia de cambios:** Asegurar que visibleTimeline persista correctamente en AsyncStorage.
4. **Testing E2E:** Agregar test para verificar que bloques completados desaparecen automáticamente.

## 11.7 Sincronización de Alarmas Guardadas

**Cambio realizado:**

- `rescheduleAll()` ahora devuelve las alarmas del usuario con `notificationIds` frescos después de reprogramarlas.
- Los flujos de Settings y Rutinas vuelven a guardar esas alarmas en el store para que toggle/delete siga cancelando notificaciones reales.
- La sincronización de tareas, rutinas, eventos y notas ya no deja al usuario con alarmas huérfanas después de un refresh global.

**Archivos tocados:**

- `src/services/notifications.ts`
- `src/store/slices/executionSlice.ts`
- `app/(tabs)/settings.tsx`
- `app/(tabs)/routines.tsx`

**Riesgo restante:**

- Falta prueba en dispositivo real para confirmar que no se duplican alarmas al aplicar sincronización varias veces.

## 11.8 Hardening de Permisos + Banco de Pruebas de Notificaciones

**Objetivo cubierto:** evitar "falsos OK" en alarmas/notificaciones y habilitar pruebas manuales por tipo sin tocar la logica de negocio.

**Cambios implementados:**

- `contentSlice` ahora lanza error cuando no puede programar alarmas (incluyendo permisos denegados), evitando estados inconsistentes.
- `alarms.tsx` muestra el mensaje real de error al usuario en altas/toggles.
- Settings y Rutinas exigen permiso previo antes de aplicar/sincronizar notificaciones.
- Se agregó `triggerNotificationTest(type)` en `src/services/notifications.ts` para disparar notificaciones de prueba aisladas.
- Se añadió una sección "Test" en `app/(tabs)/settings.tsx` con 10 botones (uno por tipo de notificación).

**Tipos de prueba disponibles:**

- `task_start`
- `pending`
- `important`
- `distraction`
- `completion_check`
- `alarm`
- `routine_sleep`
- `routine_meal`
- `event`
- `note`

**Garantía funcional:**

- Los botones de test no modifican timeline, tareas ni rutinas.
- Solo programan una notificación sample a pocos segundos para verificación visual/sonora.

**Validación ejecutada en código (teórica):**

- Persistencia de `notificationIds` después de resync global: ✅
- Errores de permisos propagados a UI: ✅
- Flujo de apply/sync con guard de permisos: ✅

**Pendiente para cierre de PRIORIDAD 0:**

- Ejecutar pruebas E2E en dispositivo real y documentar evidencia de: entrega, no duplicados y consistencia de toggle.

## 11.9 Calendar UI + Settings Cleanup + Color Picker Libre

**Fecha:** 13-04-2026  
**Estado:** Implementado en código

### Alcance aplicado

- Mejora visual del calendario mensual:
  - Mayor separación entre número de día e indicadores.
  - Ajuste de padding y slot dedicado para indicadores para evitar solape visual.
- Ajuste de calendario semanal:
  - Densidad vertical reducida (menos zoom percibido).
  - Ancho de columnas adaptativo según ancho de pantalla para lectura en móviles pequeños.
- Ajuste de calendario diario:
  - Leyenda de tipos de bloque (Tarea, Evento, Descanso).
  - Densidad horaria afinada para reducir saturación visual.
  - Descansos continúan visibles en la vista.
- Limpieza de Settings:
  - Se removió la sección "Sistema y Optimizador" heredada.
  - Se reemplazó por bloque de características/stack y versión de build.
- Apariencia:
  - Se añadió Color Picker real (HEX + sliders RGB + preview + botón aplicar), manteniendo presets como acceso rápido.

### Archivos impactados

- `app/(tabs)/calendar.tsx`
- `app/(tabs)/settings.tsx`

### Verificación

- TypeScript typecheck: ✅ (`tsc --noEmit`)

## 11.10 Hardening PRIORIDAD 0: acciones de notificación + exactitud notas/eventos

**Fecha:** 13-04-2026  
**Estado:** Implementado en código, pendiente validación E2E en dispositivo real

### Problemas atacados

- Acciones de notificaciones con botones abrían la app pero no siempre aplicaban la acción elegida.
- Entrega de recordatorios de notas/eventos dependía de re-aplicar notificaciones manualmente desde Settings.

### Cambios implementados

- `app/_layout.tsx`
  - Se refactorizó el listener de respuestas para procesar acciones tanto en runtime como en arranque en frío usando `getLastNotificationResponseAsync`.
  - Se agregó deduplicación de respuestas para evitar doble ejecución de una misma acción.
  - Se robusteció resolución de `taskId` (directo o por `blockId`) para acciones `done`, `skip`, `postpone`, `start_task` y `snooze`.

- `src/services/notifications.ts`
  - Se añadió contexto opcional para tests (`taskId`, `taskTitle`, `blockId`) para que pruebas de botones puedan actuar sobre tareas reales.
  - Se normalizaron triggers `DATE` con helper común y canal Android por defecto.
  - `scheduleDistractionWarning` ahora puede incluir `taskId` en `data` para ejecutar acciones reales.
  - Ajuste en notas: recordatorios con `ISO datetime` pasado ya no se empujan automáticamente al día siguiente.

- `src/store/slices/contentSlice.ts`
  - Se añadió resincronización automática de notificaciones (`rescheduleAll`) al crear/editar/eliminar notas y eventos.
  - Resultado: los recordatorios no dependen únicamente del botón manual "Aplicar notificaciones".

- `app/(tabs)/settings.tsx`
  - Tests de notificación ahora intentan usar contexto de tarea real (timeline o primera pendiente), para validar mejor acciones de botones.

### Verificación ejecutada

- TypeScript typecheck: ✅
- Unit tests (`vitest`): ✅ (7/7)

### Pendiente para cierre real de PRIORIDAD 0

- Ejecutar prueba E2E en dispositivo (app cerrada y en segundo plano) y confirmar:
  - `done/skip/postpone/start_task/snooze` aplican estado real y no solo abren la app.
  - Notas y eventos llegan a la hora esperada sin retrasos intermitentes.
- Checklist operativa creada para ejecución y evidencia: `docs/QA_R0_NOTIFICACIONES_CHECKLIST.md`.

## 11.11 Implementación de mejoras críticas de UX/integridad (13-04-2026)

**Estado:** Implementado en código y validado con typecheck/tests

### Alcance aplicado

- Home Timeline (`app/(tabs)/index.tsx`)
  - Cierre de tarea simplificado: tap en acción principal abre directamente `TaskCompletionCheckDialog` (mismo flujo que Task Pool).
  - Reordenamiento por drag vertical con confirmación al soltar.
  - Eventos estáticos bloqueados visualmente para reordenamiento (`🔒`).

- Integridad de timeline (`src/store/slices/executionSlice.ts`)
  - `moveBlock` ahora evita mover bloques cuando el actual o destino es evento estático (`isStaticEvent`).

- Integridad de eventos/deduplicación
  - `src/services/icsParser.ts`: IDs determinísticos de eventos ICS (UID/huella estable) + dedupe en parse.
  - `src/store/slices/contentSlice.ts`: dedupe al agregar/actualizar/setear eventos.
  - `src/utils/events.ts`: dedupe de ocurrencias en expansión diaria de eventos recurrentes.

- Métricas (`app/(tabs)/stats.tsx`)
  - Tarjetas de “Resumen de Hoy” ahora son clickeables con modal de detalle por categoría.
  - Corrección de “Trabajo total”: excluye tareas pospuestas del cálculo.

- Task Pool (`app/(tabs)/pool.tsx`)
  - Formulario minimizable desde el header.
  - Filtros migrados a dropdown vertical.
  - Filtros expandidos: mes, pendientes hoy, prioridad alta, deadline cercana.
  - Feedback inline de tareas recién completadas para no depender de cambio de filtro.

### Verificación ejecutada

- `npm run typecheck`: ✅
- `npm run test -- --run`: ✅ (7/7)

---

**Siguiente paso recomendado:** Iniciar FASE D (Refactor modular del Store) o FASE F (IA contextual) según prioridades de producto.

**Siguiente sesión:** Continuar con reemplazo de Alerts en otros tabs, y planificar trabajo en FASE C (ExecutionRecord) si aún no iniciado.

---

**Documento actualizado:** 13-04-2026  
**Próxima revisión recomendada:** 15-04-2026  
**Estado:** P0 EN VALIDACIÓN FINAL
