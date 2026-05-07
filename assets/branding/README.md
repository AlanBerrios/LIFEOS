# LIFEOS Branding Assets

Estos son los assets de marca oficiales utilizados por la app.

## Archivos utilizados por Expo / la app nativa

- `icon-v4.png`: icono principal de la aplicacion.
- `adaptive-icon-v4.png`: icono adaptativo Android.
- `splash-icon-v4.png`: imagen usada en el splash nativo de Expo.
- `favicon-v4.png`: favicon web para el host de la app.

## Uso en el proyecto

- `app.json` referencia estos archivos para `expo.icon`, `expo.splash.image`, `android.adaptiveIcon.foregroundImage` y `web.favicon`.
- `src/components/AppIconSVG.tsx` carga `icon-v4.png` directamente como icono en la pantalla de carga interna.
- `src/components/AppLoadingSplash.tsx` muestra el logo de `AppIconSVG` mientras la app inicializa.

## Notas

- El icono que aparece en la app instalada se genera desde `icon-v4.png`.
- `splash-icon-v4.png` se usa para los primeros segundos antes de que JS se ejecute.
- Los archivos SVG antiguos de `docs/branding` fueron retirados porque no coinciden con el branding real actual.
- Si reemplazas estos PNG por versiones mejores, manten los mismos nombres para no romper la configuracion actual.
