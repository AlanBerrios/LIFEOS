<div align="center">
  <img src="https://img.shields.io/badge/LIFEOS-v2.0%20Nexus-8b5cf6?style=for-the-badge&logo=react&logoColor=white" alt="LifeOS Nexus" />
  <h1 align="center">LifeOS ✨ v2.0 "Nexus"</h1>
  <p align="center">
    <strong>Tu ecosistema personal de productividad, gestión del tiempo y anti-distracción.</strong>
  </p>
  
  <p align="center">
    Desarrollado por <strong>Alan Berrios Estay (aka BlitZx)</strong>
  </p>
</div>

<br />

## 🚀 ¿Qué es LifeOS?

LifeOS es una aplicación diseñada para tomar el control de tu día, automatizando la forma en que agendas tus descansos, comidas, horas de sueño y rachas de estudio profundo. Más que una lista de tareas (To-Do List), **LifeOS es un Ecosistema de Productividad Autónomo** impulsado por algoritmos de *Scheduling* eficientes para colocar tus descansos automáticamente entre tareas largas, optimizando tu energía y rendimiento mental.

## 🌟 Características Principales

*   ⏰ **Generador Autónomo de Horarios (Scheduler):** 
    Tú le das tus tareas, su urgencia y su duración; LifeOS encaja todo armando una línea de tiempo para hoy considerando tus comidas y descansos mentales.
*   📊 **Tablero de Maestría Personal:**
    Métricas de rendimiento visuales que te dicen exactamente cómo te has comportado, tu tasa de completación y estadísticas de enfoque.
*   ⏳ **Guardia Anti-Distracciones (Geofencing y Screen Time):**
    ¿Abres TikTok e Instagram más de la cuenta cuando deberías estar trabajando? LifeOS **trabaja en segundo plano** utilizando la API de `UsageStats` para enviarte alertas interactivas a modo de cachetada si pasas de $X$ minutos durante un bloque productivo.
*   🍣 **Control de Rutinas Personalizables:**
    Múltiples comidas al día, rutinas semanales por día y control absoluto de cuándo despertar o dormir, y hasta tiempos de traslado Universitario!
*   📅 **Sincronización ICS y Calendar:**
    Compatible con URLs de calendarios para fusionar eventos estáticos (como clases) mágicamente con las predicciones generadas por el Scheduler.
*   ☁️ **Backups y Copias de Seguridad de Vida:**
    Posibilidad de hacer y cargar respaldos locales (`JSON`) de toda tu cuenta en la aplicación sin necesitar de crear perfiles molestos en la nube.

## 🛠️ Stack Tecnológico

Ecosistema robusto y 100% Nativo-Friendly con Expo y TypeScript.
- **Framework:** [React Native](https://reactnative.dev) + [Expo SDK](https://expo.dev/)
- **Lenguaje:** TypeScript estricto.
- **Gestión de Estado:** `Zustand` persistente offline con AsyncStorage.
- **UI y Navegación:** Expo Router, React Native Reanimated.
- **Fondo / Integraciones nativas:** `expo-task-manager`, `expo-background-fetch`, `expo-location`, `expo-notifications`, `expo-android-usagestats`.

## 👤 El Autor

Desarrollado y mantenido con ❤ por Alan.
🔗 **GitHub:** [AlanBerrios/LIFEOS](https://github.com/AlanBerrios/LIFEOS)

Si encuentras este proyecto inspirador, ¡siéntete libre de navegar por el repositorio, dejar una estrellita ⭐ y revisar el código!
