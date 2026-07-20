# UI Contract: Inventario Completo

## Rutas persistentes

| Ruta | Rol | Estados obligatorios |
| --- | --- | --- |
| `/(tabs)` | Hoy y timeline | sin plan, plan activo, bloque actual, terminado, ghost, libre, tránsito |
| `/(tabs)/calendar` | Calendario | mes, semana, día, zoom, overflow, vacío, crear/editar/detalle |
| `/(tabs)/pool` | Tareas | vacío, filtros, tareas largas, swipe, acciones, formulario |
| `/(tabs)/habits` | Hábitos | vacío, progreso, hold +/- , crear/editar, completado |
| `/(tabs)/more` | Centro secundario | todos los destinos secundarios, estado pressed y selección |
| `/(tabs)/routines` | Rutinas | sueño, comidas, tránsito, personalizado, formulario, vacío |
| `/(tabs)/notes` | Notas | vacío, búsqueda/lista, crear/editar, recordatorio, contenido largo |
| `/(tabs)/stats` | Métricas | datos, sin historial, detalle de atributo, navegación secundaria |
| `/(tabs)/settings` | Ajustes | secciones plegadas/abiertas, tema, inputs, permiso, peligro |
| `/achievements` | Logros | bloqueado, secreto, desbloqueado, progreso, detalle |
| `/advanced-metrics` | Métricas avanzadas | datos, vacío, detalle y explicación |
| `/alarms` | Recordatorios | vacío, activo/inactivo, crear/editar, permiso |
| `/analytics` | Analítica | resumen, vacío y navegación atrás |

## Overlays compartidos

| Componente | Contrato |
| --- | --- |
| `FormSheet` | IME/safe area, grabber, título opcional, scroll, Back, acciones visibles |
| `CustomAlertDialog` | decisión breve, máximo una primaria, destructiva explícita, Back |
| `AppDateTimePickerSheet` | selección legible, números tabulares, aplicar/cancelar |
| `AppColorPickerSheet` | preview, contraste, limpiar/aplicar y área táctil 48 dp |
| `DailyStartPrompt` | resumen, estado vacío y tres decisiones jerarquizadas |
| `RestDayPrompt` | confirmación clara y cancelación segura |
| `ScheduleOverflowPrompt` | razón, selección, recomendación y overflow de lista |
| `FreeBlockOpportunityPrompt` | tiempo libre, capacidad, opción de descanso/avance |
| `ReplanificationPrompt` | cambios, causa, aceptar o mantener plan |
| `TaskCompletionCheckDialog` | completa/parcial/saltada/pospuesta, teclado y errores |
| `TutorialOverlay` | ancla, siguiente/atrás/saltar, no tapar navegación |
| `SwipeableTaskCard` | scroll vertical prioritario y acciones explícitas equivalentes |

## Primitivas compartidas

- `Screen`: fondo, insets y ancho máximo.
- `ScreenHeader`: título, descripción breve, back y acciones.
- `SectionHeader`: título y acción contextual sin tarjeta contenedora.
- `Button`: filled, tonal, outlined, text y danger.
- `IconButton`: 48 dp, tooltip/accessibilityLabel obligatorio.
- `TextField`: label, helper, error, focus y keyboardType.
- `SegmentedControl`: tres o menos modos equivalentes.
- `Chip`: filtro o selección, nunca comando principal.
- `EntityRow`: elemento compacto para tarea, rutina, nota o ajuste.
- `EmptyState`: título funcional, explicación breve y siguiente acción.
- `StatusBadge`: estado real con texto/icono, no decoración.
- `BottomSheet`/`Dialog`: contratos de overlay anteriores.

## Reglas de revisión

- No tarjeta dentro de tarjeta.
- No emoji como único icono funcional.
- No texto menor de 11 sp; etiquetas de navegación mínimo 11 sp.
- No touch target menor de 48 dp.
- No acción disponible solo por swipe.
- No animación decorativa repetida al entrar en cada pantalla.
- No color como única señal de estado.
