<div align="center">
  <img src="https://img.shields.io/badge/LIFEOS-v4.0%20HELL%20YEAH%20UPDATE-22c55e?style=for-the-badge&logo=react&logoColor=white" alt="LifeOS Hell Yeah Update" />
  <br />
  <img src="assets/branding/icon-v3.png" alt="Logo LIFEOS v4.0" width="240" />
  <h1 align="center">LifeOS ✨ v4.0 "HELL YEAH UPDATE"</h1>
  <p align="center">
    <strong>Sistema operativo personal para ejecutar tu día con foco, estructura y replanificación inteligente.</strong>
  </p>
  
  <p align="center">
    Desarrollado por <strong>Alan Berrios Estay (aka BlitZx)</strong>
  </p>
</div>

<br />

![Pantalla de carga LIFEOS v3](assets/branding/splash-icon-v3.png)

## 🚀 ¿Qué es LifeOS?

LifeOS no es solo una lista de tareas. Es un **copiloto estricto de ejecución**: tú decides el rumbo y la app te ayuda a proteger tu tiempo útil, recordarte lo importante y reordenar el plan cuando la realidad cambia.

Su núcleo combina tareas, rutina, eventos fijos, timeline y notificaciones para que cada día sea ejecutable, no solo "bonito en papel".

## 📌 Fuente de Verdad

La referencia canónica y vigente del estado del proyecto vive en:

- `docs/FUENTE_DE_VERDAD_LIFEOS.md`

Si existe conflicto entre documentos históricos y el estado operativo actual, esta fuente prevalece.

## 🆕 Últimas actualizaciones

### v4.0 - HELL YEAH UPDATE

- Integración de hábitos como bloques blandos en timeline y calendar, con lectura visual de solapes.
- Motor de energía y cansancio con sugerencias aplicables para priorizar tareas del día.
- Seguimiento real de tránsito (llegué a tiempo/tarde) para ajustar duración futura de traslados.
- Observabilidad avanzada: bitácora de replanificaciones, contexto de decisiones y métricas accionables en Stats.
- Paridad local/remoto del scheduler en modo sombra con score de divergencia y fallback observable.
- UX unificada de popups y pickers con componentes propios de la app.
- Prompt de overflow de planificación para proteger tareas clave cuando no cabe todo el día.
- Hardening backend: ventanas fijas robustas, CORS por entorno y logging estructurado básico.
- Campaña QA/E2E automatizable con reporte reproducible.

- Calendario semanal y diario con **carriles dinámicos de solapamiento** (sin límite artificial de 2 bloques).
- Soporte visual para bloques punteados/eventos superpuestos con mejor lectura temporal.
- Flujo de finalización de tareas conectado al sistema real de ejecución y replanificación.
- Feedback in-app al completar tareas y hábitos.
- Recordatorios de notas mejorados con selector de fecha y hora.
- Pantalla de métricas con paneles explicativos de maestría, EXP, atributos y habilidades.

## 🌟 Características Principales

- ⏰ **Scheduler orientado a tiempo útil:**
  Construye una timeline diaria usando prioridad, urgencia, duración, bloques fijos y contexto.
- 🧠 **Ejecución real (no solo planificación):**
  Registro de completado, parcial, pospuesto y omitido, con acciones de replanificación.
- 📊 **Sistema de progreso y maestría:**
  EXP, nivel, métricas de cumplimiento y progreso de hábitos para mejorar consistencia.
- 🔔 **Notificaciones y recordatorios accionables:**
  Alarmas para tareas, hábitos y notas con formatos de recordatorio más robustos.
- 📅 **Calendario operativo:**
  Vista mensual, semanal y diaria conectadas a timeline, tareas y eventos estáticos.
- 🧩 **Local-first de verdad:**
  Estado persistente con respaldo local, priorizando funcionamiento offline.

## 🧱 Arquitectura funcional

- **Usuario = piloto:** define prioridades, decisiones y límites.
- **LifeOS = copiloto estricto:** insiste, recuerda, sugiere y reorganiza.
- **Bucle continuo:** planificar -> ejecutar -> medir -> replanificar.

## 🛠️ Stack Tecnológico

Ecosistema robusto y 100% Nativo-Friendly con Expo y TypeScript.
- **Framework:** [React Native](https://reactnative.dev) + [Expo SDK](https://expo.dev/)
- **Lenguaje:** TypeScript estricto.
- **Gestión de Estado:** `Zustand` persistente offline con AsyncStorage.
- **UI y Navegación:** Expo Router, React Native Reanimated.
- **Fondo / Integraciones nativas:** `expo-task-manager`, `expo-background-fetch`, `expo-location`, `expo-notifications`.

## 📦 Build local (APK)

1. Instalar dependencias:

```bash
npm install
```

2. Generar APK release rápido (sin clean):

```bash
npm run android:release:fast
```

Este comando ahora hace primero la sincronización nativa (`expo prebuild --platform android`) y luego compila con Gradle. De este modo, los íconos de `app.json` se inyectan en `android/app/src/main/res/mipmap-*` antes del release.

3. Si necesitas build limpio cuando algo queda cacheado:

```bash
npm run android:release:clean
```

Este modo ejecuta `expo prebuild --platform android --clean` antes del build para forzar regeneración completa de recursos nativos (útil si Android sigue mostrando un ícono viejo).

Opcional para sincronizar sin compilar:

```bash
npm run android:sync:native
```

APK esperado:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 👤 El Autor

Desarrollado y mantenido con ❤ por Alan.
🔗 **GitHub:** [AlanBerrios/LIFEOS](https://github.com/AlanBerrios/LIFEOS)

Si encuentras este proyecto inspirador, ¡siéntete libre de navegar por el repositorio, dejar una estrellita ⭐ y revisar el código!
