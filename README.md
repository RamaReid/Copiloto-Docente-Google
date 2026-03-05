# Copiloto Docente

Aplicación web para planificación docente y generación de materiales.

## Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (fase actual)
- Google AI Studio (Gemini, endpoint OpenAI-compatible)

## Desarrollo local

```sh
npm install
npm run dev
```

## Desarrollo en Google AI Studio (sin backend externo)

Para trabajar sin que datos/IA bloqueen el frontend:

```sh
npm install
npm run dev:studio
```

Este modo activa proveedores mock (auth, datos y funciones IA simuladas) y persiste estado en `localStorage`.
No requiere credenciales de Supabase para iterar interfaz y flujo.

## Runtime por proveedor

- `VITE_APP_MODE=studio|production`
- `VITE_DATA_PROVIDER=mock|supabase|firebase`
- `VITE_AI_PROVIDER=mock|google`
- `VITE_STUDIO_AUTO_LOGIN=true|false`

Comportamiento por defecto:

- `studio` -> `mock`
- `production` -> `supabase` para datos y `google` para IA

## Variables de entorno (frontend)

Este proyecto usa variables `VITE_*` para cliente web.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Nota: si faltan variables de Supabase y el provider de datos esta en `mock`, la app sigue operativa en modo studio.

## Variables de entorno (edge functions)

Configurar en Supabase Functions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

Opcional:

- `GEMINI_PLAN_MODEL` (default: `gemini-2.5-pro`)

## Canon de producto

- `docs/CANON_INDEX.md`
- `docs/CANON_OPERATIONAL.md`
- `docs/CANON_GOLDEN_FYHCT_6EESA.md`
