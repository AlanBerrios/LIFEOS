# Feature Specification: Rediseño Integral de LIFEOS

**Feature Branch**: `main`

**Created**: 2026-07-20

**Status**: In progress

**Input**: Rediseñar de forma completa toda la interfaz Android de LIFEOS, incluidos
todos los menús, ventanas emergentes y vistas de calendario de mes, semana y día.

## User Scenarios & Testing

### User Story 1 - Navegación diaria clara (Priority: P1)

Como usuario frecuente, quiero moverme entre las funciones principales sin leer
etiquetas diminutas ni recorrer una barra saturada, para actuar rápidamente con una
mano y conservar acceso a todas las funciones.

**Why this priority**: La navegación afecta cada sesión y actualmente comprime ocho
destinos en el ancho de un teléfono.

**Independent Test**: En un Android compacto se puede llegar a Hoy, Calendario,
Tareas, Hábitos y al centro de funciones secundarias en un toque, y a cualquier
pantalla existente en un máximo de dos toques.

**Acceptance Scenarios**:

1. **Given** la app abierta en cualquier destino principal, **When** el usuario toca
   otro destino, **Then** la selección, icono, etiqueta y contenido cambian de forma
   clara sin perder el estado de las demás pestañas.
2. **Given** una función secundaria como Rutinas, Notas, Métricas o Ajustes,
   **When** el usuario abre Más, **Then** encuentra el destino con nombre, icono y
   descripción breve.
3. **Given** una pantalla secundaria o un modal, **When** el usuario usa Back,
   **Then** vuelve al nivel anterior sin quedar atrapado.

---

### User Story 2 - Plan y calendario legibles (Priority: P1)

Como usuario que organiza su día, quiero distinguir horas, tipos, estados y acciones
sin descifrar tarjetas ruidosas, para entender de inmediato qué ocurre ahora y qué
viene después.

**Why this priority**: El timeline y el calendario son el núcleo del producto.

**Independent Test**: Las vistas Mes, Semana y Día se pueden leer y operar en un
teléfono compacto con contenido corto, largo, vacío y superpuesto.

**Acceptance Scenarios**:

1. **Given** un día con tareas, eventos, rutinas, descanso y bloques terminados,
   **When** se abre Hoy o Día, **Then** cada tipo y estado se reconoce por estructura,
   icono/texto y color semántico, sin depender solo del color.
2. **Given** el calendario mensual, **When** hay eventos de varios días y saturación,
   **Then** los días, selección, hoy, barras y conteo de excedentes siguen legibles.
3. **Given** la vista semanal, **When** se cambia el zoom o se desplaza la grilla,
   **Then** cabeceras, horas y bloques mantienen alineación y objetivos táctiles.
4. **Given** cualquier vista, **When** se abre el formulario de evento o detalle,
   **Then** la hoja respeta teclado, barra de navegación e información extensa.

---

### User Story 3 - Captura y ejecución sin fricción (Priority: P1)

Como usuario en movimiento, quiero crear, editar y completar tareas, eventos, notas,
hábitos y rutinas con controles consistentes, para no reaprender cada formulario.

**Why this priority**: Son las acciones de mayor frecuencia y hoy mezclan botones,
emojis, swipes, modales y tamaños sin una gramática única.

**Independent Test**: Cada formulario se completa con el teclado abierto y cada
acción principal/secundaria/destructiva usa el mismo lenguaje visual.

**Acceptance Scenarios**:

1. **Given** un formulario con texto o números, **When** aparece el teclado,
   **Then** el campo activo y las acciones de guardar/cancelar permanecen accesibles.
2. **Given** una tarea del pool, **When** el usuario intenta desplazar la lista,
   **Then** el gesto vertical no se confunde con acciones laterales.
3. **Given** una acción completada, inválida o destructiva, **When** se confirma,
   **Then** existe feedback visual inmediato, mensaje claro y estado persistente.

---

### User Story 4 - Consulta, progreso y configuración coherentes (Priority: P2)

Como usuario que revisa hábitos, notas, métricas, logros, alarmas y ajustes, quiero
una jerarquía compacta y consistente, para encontrar información y tomar decisiones
sin recorrer listas de tarjetas sobredimensionadas.

**Why this priority**: Estas pantallas tienen menor frecuencia que Hoy, pero completan
la percepción de calidad y confianza del producto.

**Independent Test**: Rutinas, Notas, Métricas, Logros, Alarmas y Ajustes comparten
cabeceras, secciones, controles, estados vacíos y hojas coherentes.

**Acceptance Scenarios**:

1. **Given** una colección vacía o extensa, **When** se abre la pantalla,
   **Then** la interfaz enseña la siguiente acción sin ocupar espacio innecesario.
2. **Given** métricas o logros, **When** el usuario escanea la pantalla,
   **Then** las cifras importantes usan números tabulares y la jerarquía no depende
   de emojis o tarjetas idénticas.
3. **Given** ajustes agrupados, **When** el usuario expande una sección,
   **Then** la expansión es clara, breve y mantiene el contexto de scroll.

---

### User Story 5 - Movimiento y accesibilidad confiables (Priority: P2)

Como usuario, quiero que la app responda con movimiento breve y comprensible sin
marearme ni ralentizarme, para sentir que cada toque fue recibido.

**Why this priority**: El movimiento debe elevar la percepción de calidad sin afectar
la velocidad diaria ni la accesibilidad.

**Independent Test**: Press, selección, aparición de hojas, inserción/eliminación y
cambios de pestaña ofrecen feedback; con animaciones reducidas no hay desplazamientos
decorativos y ninguna función se pierde.

**Acceptance Scenarios**:

1. **Given** animaciones habilitadas, **When** se toca un control, **Then** responde en
   menos de 100 ms y la transición normal termina en 250 ms o menos.
2. **Given** animaciones del sistema deshabilitadas, **When** cambia un estado,
   **Then** se usa un corte o fundido breve sin traslación innecesaria.

### Edge Cases

- Texto de sistema aumentado, nombres y notas largos, y números de cuatro o más dígitos.
- Tema oscuro y claro con colores de acento muy luminosos u oscuros.
- Teclado abierto, navegación por gestos y navegación Android de tres botones.
- Listas vacías, listas extensas, datos históricos y estados de carga/error.
- Bloques de calendario cortos, superpuestos, multi-día y fuera del mes actual.
- Orientación vertical en teléfonos compactos y anchos; tablet no debe estirar la UI.
- Acciones rápidas repetidas, doble toque accidental y gestos interrumpidos.

## Requirements

### Functional Requirements

- **FR-001**: La navegación persistente MUST mostrar como máximo cinco destinos.
- **FR-002**: Todas las rutas existentes MUST seguir accesibles en máximo dos toques.
- **FR-003**: Cada pantalla MUST usar una cabecera compartida con título, contexto y
  acciones consistentes según corresponda.
- **FR-004**: Colores, tipografía, espaciado, radios, elevación y movimiento MUST
  provenir de roles semánticos compartidos.
- **FR-005**: La app MUST conservar tema oscuro, tema claro, color de acento elegible
  y contraste de texto automático.
- **FR-006**: Todos los controles táctiles MUST tener área efectiva mínima de 48 dp.
- **FR-007**: Todos los inputs MUST tener etiqueta visible, foco identificable,
  contraste suficiente y comportamiento seguro frente al teclado.
- **FR-008**: Todos los modales y popups MUST usar diálogos u hojas compartidas con
  Back, safe area, scroll, acciones y estados coherentes.
- **FR-009**: Hoy MUST distinguir bloque actual, próximo, terminado, fantasma,
  protegido y libre sin cambiar su significado persistido.
- **FR-010**: Calendario MUST rediseñar y validar Mes, Semana y Día, incluidos zoom,
  navegación temporal, creación, edición, detalles, vacíos y overflow.
- **FR-011**: Tareas, Hábitos, Rutinas y Notas MUST usar acciones explícitas e iconos
  consistentes, sin depender exclusivamente de swipe o emoji.
- **FR-012**: Métricas y Logros MUST priorizar cifras y progreso escaneables, con
  detalle progresivo y números tabulares.
- **FR-013**: Ajustes MUST agrupar opciones por intención y separar acciones de riesgo.
- **FR-014**: Alarmas MUST expresar claramente su semántica real de recordatorio hasta
  que exista comportamiento de alarma nativa.
- **FR-015**: Las transiciones MUST ser breves, interrumpibles y motivadas por estado.
- **FR-016**: La UI MUST respetar la preferencia de animaciones reducidas del sistema.
- **FR-017**: Ningún cambio visual MUST alterar formatos persistidos ni reglas de
  scheduler, completion, historial, XP o notificaciones.
- **FR-018**: Cada ruta y overlay inventariado MUST contar con evidencia de revisión.

### Key Entities

- **Design Token**: Rol semántico de color, tipo, espacio, forma, elevación o movimiento.
- **Navigation Destination**: Destino persistente o secundario con nombre, icono y ruta.
- **Surface State**: Estado visual normal, pressed, selected, disabled, loading, empty,
  error, success, current, finished o destructive.
- **Overlay Contract**: Reglas compartidas de hoja, diálogo, selector y confirmación.
- **Screen Inventory Item**: Ruta o componente emergente y sus estados obligatorios.

## Success Criteria

### Measurable Outcomes

- **SC-001**: El 100% de rutas y overlays inventariados usa tokens compartidos.
- **SC-002**: Cualquier pantalla existente es alcanzable en dos toques o menos desde
  la navegación principal.
- **SC-003**: El 100% de objetivos táctiles primarios y secundarios mide al menos 48 dp.
- **SC-004**: Ningún campo activo queda oculto por teclado o barras del sistema en las
  pruebas Android definidas.
- **SC-005**: Mes, Semana y Día completan sus escenarios de lectura, navegación,
  creación, detalle, overflow y vacío sin solapamientos.
- **SC-006**: Las acciones frecuentes muestran feedback perceptible en menos de 100 ms
  y transiciones ordinarias terminan en 250 ms o menos.
- **SC-007**: Tema oscuro, claro y tres colores de acento de contraste extremo superan
  la revisión visual y mantienen texto legible.
- **SC-008**: Typecheck, pruebas automatizadas y validación de diferencias finalizan sin
  errores; las pruebas funcionales existentes no presentan regresiones.
- **SC-009**: En una revisión de cinco tareas comunes, todas se completan sin depender
  de instrucciones externas ni gestos ocultos.

## Assumptions

- Android es la plataforma prioritaria y la orientación principal sigue siendo vertical.
- Se preservan contenido, lógica, rutas y formatos persistidos; se permite reorganizar
  la navegación visual para reducir saturación.
- El color de acento verde actual sigue como valor inicial, pero no como único color
  semántico de la interfaz.
- Se reutilizan Lucide, Reanimated y las dependencias Expo existentes.
- El alcance no implementa nuevas alarmas nativas, sincronización cloud ni audio.
