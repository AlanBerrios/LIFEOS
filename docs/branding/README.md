# Branding LIFEOS v3

Este directorio se usa para documentación de branding, no para activos que se cargan en la app.

## Estado actual

- Los activos reales de la app están en `assets/branding/`.
- Los íconos y el splash nativos se configuraron desde PNG.
- Los archivos SVG antiguos de `docs/branding` fueron retirados porque no representan el branding actual.

## Activos oficiales

- `assets/branding/icon-v3.png`
- `assets/branding/adaptive-icon-v3.png`
- `assets/branding/splash-icon-v3.png`
- `assets/branding/favicon-v3.png`

## Uso

- `app.json` referencia los PNG oficiales para iconos, splash y favicon.
- `src/components/AppIconSVG.tsx` carga `icon-v3.png` directamente.
- `src/components/AppLoadingSplash.tsx` muestra el logo PNG mientras la app inicializa.
