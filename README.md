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

## Variables de entorno (frontend)

Este proyecto usa variables `VITE_*` para cliente web.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

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
