# Quickstart de Validación

## Preparación

1. Ejecutar `npm run typecheck`.
2. Ejecutar `npm test`.
3. Iniciar `npx expo start` y abrir LIFEOS en Expo Go o emulador Android.
4. Probar tema oscuro y claro, y acentos claro, medio y oscuro.

## Escenarios principales

### Navegación

- Confirmar cinco destinos persistentes y etiquetas legibles.
- Abrir Más y llegar a Rutinas, Notas, Métricas y Ajustes.
- Abrir Logros, Métricas avanzadas, Recordatorios y Analítica; probar Back.

### Hoy

- Generar un día con tarea, evento, rutina, descanso, sueño y bloque libre.
- Verificar actual, próximo, terminado, ghost y bloque protegido.
- Abrir acciones rápidas, detalle, completion y replanning.

### Calendario

- Mes: navegar, seleccionar hoy/otro día, multi-día y overflow.
- Semana: scroll horizontal/vertical, zoom +/-/reset y bloques cortos.
- Día: horas, bloques superpuestos, leyenda y creación/detalle.

### Formularios y overlays

- Crear/editar tarea, hábito, rutina, nota, evento y recordatorio.
- Mantener teclado abierto en el último campo y guardar/cancelar.
- Probar pickers de fecha, hora, color y emoji.
- Probar alertas, overflow, día libre, oportunidad libre y tutorial.

### Accesibilidad y estabilidad

- Aumentar tamaño de fuente del sistema.
- Activar navegación por gestos y después tres botones.
- Activar quitar animaciones.
- Probar nombres/notas largos, listas vacías y listas extensas.

## Salida esperada

- Sin contenido bajo status bar, navegación o teclado.
- Sin texto cortado, botones desplazados ni objetivos táctiles pequeños.
- Sin pérdida de datos ni cambios de lógica del scheduler.
- Sin errores de consola bloqueantes.
