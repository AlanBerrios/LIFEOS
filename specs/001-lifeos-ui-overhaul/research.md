# Research: Decisiones del Rediseño Integral

## Navegación principal

**Decision**: Cinco destinos persistentes: Hoy, Calendario, Tareas, Hábitos y Más.

**Rationale**: Material 3 recomienda de tres a cinco destinos en la barra compacta.
La barra actual contiene ocho y fuerza iconos/etiquetas demasiado pequeños. Más
mantiene Rutinas, Notas, Métricas y Ajustes visibles en un segundo nivel.

**Alternatives considered**: Barra horizontal desplazable (oculta destinos), drawer
como navegación primaria (más lento en uso diario), mantener ocho (ilegible).

## Identidad visual

**Decision**: Superficies grafito neutras, acento configurable, y colores semánticos
independientes para éxito, advertencia, información y peligro.

**Rationale**: El verde actual funciona como identidad, pero usarlo también como
éxito vuelve ambiguos selección, marca y estado. Los roles separados mejoran lectura.

**Alternatives considered**: Monocromo total (reduce legibilidad de estados), paleta
multicolor decorativa (ruido), gradientes/glassmorphism (impropios de herramienta diaria).

## Densidad y forma

**Decision**: Densidad 7/10, tarjetas solo para entidades reales, secciones sin
contenedor decorativo, radios de 8/12/16 dp y cápsulas reservadas a chips.

**Rationale**: LIFEOS se usa para escanear y actuar repetidamente. Las tarjetas grandes
y anidadas aumentan scroll y esconden jerarquía.

**Alternatives considered**: UI editorial aireada (desperdicia altura), cockpit 10/10
(demasiado exigente), tarjetas blandas en cada sección (jerarquía plana).

## Movimiento

**Decision**: Feedback press 100-140 ms, selección 160-200 ms, hojas/diálogos
200-250 ms, sin coreografías al cargar páginas.

**Rationale**: Emil e Impeccable priorizan movimiento que explica estado y respuesta
inmediata en acciones frecuentes. Reanimated ya está disponible.

**Alternatives considered**: Animaciones largas y con rebote (lentas), ausencia total
de feedback (sensación inerte), nueva librería de animación (innecesaria).

## Componentes y dependencias

**Decision**: Reutilizar Lucide, Reanimated, Gesture Handler y Safe Area Context.

**Rationale**: Ya están integrados, cubren el alcance y evitan peso/riesgo adicional.

**Alternatives considered**: Añadir un kit Material completo (migración excesiva),
mezclar otra familia de iconos (inconsistencia), dibujar SVG manual (mantenimiento).

## Validación visual

**Decision**: QA en emulador Android con capturas por ruta primaria, calendario en
tres modos y overlays representativos, además de typecheck y tests.

**Rationale**: Una app nativa no puede darse por validada con inspección de código.

**Alternatives considered**: Expo web screenshots (no prueban insets/IME/Back), solo
snapshot tests (no prueban composición táctil).
