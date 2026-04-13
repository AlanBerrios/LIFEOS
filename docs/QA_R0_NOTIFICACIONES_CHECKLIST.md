# QA R0 - Notificaciones (E2E en dispositivo real)

Fecha: 13-04-2026
Objetivo: cerrar PRIORIDAD 0 con evidencia verificable en campo.

## 1) Precondiciones

- Build instalada corresponde al último código (ver version, commit y fecha de build en Settings).
- Permisos de notificación habilitados en sistema.
- Ahorro de batería desactivado para la app durante pruebas.
- Hora del dispositivo sincronizada automática.
- Reiniciar app antes de cada bloque de prueba (para aislar resultados).

## 2) Matriz de escenarios obligatorios

| Escenario | Estado app | Acción usuario | Resultado esperado |
|---|---|---|---|
| A1 | Foreground | Botón done | Tarea marcada completada en store/UI |
| A2 | Foreground | Botón skip | Tarea marcada saltada + replan si aplica |
| A3 | Foreground | Botón postpone | Tarea pospuesta con hora futura visible |
| A4 | Foreground | Botón start_task | Tarea pasa a in_progress |
| A5 | Foreground | Botón snooze | Se reprogr. alerta de distracción (+5 min) |
| B1 | Background | Botón done | Cambio aplicado al reabrir app |
| B2 | Background | Botón skip | Cambio aplicado al reabrir app |
| B3 | Background | Botón postpone | Cambio aplicado al reabrir app |
| B4 | Background | Botón start_task | Cambio aplicado al reabrir app |
| C1 | Cold start | Botón done desde push | Acción procesada al abrir app |
| C2 | Cold start | Botón skip desde push | Acción procesada al abrir app |
| C3 | Cold start | Botón postpone desde push | Acción procesada al abrir app |
| C4 | Cold start | Botón start_task desde push | Acción procesada al abrir app |

## 3) Exactitud horaria (entrega)

Validar para cada tipo:
- task_start
- completion_check
- event
- note
- alarm
- routine_sleep
- routine_meal

Criterio sugerido de aceptación:
- Delta entre hora programada y hora recibida <= 60 segundos (sin ahorro de batería).
- 0 pérdidas en 3 corridas consecutivas por tipo.

## 4) Registro de evidencia (plantilla)

Completar una fila por intento:

| ID prueba | Tipo notif | Estado app | Hora programada | Hora recibida | Delta seg | Acción pulsada | Resultado real | Pass/Fail | Observaciones |
|---|---|---|---|---|---|---|---|---|---|

## 5) Criterios de cierre R0

Se considera R0 cerrado solo si:
- 100% de acciones A/B/C aplican estado real (sin solo reabrir app).
- Exactitud horaria dentro del umbral en 3 corridas consecutivas.
- No hay duplicados inesperados tras resincronizar notificaciones.
- Queda evidencia archivada de la matriz completa.

## 6) Manejo de fallos

Si falla una prueba:
1. Registrar evidencia exacta (hora, estado app, acción, resultado).
2. Repetir el caso 2 veces para descartar ruido del sistema.
3. Clasificar severidad:
   - Bloqueante: acción no aplica estado o pérdida de notificación.
   - Alta: retraso > 60s repetible.
   - Media: retraso esporádico no repetible.
4. Abrir item en To_do_ideas con referencia al ID de prueba.

## 7) Resultado final de campaña

- Fecha de ejecución:
- Dispositivo / Android version:
- Build verificada:
- Resumen:
  - Total pruebas:
  - Pass:
  - Fail:
  - Bloqueantes abiertos:

Conclusión:
- [ ] R0 cerrado
- [ ] R0 parcialmente cerrado
- [ ] R0 abierto
