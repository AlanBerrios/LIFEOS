# QA y Pruebas E2E Automatizables

Fecha: 15-04-2026

## Objetivo

Estandarizar una campana QA/E2E reproducible para LIFEOS con:
- pasos automatizados base (typecheck + unit tests),
- matriz E2E manual guiada y repetible,
- reporte unico por ejecucion en Markdown.

## Comandos

```bash
npm run qa:baseline
npm run qa:e2e:campaign
```

Opcional con metadato de dispositivo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa_e2e_campaign.ps1 -DeviceInfo "Pixel 7 Android 14"
```

## Que automatiza hoy

- `Typecheck`.
- `Unit tests`.
- Generacion de reporte en `docs/reports/QA_E2E_REPORT_YYYYMMDD_HHMMSS.md`.
- Plantilla de escenarios E2E para completar evidencia.

## Escenarios reproducibles incluidos en reporte

- Notificaciones A/B/C (foreground/background/cold start).
- Integridad de timeline (bloques fijos/rutina).
- Overflow de planificacion.
- Metricas accionables.
- Observabilidad y explicabilidad (bitacora de replanificaciones).

## Criterios de cierre sugeridos

- Sin fallos en `qa:baseline` en 3 corridas consecutivas.
- 100% de escenarios E2E marcados como pass con evidencia.
- Cualquier fail debe crear item de seguimiento con:
  - ID de escenario,
  - build/commit,
  - evidencia,
  - paso para reproducir.

## Evidencia y trazabilidad

Cada reporte generado funciona como evidencia de campana.
Adjuntar ese Markdown a la iteracion/release correspondiente.
