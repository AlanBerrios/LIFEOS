# Data Model: Sistema Visual

Este rediseño no agrega entidades persistidas. Los siguientes modelos son contratos
de UI locales y no migran el store.

## Theme

- `mode`: dark o light.
- `accent`: color elegido por el usuario.
- `colors`: roles background, surface, surfaceRaised, surfaceSunken, text,
  textSecondary, textTertiary, primary, onPrimary, success, warning, info, danger,
  outline y scrim.
- `type`: roles display, headline, title, body y label.
- `space`: escala 4, 8, 12, 16, 20, 24, 32.
- `shape`: radios 8, 12, 16 y full.
- `motion`: fast, standard, sheet y curvas compartidas.

## NavigationDestination

- `name`: identificador de ruta.
- `label`: etiqueta corta visible.
- `icon`: icono Lucide.
- `kind`: primary o secondary.
- `description`: contexto breve para destinos secundarios.

## ComponentState

- Estados base: default, pressed, focused, selected, disabled y loading.
- Estados semánticos: info, success, warning, danger.
- Estados de contenido: empty, error y overflow.
- Estados temporales: current, upcoming, finished y ghost.

## OverlayVariant

- `dialog`: decisión breve e interruptiva.
- `sheet`: formulario o selección con scroll y teclado.
- `picker`: selección de fecha, hora, color o emoji.
- `prompt`: decisión contextual con resumen y una acción principal.

## State Transitions

- Press: default -> pressed -> default, sin mutación persistida automática.
- Selection: default -> selected después de confirmar la acción.
- Sheet: closed -> opening -> open -> closing -> closed.
- Async action: default -> loading -> success/error -> default.
- Reduced motion: cualquier transición espacial se reemplaza por fundido o corte.
