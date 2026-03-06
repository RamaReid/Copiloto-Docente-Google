# Migration Summary

## Base comparada
- Repo base: `https://github.com/RamaReid/Copiloto-Docente-Google.git`
- Branch base: `main`
- Commit base analizado: `6c8622acbd791e165bd2282eb017a3d10bfd1116`
- Commit origen (avances actuales): `09f048fc839dc6cd060bd418e13104969f0aea3f`

## 1) Funcionalidades faltantes en base repo

Las funcionalidades que existen en el estado actual y no estan en el repo base son:
- Wizard de alta de curso con `contextMode` (NINGUNA/ORIENTACION/TECNICATURA), alias canonicos de especialidad y seleccion curricular ambigua asistida.
- Plan editor con trazabilidad curricular visible (tabs `Contenidos` y `Bibliografia`) + editor expandido por campo.
- Selector de bibliografia por leccion con limpieza de ruido institucional y deduplicacion semantica.
- Mejor UX de generacion (loader visual ThinkingBook, parseo robusto de errores de edge function, descarga alternativa de PDF y copiar link).
- Parser curricular mejorado para detectar y normalizar entradas bibliograficas reales (no autoridades/artefactos de pagina).
- Bootstrap de plan con `nodePools` (core/bibliografia), limpieza de nodos ruido, y mapeo mas estable a lecciones.
- Generacion de materiales con validaciones mas fuertes de trazabilidad bibliografica y cierre obligatorio de fuentes.
- Ajuste de esquema para `courses.curriculum_document_id` (migracion idempotente) + tipos TS actualizados.

Detalle estructurado por prioridad en `MISSING_FEATURES.csv`.

## 2) Archivos exactos por funcionalidad (ruta + que cambia)

| Funcionalidad | Archivos | Cambios exactos |
|---|---|---|
| F001 Wizard de curso avanzado | `src/pages/CourseNew.tsx` | Agrega `contextMode`, canonicalizacion de especialidad, paso unico de contexto, heuristica de resolucion curricular y fallback de insercion legacy sin `curriculum_document_id`. |
| F002 Plan editor con trazabilidad | `src/components/plan/PlanEditor.tsx` | Agrega tabs `contenidos/bibliografia`, filtros de ruido, `fetchMappedNodes`, modal expandido por campo y rebuild guiado. |
| F003 Bibliografia por leccion limpia | `src/components/lesson/BibliographySelector.tsx` | Nuevo pipeline para resolver nodos por `plan_lesson_content_links` -> `plan_content_mappings` -> fallback por documento; filtrado bibliografico y dedupe. |
| F004 UX de generacion/materiales | `src/components/ui/ThinkingBook.tsx`, `src/index.css`, `src/components/lesson/GenerateButton.tsx`, `src/components/lesson/CopilotPanel.tsx`, `src/pages/Lesson.tsx`, `src/components/lesson/ReadingMaterialView.tsx` | Loader visual reutilizable, parseo detallado de errores, feedback de estado y descarga PDF alternativa por Storage API. |
| F005 Parsing curricular bibliografico | `supabase/functions/_shared/curriculumImport.ts` | Deteccion de seccion bibliografia, normalizacion de autores repetidos, descarte de lineas de autoridad/artefactos, consolidacion de citas. |
| F006 Bootstrap curricular robusto | `supabase/functions/bootstrap-course-plan/index.ts` | `nodePools`, filtros de ruido, separacion core/bibliografia, mejor linkage `plan_lesson_content_links`, normalizacion de fundamentacion en parrafos. |
| F007 Generacion con validacion fuerte | `supabase/functions/generate-materials/index.ts` | Filtra solo fuentes bibliograficas validas, exige cierre "Fuentes de base del texto:", valida `data-ref` por nodo, conserva reintentos con razones. |
| F008 Esquema/tipos `curriculum_document_id` | `supabase/migrations/20260305113000_fix_courses_curriculum_link.sql`, `src/integrations/supabase/types.ts` | Migracion idempotente de columna+FK+indice y reflejo en tipos de `courses` (Row/Insert/Update/Relationships). |

## 3) Contratos de datos/API por flujo

### Flujo curso
- `resolve-curriculum-document` (edge function)
  - Request:
    - `province: string`
    - `subject: string`
    - `cycle: "BASIC" | "UPPER"`
    - `year_level: number`
    - `school_type?: "COMUN" | "TECNICA" | null`
    - `orientation?: string | null`
    - `speciality?: string | null`
  - Response:
    - `status: "resolved"` + `document`
    - `status: "ambiguous"` + `candidates[]`
    - `status: "not_found"` + `reason`
    - Siempre incluye `official_index_url` en casos funcionales.
- `check-course-limit` (edge function)
  - Response: `{ can_create: boolean, current: number, max: number }`
- Inserciones DB en alta:
  - `courses.insert({ user_id, school_id, subject, year_level, academic_year, orientation, speciality, curriculum_document_id })`
  - `plans.insert({ course_id })`
  - `plan_lessons.insert(28 filas: lesson_number, term)`
- `bootstrap-course-plan`
  - Request: `{ course_id, plan_id, curriculum_document_id }`
  - Response: `{ success, plan_status, synthetic_nodes_created, ...counts }`

### Flujo plan
- Lectura/edicion:
  - `plans.select/update`: `fundamentacion`, `estrategias_marco`, `estrategias_practicas[]`, `evaluacion_marco`, `resources`, `status`
- `validate_plan` (RPC)
  - Input: `{ p_plan_id: uuid }`
  - Output: `{ success: boolean, errors: string[] }`
  - Efecto si `success=true`:
    - `plans.status -> VALIDATED`
    - inserta `lessons` desde `plan_lessons` si no existian.

### Flujo leccion
- Lectura:
  - `lessons`, `plan_lessons`, `lesson_briefs`, `teaching_materials`, `reading_materials`
  - trazabilidad: `plan_lesson_content_links` + `plan_content_mappings` + `curriculum_nodes`
- Update brief:
  - `lesson_briefs.update({ nivel_profundidad, status: "READY_FOR_PRODUCTION" })`

### Flujo generacion
- `generate-materials` (edge function)
  - Request single: `{ lesson_id, regenerate_only?: "teaching" | "reading" }`
  - Request lote/sesion: `{ lesson_ids: string[], mode?: "full_session", regenerate_only?: ... }`
  - Reglas runtime:
    - Lecciones mismo `course_id`
    - `brief.status in (READY_FOR_PRODUCTION, PRODUCED)`
    - bibliografia confirmada no vacia y filtrada como fuente valida.
  - Response single:
    - `{ success, lesson_id, teaching_status, reading_status, reading_word_count, reading_pdf_pages, reading_pdf_url, reading_pdf_base64, reading_validation_issues, watermark_applied }`
  - Response multiple:
    - `{ success, mode, results[] }`

### Flujo busqueda curricular
- `resolve-curriculum-document`:
  - Busca primero candidatos locales `curriculum_documents(status=VERIFIED)`
  - Si no hay, intenta discovery en indices oficiales ABC y luego ingesta (`ingestCurriculumDocument`)
  - Ranking por `school_type`, `orientation`, `speciality` y dominio oficial.

## 4) Prompts y reglas de validacion actuales

### Prompt bootstrap (`bootstrap-course-plan`)
- Exige JSON estricto con:
  - `fundamentacion`, `estrategias_marco`, `estrategias_practicas[]`, `evaluacion_marco`, `resources`, `objectives[]`, `lessons[]`.
- Reglas duras:
  - `fundamentacion` minimo 450 palabras.
  - `objectives` entre 4 y 8.
  - `lessons` exactamente N (cantidad de `plan_lessons`).
  - `activities_summary` formato exacto: `Operacion: ... Evidencia minima: ...`.
  - Canon disciplinar especifico para FyHyCyT/Filosofia.

### Prompt teaching (`generate-materials`)
- Prompt de sistema incluye: contexto clase + continuidad secuencia + fuentes confirmadas + canon disciplinar.
- Tool schema `create_teaching_material` (function-calling) con campos obligatorios:
  - `purpose`, `activities[]`, `expected_product`, `achievement_criteria[]`, `differentiation[]`, `closure`.
- Validacion post-AI:
  - Debe existir `inicio/desarrollo/cierre`.
  - Debe incluir `apoyo` y `desafio`.
  - Si falla, marca `teaching_status=INVALIDATED`.

### Prompt reading (`generate-materials`)
- Reglas obligatorias clave:
  - 1000-1300 palabras.
  - HTML en parrafos `<p>`, sin listas ni subtitulos.
  - Sin consignas/preguntas al alumno.
  - Trazabilidad con `<span data-ref="ID"></span>` para nodos bibliograficos.
  - Ultimo parrafo inicia con `Fuentes de base del texto:`.
  - Restriccion anti-copia extensa (citas textuales cortas).
- Validacion programatica:
  - Sin `<ul>/<ol>/<li>` ni `<h1..h6>`.
  - Sin frases o resoluciones matematicas prohibidas.
  - `data-ref` presente para todos los nodos requeridos.
  - 1000-1300 palabras y PDF final 2-4 paginas.

### Validacion de plan (`validate_plan` RPC)
- Campos minimos no vacios en plan.
- `plan_objectives` entre 4 y 8.
- `plan_content_mappings` minimo 1.
- `plan_lessons` minimo 1 y cada clase con `theme/justification/learning_outcome/activities_summary`.
- Rechaza si curso archivado o si ya existen lecciones para curso nuevo.

## 5) Esquema de datos minimo requerido

### Entidades de dominio
- `schools`
- `curriculum_documents`
- `curriculum_nodes`
- `courses` (incluye `curriculum_document_id`)
- `plans`
- `plan_objectives`
- `plan_lessons`
- `plan_content_mappings`
- `plan_lesson_content_links`
- `lessons`
- `lesson_briefs`
- `teaching_materials`
- `reading_materials`

### Entidades de limites/plan comercial
- `subscriptions`
- `user_entitlements`
- `usage_counters`

### RPC/Funciones minimas
- `validate_plan(p_plan_id uuid)`
- `recalculate_entitlements(p_user_id, p_plan)` (si se usa `set-test-plan`)

## 6) Variables de entorno y dependencias minimas

### Modo sin Lovable/Supabase externo (recomendado para migracion)
Frontend (`.env`):
- `VITE_APP_MODE=studio`
- `VITE_DATA_PROVIDER=mock`
- `VITE_AI_PROVIDER=mock`
- `VITE_STUDIO_AUTO_LOGIN=true`

No requiere `VITE_SUPABASE_*` para iterar flujo UI/negocio en mock.

### Si se activa backend (opcional)
Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Edge functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- (opcional) `GEMINI_PLAN_MODEL`

### Dependencias minimas (NPM)
- Runtime UI: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `zod`.
- Cliente datos (mock + compat): `@supabase/supabase-js`.
- UI kit: `@radix-ui/*`, `tailwindcss`, `sonner`, `lucide-react`.
- Import curricular PDF: `pdfjs-dist`.

### Dependencias a evitar para este objetivo
- `@lovable.dev/cloud-auth-js`
- `lovable-tagger`

