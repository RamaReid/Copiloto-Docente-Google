# Patch Plan

## Objetivo
Portar avances funcionales desde el estado actual hacia `Copiloto-Docente-Google/main`, manteniendo compatibilidad sin dependencia de Lovable y con ejecucion en modo `studio/mock`.

## Prioridades y fases (3 fases)

### Fase 1 (P1) - UX y trazabilidad visible en frontend
Incluye:
- Loader reutilizable `ThinkingBook`.
- Mejor feedback de generacion en botones/paneles.
- Estilos de animacion y estado visual.

Archivos:
- `src/components/ui/ThinkingBook.tsx`
- `src/index.css`
- `src/components/lesson/GenerateButton.tsx`
- `src/components/lesson/CopilotPanel.tsx`

Riesgo:
- Bajo (solo UI, sin contrato de datos nuevo).

### Fase 2 (P1) - Flujo curso/plan/leccion
Incluye:
- Wizard de curso con contexto (orientacion/tecnicatura).
- Plan editor con tabs de contenidos/bibliografia y expandir campos.
- Bibliografia por leccion con filtro semantico.
- Manejo robusto de errores de generacion y descarga PDF alternativa.

Archivos:
- `src/pages/CourseNew.tsx`
- `src/components/plan/PlanEditor.tsx`
- `src/components/lesson/BibliographySelector.tsx`
- `src/pages/Lesson.tsx`
- `src/components/lesson/ReadingMaterialView.tsx`

Riesgo:
- Medio (toca flujos principales y algunos paths de datos).

### Fase 3 (P2) - Backend curricular/generacion + esquema
Incluye:
- Parsing de bibliografia en import curricular.
- Bootstrap de plan con pool de nodos y linkage estable.
- Generacion con validaciones de trazabilidad/fuentes.
- Ajuste idempotente de `courses.curriculum_document_id` y tipos TS.

Archivos:
- `supabase/functions/_shared/curriculumImport.ts`
- `supabase/functions/bootstrap-course-plan/index.ts`
- `supabase/functions/generate-materials/index.ts`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260305113000_fix_courses_curriculum_link.sql`

Riesgo:
- Medio/alto (cambia reglas de generacion y pipeline curricular).

## Orden de aplicacion recomendado

```bash
# sobre Copiloto-Docente-Google/main limpio
git apply migracion/migration_patches/phase1.patch
git apply migracion/migration_patches/phase2.patch
git apply migracion/migration_patches/phase3.patch
```

## Checklist de verificacion
- `npm run dev:studio` levanta sin credenciales externas.
- Alta curso: resuelve programa oficial, crea plan y bootstrap inicial.
- Validacion anual: `validate_plan` devuelve `success=true` en plan consistente.
- Generacion leccion: teaching+reading respetan reglas y trazabilidad de fuentes.
- Descarga PDF: funciona link directo y fallback por Storage API.

## Bloques de patch por fase

### Phase 1 Patch
```diff
diff --git a/src/components/ui/ThinkingBook.tsx b/src/components/ui/ThinkingBook.tsx
new file mode 100644
index 0000000..8155741
--- /dev/null
+++ b/src/components/ui/ThinkingBook.tsx
@@ -0,0 +1,30 @@
+import { cn } from "@/lib/utils";
+
+interface ThinkingBookProps {
+  title?: string;
+  detail?: string;
+  compact?: boolean;
+  className?: string;
+}
+
+export function ThinkingBook({
+  title = "Elaborando material...",
+  detail = "Esto puede tardar unos segundos.",
+  compact = false,
+  className,
+}: ThinkingBookProps) {
+  return (
+    <div className={cn("curriculum-book-loader", compact && "gap-2", className)}>
+      <div className={cn("curriculum-book-icon", compact && "h-8 w-8")} aria-hidden="true">
+        <span className="curriculum-book-cover" />
+        <span className="curriculum-book-page curriculum-book-page-1" />
+        <span className="curriculum-book-page curriculum-book-page-2" />
+        <span className="curriculum-book-page curriculum-book-page-3" />
+      </div>
+      <div className="space-y-1 text-sm text-muted-foreground">
+        <p>{title}</p>
+        <p className="text-xs">{detail}</p>
+      </div>
+    </div>
+  );
+}
diff --git a/src/index.css b/src/index.css
index 92a4226..11e91a2 100644
--- a/src/index.css
+++ b/src/index.css
@@ -121,3 +121,92 @@ All colors MUST be HSL.
     @apply bg-background text-foreground;
   }
 }
+
+@keyframes curriculum-book-float {
+  0%,
+  100% {
+    transform: translateY(0);
+  }
+  50% {
+    transform: translateY(-2px);
+  }
+}
+
+@keyframes curriculum-book-page-flip {
+  0% {
+    transform: rotateY(0deg);
+    opacity: 0.18;
+  }
+  20% {
+    opacity: 0.95;
+  }
+  65% {
+    transform: rotateY(-170deg);
+    opacity: 0.28;
+  }
+  100% {
+    transform: rotateY(-180deg);
+    opacity: 0;
+  }
+}
+
+.curriculum-book-loader {
+  display: flex;
+  align-items: center;
+  gap: 0.75rem;
+}
+
+.curriculum-book-icon {
+  position: relative;
+  width: 52px;
+  height: 34px;
+  border-radius: 0.6rem;
+  border: 1px solid hsl(var(--border));
+  background: linear-gradient(180deg, hsl(var(--accent)) 0%, hsl(var(--muted)) 100%);
+  box-shadow: inset 0 0 0 1px hsl(var(--background));
+  overflow: hidden;
+  perspective: 140px;
+  animation: curriculum-book-float 1.4s ease-in-out infinite;
+}
+
+.curriculum-book-cover {
+  position: absolute;
+  inset: 0;
+  border-radius: inherit;
+  background: linear-gradient(120deg, hsl(var(--primary) / 0.08), transparent 55%);
+}
+
+.curriculum-book-cover::after {
+  content: "";
+  position: absolute;
+  top: 4px;
+  bottom: 4px;
+  left: 50%;
+  width: 1px;
+  background: hsl(var(--primary) / 0.28);
+}
+
+.curriculum-book-page {
+  position: absolute;
+  top: 4px;
+  bottom: 4px;
+  left: 50%;
+  width: 44%;
+  border-radius: 0 0.45rem 0.45rem 0;
+  transform-origin: left center;
+  transform-style: preserve-3d;
+  background: hsl(var(--background));
+  box-shadow: inset -1px 0 0 hsl(var(--border));
+}
+
+.curriculum-book-page-1 {
+  animation: curriculum-book-page-flip 1.2s ease-in-out infinite;
+}
+
+.curriculum-book-page-2 {
+  animation: curriculum-book-page-flip 1.2s ease-in-out infinite 0.2s;
+}
+
+.curriculum-book-page-3 {
+  animation: curriculum-book-page-flip 1.2s ease-in-out infinite 0.4s;
+}
diff --git a/src/components/lesson/GenerateButton.tsx b/src/components/lesson/GenerateButton.tsx
index aa4f264..feb8957 100644
--- a/src/components/lesson/GenerateButton.tsx
+++ b/src/components/lesson/GenerateButton.tsx
@@ -1,5 +1,6 @@
 import { Button } from "@/components/ui/button";
-import { Loader2, Sparkles } from "lucide-react";
+import { Sparkles } from "lucide-react";
+import { ThinkingBook } from "@/components/ui/ThinkingBook";
 
 interface GenerateButtonProps {
   onClick: () => void;
@@ -9,18 +10,26 @@ interface GenerateButtonProps {
 
 export default function GenerateButton({ onClick, isGenerating, disabled }: GenerateButtonProps) {
   return (
-    <Button onClick={onClick} disabled={disabled || isGenerating} className="w-full">
-      {isGenerating ? (
-        <>
-          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
-          Generando...
-        </>
-      ) : (
+    <div className="space-y-2">
+      <Button onClick={onClick} disabled={disabled || isGenerating} className="w-full">
+        {isGenerating ? (
+          "Elaborando..."
+        ) : (
         <>
           <Sparkles className="mr-2 h-4 w-4" />
           Generar
         </>
+        )}
+      </Button>
+      {isGenerating && (
+        <div className="rounded-md border p-3">
+          <ThinkingBook
+            compact
+            title="El sistema esta elaborando la clase y materiales"
+            detail="No hace falta interactuar hasta que termine."
+          />
+        </div>
       )}
-    </Button>
+    </div>
   );
 }
diff --git a/src/components/lesson/CopilotPanel.tsx b/src/components/lesson/CopilotPanel.tsx
index f80f036..21923e2 100644
--- a/src/components/lesson/CopilotPanel.tsx
+++ b/src/components/lesson/CopilotPanel.tsx
@@ -5,6 +5,7 @@ import { Alert, AlertDescription } from "@/components/ui/alert";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { RefreshCw, Lock } from "lucide-react";
 import type { CopilotoMode } from "@/hooks/useEntitlements";
+import { ThinkingBook } from "@/components/ui/ThinkingBook";
 
 interface CurriculumNode {
   id: string;
@@ -52,6 +53,16 @@ export default function CopilotPanel({
         </Alert>
       )}
 
+      {isGenerating && (
+        <div className="rounded-md border p-3">
+          <ThinkingBook
+            compact
+            title="Copiloto en elaboracion"
+            detail="Esperando resultados de generacion."
+          />
+        </div>
+      )}
+
       <div className="space-y-2">
         <Label className="text-xs">Bibliografía usada</Label>
         <div className="space-y-1">


```

### Phase 2 Patch
```diff
diff --git a/src/pages/CourseNew.tsx b/src/pages/CourseNew.tsx
index 31c97b9..aef927c 100644
--- a/src/pages/CourseNew.tsx
+++ b/src/pages/CourseNew.tsx
@@ -1,4 +1,4 @@
-import { useEffect, useMemo, useState } from "react";
+﻿import { useEffect, useMemo, useState } from "react";
 import { Link, useNavigate, useSearchParams } from "react-router-dom";
 import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Upload } from "lucide-react";
 
@@ -14,6 +14,7 @@ import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@
 type SchoolType = "COMUN" | "TECNICA";
 type Cycle = "BASIC" | "UPPER";
 type ResolutionStatus = "idle" | "resolving" | "resolved" | "ambiguous" | "not_found" | "error";
+type CourseContextMode = "NINGUNA" | "ORIENTACION" | "TECNICATURA";
 
 interface SchoolOption {
   id: string;
@@ -47,14 +48,52 @@ interface SupportedProgram {
   speciality: string | null;
 }
 
+const ORIENTATION_SUGGESTIONS = [
+  "Ciencias Sociales",
+  "Ciencias Naturales",
+  "EconomÃ­a y AdministraciÃ³n",
+  "Arte",
+  "ComunicaciÃ³n",
+  "EducaciÃ³n FÃ­sica",
+  "Lenguas Extranjeras",
+];
+
+const TECH_SPECIALITY_SUGGESTIONS = [
+  "TÃ©cnico en AeronÃ¡utica",
+  "TÃ©cnico en Automotores",
+  "TÃ©cnico en AviÃ³nica",
+  "TÃ©cnico en ComputaciÃ³n",
+  "TÃ©cnico en ElectromecÃ¡nica",
+  "TÃ©cnico en ElectrÃ³nica",
+  "TÃ©cnico en Maestro Mayor de Obras",
+  "TÃ©cnico en Multimedios",
+  "TÃ©cnico en Naval",
+  "TÃ©cnico en QuÃ­mica",
+  "TÃ©cnico en Servicios TurÃ­sticos",
+  "TÃ©cnico en InformÃ¡tica Personal y Profesional",
+  "TÃ©cnico en AdministraciÃ³n de las Organizaciones",
+  "TÃ©cnico en ProducciÃ³n Agropecuaria con OrientaciÃ³n en Agroalimentos",
+  "InformÃ¡tica",
+  "ProgramaciÃ³n",
+  "Alimentos",
+  "AdministraciÃ³n agropecuaria",
+];
+
+const SPECIALITY_ALIAS_TO_CANON: Record<string, string> = {
+  informatica: "TÃ©cnico en InformÃ¡tica Personal y Profesional",
+  programacion: "TÃ©cnico en InformÃ¡tica Personal y Profesional",
+  alimentos: "TÃ©cnico en ProducciÃ³n Agropecuaria con OrientaciÃ³n en Agroalimentos",
+  "administracion agropecuaria": "TÃ©cnico en ProducciÃ³n Agropecuaria con OrientaciÃ³n en Agroalimentos",
+};
+
 function candidateScopeLabel(candidate: Pick<CurriculumCandidate, "school_type" | "orientation" | "speciality">): string {
   const parts = [
-    candidate.school_type || "Generico",
+    candidate.school_type || "GenÃ©rico",
     candidate.orientation || null,
     candidate.speciality || null,
   ].filter(Boolean);
 
-  return parts.join(" · ");
+  return parts.join(" | ");
 }
 
 function normalize(value: string | null | undefined): string {
@@ -81,6 +120,13 @@ function isMissingCurriculumColumnError(error: { message?: string } | null | und
   return message.includes("curriculum_document_id") && message.includes("courses");
 }
 
+function canonicalizeSpeciality(value: string): string {
+  const trimmed = value.trim();
+  if (!trimmed) return "";
+  const normalized = normalize(trimmed);
+  return SPECIALITY_ALIAS_TO_CANON[normalized] || trimmed;
+}
+
 function scoreCandidate(
   candidate: CurriculumCandidate,
   schoolType: SchoolType,
@@ -114,6 +160,7 @@ interface WizardState {
   cycle: Cycle | "";
   yearLevel: number | null;
   subject: string;
+  contextMode: CourseContextMode;
   orientation: string;
   speciality: string;
   newSchoolName: string;
@@ -123,6 +170,12 @@ interface WizardState {
   creatingNewSchool: boolean;
 }
 
+function contextModeLabel(value: CourseContextMode): string {
+  if (value === "ORIENTACION") return "OrientaciÃ³n";
+  if (value === "TECNICATURA") return "Tecnicatura";
+  return "Ninguna / Normal";
+}
+
 export default function CourseNew() {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
@@ -151,6 +204,11 @@ export default function CourseNew() {
     cycle: initialCycle,
     yearLevel: initialYearLevel,
     subject: searchParams.get("subject") || "",
+    contextMode: searchParams.get("speciality")
+      ? "TECNICATURA"
+      : searchParams.get("orientation")
+      ? "ORIENTACION"
+      : "NINGUNA",
     orientation: searchParams.get("orientation") || "",
     speciality: searchParams.get("speciality") || "",
     newSchoolName: "",
@@ -184,31 +242,31 @@ export default function CourseNew() {
         program.year_level === state.yearLevel
     );
   }, [state.cycle, state.subject, state.yearLevel, supportedPrograms]);
+  const manualOrientation = state.contextMode === "ORIENTACION";
+  const manualSpeciality = state.contextMode === "TECNICATURA";
   const needsOrientation = useMemo(() => {
+    if (manualOrientation) return state.cycle === "UPPER";
     if (!(state.cycle === "UPPER" && state.schoolType === "COMUN")) return false;
     return matchingPrograms.some((program) => !!program.orientation);
-  }, [matchingPrograms, state.cycle, state.schoolType]);
+  }, [manualOrientation, matchingPrograms, state.cycle, state.schoolType]);
   const needsSpeciality = useMemo(() => {
+    if (manualSpeciality) return state.cycle === "UPPER";
     if (!(state.cycle === "UPPER" && state.schoolType === "TECNICA")) return false;
     return matchingPrograms.some((program) => !!program.speciality);
-  }, [matchingPrograms, state.cycle, state.schoolType]);
+  }, [manualSpeciality, matchingPrograms, state.cycle, state.schoolType]);
 
-  const steps = useMemo(() => {
-    const base = [
+  const steps = useMemo(
+    () => [
       { num: 1, label: "Provincia" },
       { num: 2, label: "Materia" },
       { num: 3, label: "Escuela" },
       { num: 4, label: "Ciclo" },
-      { num: 5, label: "Ano" },
-    ];
-
-    if (needsOrientation) base.push({ num: 6, label: "Orientacion" });
-    if (needsSpeciality) base.push({ num: 7, label: "Especialidad" });
-
-    base.push({ num: 8, label: "Programa oficial" });
-    base.push({ num: 9, label: "Confirmacion" });
-    return base;
-  }, [needsOrientation, needsSpeciality]);
+      { num: 5, label: "AÃ±o" },
+      { num: 6, label: "Programa oficial" },
+      { num: 7, label: "ConfirmaciÃ³n" },
+    ],
+    []
+  );
 
   useEffect(() => {
     supabase
@@ -238,7 +296,7 @@ export default function CourseNew() {
     setResolutionError("");
     setCurriculumCandidates([]);
     setSelectedCurriculumId("");
-  }, [state.subject, state.cycle, state.yearLevel, state.schoolType, state.orientation, state.speciality]);
+  }, [state.subject, state.cycle, state.yearLevel, state.schoolType, state.contextMode, state.orientation, state.speciality]);
 
   useEffect(() => {
     if (!initialCurriculumId) return;
@@ -299,7 +357,7 @@ export default function CourseNew() {
             year_level: state.yearLevel,
             school_type: state.schoolType,
             orientation: needsOrientation ? state.orientation : null,
-            speciality: needsSpeciality ? state.speciality : null,
+            speciality: needsSpeciality ? canonicalizeSpeciality(state.speciality) : null,
           },
         });
 
@@ -336,7 +394,7 @@ export default function CourseNew() {
         setCurriculumCandidates([]);
         setSelectedCurriculumId("");
         setResolutionStatus("not_found");
-        setResolutionError(data?.reason || "No se encontro un programa disponible para esa combinacion.");
+        setResolutionError(data?.reason || "No se encontrÃ³ un programa disponible para esa combinaciÃ³n.");
       };
 
     resolveCurriculum();
@@ -363,16 +421,18 @@ export default function CourseNew() {
       case 2:
         return !!state.subject;
       case 3:
-        return !!state.schoolId;
+        return (
+          !!state.schoolId &&
+          (state.contextMode !== "ORIENTACION" || !!state.orientation.trim()) &&
+          (state.contextMode !== "TECNICATURA" || !!state.speciality.trim())
+        );
       case 4:
         return !!state.cycle;
       case 5:
         return !!state.yearLevel;
       case 6:
-        return !needsOrientation || !!state.orientation.trim();
+        return !!selectedCurriculumId && (resolutionStatus === "resolved" || resolutionStatus === "ambiguous");
       case 7:
-        return !needsSpeciality || !!state.speciality.trim();
-      case 8:
         return !!selectedCurriculumId && (resolutionStatus === "resolved" || resolutionStatus === "ambiguous");
       default:
         return true;
@@ -381,16 +441,12 @@ export default function CourseNew() {
 
   const nextStep = () => {
     let next = step + 1;
-    if (next === 6 && !needsOrientation) next++;
-    if (next === 7 && !needsSpeciality) next++;
-    if (next > 9) next = 9;
+    if (next > 7) next = 7;
     setStep(next);
   };
 
   const prevStep = () => {
     let prev = step - 1;
-    if (prev === 7 && !needsSpeciality) prev--;
-    if (prev === 6 && !needsOrientation) prev--;
     if (prev < 1) prev = 1;
     setStep(prev);
   };
@@ -435,7 +491,7 @@ export default function CourseNew() {
     if (!selectedCurriculumId) {
       toast({
         title: "Falta programa oficial",
-        description: "Resolve y confirma primero el programa oficial del curso.",
+        description: "ResolvÃ© y confirmÃ¡ primero el programa oficial del curso.",
         variant: "destructive",
       });
       return;
@@ -460,8 +516,8 @@ export default function CourseNew() {
 
       if (!limitData.can_create) {
         toast({
-          title: "Limite alcanzado",
-          description: `Alcanzaste el limite de cursos (${limitData.current}/${limitData.max})`,
+          title: "LÃ­mite alcanzado",
+          description: `Alcanzaste el lÃ­mite de cursos (${limitData.current}/${limitData.max})`,
           variant: "destructive",
         });
         return;
@@ -474,7 +530,7 @@ export default function CourseNew() {
         year_level: state.yearLevel!,
         academic_year: new Date().getFullYear(),
         orientation: needsOrientation ? state.orientation : null,
-        speciality: needsSpeciality ? state.speciality : null,
+        speciality: needsSpeciality ? canonicalizeSpeciality(state.speciality) : null,
       };
 
       const courseDetailUrl = (courseId: string) => {
@@ -538,7 +594,7 @@ export default function CourseNew() {
       if (bootstrapError) {
         toast({
           title: "Curso creado con bootstrap pendiente",
-          description: "El curso se creo, pero el borrador inicial del plan no pudo completarse automaticamente.",
+          description: "El curso se creÃ³, pero el borrador inicial del plan no pudo completarse automÃ¡ticamente.",
           variant: "destructive",
         });
         navigate(courseDetailUrl(course!.id));
@@ -550,11 +606,11 @@ export default function CourseNew() {
           ? {
               title: "Curso creado con compatibilidad",
               description:
-                "El curso se creo en una base sin curriculum_document_id. El entorno backend remoto aun no incorpora esa columna.",
+                "El curso se creÃ³ en una base sin curriculum_document_id. El backend remoto sigue desactualizado.",
             }
           : {
               title: "Curso creado",
-              description: "El curso quedo vinculado a su programa oficial y recibio un borrador inicial del plan.",
+              description: "El curso quedÃ³ vinculado a su programa oficial y recibiÃ³ un borrador inicial del plan.",
             }
       );
       navigate(courseDetailUrl(course!.id));
@@ -577,7 +633,7 @@ export default function CourseNew() {
           <div>
             <h1 className="text-lg font-semibold text-foreground">Nuevo curso</h1>
             <p className="text-sm text-muted-foreground">
-              Paso {steps.findIndex((item) => item.num === step) + 1} de {steps.length} -{" "}
+              Paso {steps.findIndex((item) => item.num === step) + 1} de {steps.length} â€”{" "}
               {steps.find((item) => item.num === step)?.label}
             </p>
           </div>
@@ -592,11 +648,9 @@ export default function CourseNew() {
               {step === 2 && "Materia"}
               {step === 3 && "Escuela"}
               {step === 4 && "Ciclo"}
-              {step === 5 && "Ano"}
-              {step === 6 && "Orientacion"}
-              {step === 7 && "Especialidad"}
-              {step === 8 && "Programa oficial"}
-              {step === 9 && "Confirmacion"}
+              {step === 5 && "AÃ±o"}
+              {step === 6 && "Programa oficial"}
+              {step === 7 && "ConfirmaciÃ³n"}
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
@@ -619,11 +673,12 @@ export default function CourseNew() {
                       subject: event.target.value,
                       cycle: "",
                       yearLevel: null,
+                      contextMode: "NINGUNA",
                       orientation: "",
                       speciality: "",
                     }))
                   }
-                  placeholder="Ej: Filosofia, Historia, Matematica..."
+                  placeholder="Ej: FilosofÃ­a, Historia, MatemÃ¡tica..."
                 />
               </div>
             )}
@@ -641,12 +696,12 @@ export default function CourseNew() {
                           setState((prev) => ({
                             ...prev,
                             schoolId: value,
-                            schoolType: school?.school_type || "COMUN",
+                            schoolType: prev.contextMode === "TECNICATURA" ? "TECNICA" : school?.school_type || "COMUN",
                           }));
                         }}
                       >
                         <SelectTrigger>
-                          <SelectValue placeholder="Elegi una escuela..." />
+                          <SelectValue placeholder="ElegÃ­ una escuela..." />
                         </SelectTrigger>
                         <SelectContent>
                           {schools.map((school) => (
@@ -657,6 +712,78 @@ export default function CourseNew() {
                         </SelectContent>
                       </Select>
                     </div>
+                    <div className="space-y-2">
+                      <Label>Modalidad del curso</Label>
+                      <Select
+                        value={state.contextMode}
+                        onValueChange={(value) =>
+                          setState((prev) => ({
+                            ...prev,
+                            contextMode: value as CourseContextMode,
+                            orientation: value === "ORIENTACION" ? prev.orientation : "",
+                            speciality: value === "TECNICATURA" ? prev.speciality : "",
+                            schoolType:
+                              value === "TECNICATURA"
+                                ? "TECNICA"
+                                : selectedSchool?.school_type || prev.schoolType,
+                          }))
+                        }
+                      >
+                        <SelectTrigger>
+                          <SelectValue />
+                        </SelectTrigger>
+                        <SelectContent>
+                          <SelectItem value="NINGUNA">Ninguna / Normal</SelectItem>
+                          <SelectItem value="ORIENTACION">OrientaciÃ³n</SelectItem>
+                          <SelectItem value="TECNICATURA">Tecnicatura</SelectItem>
+                        </SelectContent>
+                      </Select>
+                      <p className="text-xs text-muted-foreground">
+                        DefinÃ­ si este curso usa orientaciÃ³n, tecnicatura o ninguna modalidad extra.
+                      </p>
+                    </div>
+                    {state.contextMode === "ORIENTACION" && (
+                      <div className="space-y-2">
+                        <Label>OrientaciÃ³n</Label>
+                        <Input
+                          list="orientation-options"
+                          value={state.orientation}
+                          onChange={(event) =>
+                            setState((prev) => ({ ...prev, orientation: event.target.value }))
+                          }
+                          placeholder="Ej: Ciencias Sociales, EconomÃ­a y AdministraciÃ³n..."
+                        />
+                        <datalist id="orientation-options">
+                          {ORIENTATION_SUGGESTIONS.map((orientation) => (
+                            <option key={orientation} value={orientation} />
+                          ))}
+                        </datalist>
+                        <p className="text-xs text-muted-foreground">
+                          PodÃ©s elegir una sugerencia oficial o escribir una variante local.
+                        </p>
+                      </div>
+                    )}
+                    {state.contextMode === "TECNICATURA" && (
+                      <div className="space-y-2">
+                        <Label>Tecnicatura / especialidad</Label>
+                        <Input
+                          list="speciality-options"
+                          value={state.speciality}
+                          onChange={(event) =>
+                            setState((prev) => ({ ...prev, speciality: event.target.value }))
+                          }
+                          placeholder="Ej: TÃ©cnico en InformÃ¡tica Personal y Profesional..."
+                        />
+                        <datalist id="speciality-options">
+                          {TECH_SPECIALITY_SUGGESTIONS.map((speciality) => (
+                            <option key={speciality} value={speciality} />
+                          ))}
+                        </datalist>
+                        <p className="text-xs text-muted-foreground">
+                          Alias locales como â€œInformÃ¡ticaâ€ o â€œProgramaciÃ³nâ€ se normalizan al nombre canÃ³nico.
+                        </p>
+                      </div>
+                    )}
                     <Button
                       variant="outline"
                       size="sm"
@@ -710,8 +837,8 @@ export default function CourseNew() {
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
-                          <SelectItem value="COMUN">Comun</SelectItem>
-                          <SelectItem value="TECNICA">Tecnica</SelectItem>
+                          <SelectItem value="COMUN">ComÃºn</SelectItem>
+                          <SelectItem value="TECNICA">TÃ©cnica</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
@@ -742,17 +869,22 @@ export default function CourseNew() {
                       ...prev,
                       cycle: value as Cycle,
                       yearLevel: null,
-                      orientation: "",
-                      speciality: "",
+                      ...(value === "BASIC"
+                        ? {
+                            contextMode: "NINGUNA" as CourseContextMode,
+                            orientation: "",
+                            speciality: "",
+                          }
+                        : {}),
                     }))
                   }
                 >
                   <SelectTrigger>
-                        <SelectValue placeholder="Elegi ciclo..." />
+                        <SelectValue placeholder="ElegÃ­ ciclo..." />
                       </SelectTrigger>
                       <SelectContent>
                         {availableCycles.includes("BASIC") && (
-                          <SelectItem value="BASIC">Ciclo Basico (1 a 3)</SelectItem>
+                          <SelectItem value="BASIC">Ciclo BÃ¡sico (1 a 3)</SelectItem>
                         )}
                         {availableCycles.includes("UPPER") && (
                           <SelectItem value="UPPER">Ciclo Superior (4 a 6)</SelectItem>
@@ -760,14 +892,14 @@ export default function CourseNew() {
                       </SelectContent>
                     </Select>
                     <p className="text-xs text-muted-foreground">
-                      Selecciona el ciclo para ayudar a resolver el programa oficial correcto.
+                      SeleccionÃ¡ el ciclo para ayudar a resolver el programa oficial correcto.
                     </p>
               </div>
             )}
 
             {step === 5 && (
               <div className="space-y-2">
-                <Label>Ano</Label>
+                <Label>AÃ±o</Label>
                 <Select
                   value={state.yearLevel?.toString() || ""}
                   onValueChange={(value) =>
@@ -775,60 +907,45 @@ export default function CourseNew() {
                   }
                 >
                   <SelectTrigger>
-                    <SelectValue placeholder="Elegi ano..." />
+                    <SelectValue placeholder="ElegÃ­ aÃ±o..." />
                   </SelectTrigger>
                   <SelectContent>
                     {yearOptions.map((year) => (
                       <SelectItem key={year} value={year.toString()}>
-                        {year} ano
+                        {year} aÃ±o
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 <p className="text-xs text-muted-foreground">
-                  Selecciona el ano para ajustar la resolucion del diseno curricular.
+                  SeleccionÃ¡ el aÃ±o para ajustar la resoluciÃ³n del diseÃ±o curricular.
                 </p>
               </div>
             )}
 
-            {step === 6 && needsOrientation && (
-              <div className="space-y-2">
-                <Label>Orientacion</Label>
-                <Input
-                  value={state.orientation}
-                  onChange={(event) =>
-                    setState((prev) => ({ ...prev, orientation: event.target.value }))
-                  }
-                  placeholder="Ej: Ciencias Sociales, Economia y Administracion..."
-                />
-              </div>
-            )}
-
-            {step === 7 && needsSpeciality && (
-              <div className="space-y-2">
-                <Label>Especialidad</Label>
-                <Input
-                  value={state.speciality}
-                  onChange={(event) =>
-                    setState((prev) => ({ ...prev, speciality: event.target.value }))
-                  }
-                  placeholder="Ej: Electromecanica, Informatica..."
-                />
-              </div>
-            )}
-
-            {step === 8 && (
+            {step === 6 && (
               <div className="space-y-4">
                 <div className="space-y-1">
                   <Label>Programa oficial</Label>
                   <p className="text-sm text-muted-foreground">
-                    Antes de crear el curso resolvemos el diseno curricular oficial para que la planificacion tenga una base curricular explicita.
+                    Antes de crear el curso resolvemos el diseÃ±o curricular oficial para que la planificaciÃ³n tenga una base curricular explÃ­cita.
                   </p>
                 </div>
 
                 {resolutionStatus === "resolving" && (
-                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
-                    Buscando y resolviendo el programa oficial correspondiente...
+                  <div className="rounded-md border p-4">
+                    <div className="curriculum-book-loader">
+                      <div className="curriculum-book-icon" aria-hidden="true">
+                        <span className="curriculum-book-cover" />
+                        <span className="curriculum-book-page curriculum-book-page-1" />
+                        <span className="curriculum-book-page curriculum-book-page-2" />
+                        <span className="curriculum-book-page curriculum-book-page-3" />
+                      </div>
+                      <div className="space-y-1 text-sm text-muted-foreground">
+                        <p>Buscando y resolviendo el programa oficial correspondiente...</p>
+                        <p className="text-xs">Revisamos base curricular, coincidencias y dominio oficial.</p>
+                      </div>
+                    </div>
                   </div>
                 )}
 
@@ -836,7 +953,7 @@ export default function CourseNew() {
                   <div className="space-y-3 rounded-md border p-4">
                     {resolutionStatus === "ambiguous" && curriculumCandidates.length > 1 && (
                       <div className="space-y-2">
-                        <Label>Elegi el documento correcto</Label>
+                        <Label>ElegÃ­ el documento correcto</Label>
                         <Select value={selectedCurriculumId} onValueChange={setSelectedCurriculumId}>
                           <SelectTrigger>
                             <SelectValue />
@@ -861,7 +978,7 @@ export default function CourseNew() {
                       </p>
                       <p>
                         <span className="text-muted-foreground">Dominio oficial:</span>{" "}
-                        {selectedCurriculum.is_official_domain ? "Si" : "No verificado"}
+                        {selectedCurriculum.is_official_domain ? "SÃ­" : "No verificado"}
                       </p>
                     </div>
 
@@ -877,7 +994,7 @@ export default function CourseNew() {
                       </a>
                     ) : (
                       <p className="text-sm text-muted-foreground">
-                        El documento fue resuelto en la base curricular pero todavia no tiene URL oficial registrada.
+                        El documento fue resuelto en la base curricular, pero todavÃ­a no tiene URL oficial registrada.
                       </p>
                     )}
                   </div>
@@ -886,9 +1003,9 @@ export default function CourseNew() {
                 {resolutionStatus === "ambiguous" && !selectedCurriculum && curriculumCandidates.length > 0 && (
                   <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 p-4">
                     <div className="space-y-1">
-                      <p className="text-sm font-medium">Hay mas de un programa posible para esta combinacion.</p>
+                      <p className="text-sm font-medium">Hay mÃ¡s de un programa posible para esta combinaciÃ³n.</p>
                       <p className="text-sm text-muted-foreground">
-                        Revise el alcance de cada documento y seleccione manualmente el correcto antes de crear el curso.
+                        RevisÃ¡ el alcance de cada documento y seleccionÃ¡ manualmente el correcto antes de crear el curso.
                       </p>
                     </div>
                     <div className="space-y-2">
@@ -904,7 +1021,7 @@ export default function CourseNew() {
                             {candidateScopeLabel(candidate)}
                           </p>
                           <p className="text-xs text-muted-foreground">
-                            Fuente: {candidate.source_provider} · Dominio oficial: {candidate.is_official_domain ? "Si" : "No verificado"}
+                            Fuente: {candidate.source_provider} | Dominio oficial: {candidate.is_official_domain ? "SÃ­" : "No verificado"}
                           </p>
                         </button>
                       ))}
@@ -930,7 +1047,7 @@ export default function CourseNew() {
                       rel="noreferrer"
                       className="inline-flex items-center gap-2 underline underline-offset-4"
                     >
-                      Revisar indice oficial de disenos curriculares
+                      Revisar Ã­ndice oficial de diseÃ±os curriculares
                       <ExternalLink className="h-4 w-4" />
                     </a>
                   </div>
@@ -938,7 +1055,7 @@ export default function CourseNew() {
               </div>
             )}
 
-            {step === 9 && (
+            {step === 7 && (
               <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-2 text-sm">
                   <span className="text-muted-foreground">Provincia:</span>
@@ -950,19 +1067,21 @@ export default function CourseNew() {
                   <span className="text-muted-foreground">Tipo:</span>
                   <span>{state.schoolType}</span>
                   <span className="text-muted-foreground">Ciclo:</span>
-                  <span>{state.cycle === "BASIC" ? "Basico" : "Superior"}</span>
-                  <span className="text-muted-foreground">Ano:</span>
+                  <span>{state.cycle === "BASIC" ? "BÃ¡sico" : "Superior"}</span>
+                  <span className="text-muted-foreground">AÃ±o:</span>
                   <span>{state.yearLevel}</span>
+                  <span className="text-muted-foreground">Modalidad:</span>
+                  <span>{contextModeLabel(state.contextMode)}</span>
                   {needsOrientation && (
                     <>
-                      <span className="text-muted-foreground">Orientacion:</span>
+                      <span className="text-muted-foreground">OrientaciÃ³n:</span>
                       <span>{state.orientation}</span>
                     </>
                   )}
                   {needsSpeciality && (
                     <>
                       <span className="text-muted-foreground">Especialidad:</span>
-                      <span>{state.speciality}</span>
+                      <span>{canonicalizeSpeciality(state.speciality)}</span>
                     </>
                   )}
                   <span className="text-muted-foreground">Programa oficial:</span>
@@ -976,7 +1095,7 @@ export default function CourseNew() {
                 <ArrowLeft className="h-4 w-4 mr-2" />
                 Anterior
               </Button>
-              {step === 9 ? (
+              {step === 7 ? (
                 <Button onClick={handleCreate} disabled={creating}>
                   {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                   Crear curso
@@ -994,3 +1113,4 @@ export default function CourseNew() {
     </div>
   );
 }
+
diff --git a/src/components/plan/PlanEditor.tsx b/src/components/plan/PlanEditor.tsx
index 2e35f41..b7e8228 100644
--- a/src/components/plan/PlanEditor.tsx
+++ b/src/components/plan/PlanEditor.tsx
@@ -7,7 +7,8 @@ import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Label } from "@/components/ui/label";
-import { X, Plus, RotateCcw, ShieldCheck } from "lucide-react";
+import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
+import { X, Plus, RotateCcw, ShieldCheck, Maximize2 } from "lucide-react";
 import { toast } from "@/hooks/use-toast";
 import PlanObjectivesEditor from "./PlanObjectivesEditor";
 import PlanLessonsEditor from "./PlanLessonsEditor";
@@ -21,6 +22,22 @@ interface PlanData {
   resources: string;
 }
 
+interface MappedCurriculumNode {
+  id: string;
+  name: string;
+  node_type: string;
+  order_index?: number | null;
+}
+
+type ExpandableField = "fundamentacion" | "estrategias_marco" | "evaluacion_marco" | "resources";
+
+const fieldTitles: Record<ExpandableField, string> = {
+  fundamentacion: "Fundamentacion",
+  estrategias_marco: "Estrategias marco",
+  evaluacion_marco: "Evaluacion marco",
+  resources: "Recursos",
+};
+
 interface Props {
   planId: string;
   courseId: string;
@@ -84,6 +101,37 @@ function buildRepairGuidance(errors: string[]) {
   return Array.from(new Set([...steps, ...lessonRepairs]));
 }
 
+function isLikelyBibliographyNode(name: string): boolean {
+  const trimmed = name.trim();
+  const commaCount = (trimmed.match(/,/g) || []).length;
+  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(trimmed);
+  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(trimmed);
+  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(trimmed);
+
+  return hasAuthorPrefix && commaCount >= 2 && (hasYear || hasEditionFallback || commaCount >= 3);
+}
+
+function isAuthorityOrNoiseNode(name: string): boolean {
+  const normalized = name
+    .normalize("NFD")
+    .replace(/[\u0300-\u036f]/g, "")
+    .toLowerCase()
+    .replace(/\s+/g, "");
+
+  return (
+    normalized.includes("isbn") ||
+    normalized.includes("cdd") ||
+    normalized.includes("disenocurricular") ||
+    normalized.includes("educacionsecundaria") ||
+    normalized.includes("directorageneral") ||
+    normalized.includes("presidentadelconsejo") ||
+    normalized.includes("subsecretariadeeducacion") ||
+    normalized.includes("directoraprovincial") ||
+    normalized.includes("equipodeespecialistas") ||
+    normalized.includes("autoridades")
+  );
+}
+
 export default function PlanEditor({
   planId,
   courseId,
@@ -98,6 +146,8 @@ export default function PlanEditor({
   const [bootstrapping, setBootstrapping] = useState(false);
   const [validationErrors, setValidationErrors] = useState<string[]>([]);
   const [newStrategy, setNewStrategy] = useState("");
+  const [expandedField, setExpandedField] = useState<ExpandableField | null>(null);
+  const [mappedNodes, setMappedNodes] = useState<MappedCurriculumNode[]>([]);
   const [currentStatus, setCurrentStatus] = useState(planStatus);
   const [hasEditedAfterValidation, setHasEditedAfterValidation] = useState(false);
   const transitioningRef = useRef(false);
@@ -111,6 +161,27 @@ export default function PlanEditor({
     setHasEditedAfterValidation(planStatus === "EDITED");
   }, [planStatus]);
 
+  const fetchMappedNodes = useCallback(async () => {
+    const { data: mappings } = await supabase
+      .from("plan_content_mappings")
+      .select("curriculum_node_id")
+      .eq("plan_id", planId);
+
+    const nodeIds = Array.from(new Set((mappings || []).map((mapping) => mapping.curriculum_node_id)));
+    if (nodeIds.length === 0) {
+      setMappedNodes([]);
+      return;
+    }
+
+    const { data: nodes } = await supabase
+      .from("curriculum_nodes")
+      .select("id, name, node_type, order_index")
+      .in("id", nodeIds)
+      .order("order_index");
+
+    setMappedNodes((nodes || []) as MappedCurriculumNode[]);
+  }, [planId]);
+
   useEffect(() => {
     const fetch = async () => {
       const { data } = await supabase
@@ -120,11 +191,12 @@ export default function PlanEditor({
         .single();
 
       if (data) setPlan(data);
+      await fetchMappedNodes();
       setLoading(false);
     };
 
     fetch();
-  }, [planId]);
+  }, [planId, fetchMappedNodes]);
 
   const transitionToEdited = useCallback(async () => {
     if (transitioningRef.current || readOnly) return;
@@ -207,6 +279,7 @@ export default function PlanEditor({
         .single();
 
       if (refreshedPlan) setPlan(refreshedPlan);
+      await fetchMappedNodes();
 
       const nextStatus =
         data?.plan_status === "EDITED" || data?.plan_status === "VALIDATED" ? data.plan_status : "INCOMPLETE";
@@ -282,6 +355,10 @@ export default function PlanEditor({
     }
   };
 
+  const visibleMappedNodes = mappedNodes.filter((node) => !isAuthorityOrNoiseNode(node.name));
+  const bibliographyNodes = visibleMappedNodes.filter((node) => isLikelyBibliographyNode(node.name));
+  const curricularNodes = visibleMappedNodes.filter((node) => !isLikelyBibliographyNode(node.name));
+
   const ctaLabel = currentStatus === "EDITED" ? "Validar cambios" : "Validar plan";
   const showCta = !readOnly && !courseArchived && currentStatus !== "VALIDATED";
 
@@ -332,36 +409,52 @@ export default function PlanEditor({
         )}
 
         <Tabs defaultValue="fundamentacion">
-          <TabsList className="grid w-full grid-cols-6">
+          <TabsList className="grid w-full grid-cols-8">
             <TabsTrigger value="fundamentacion">Fundamentacion</TabsTrigger>
             <TabsTrigger value="estrategias">Estrategias</TabsTrigger>
             <TabsTrigger value="evaluacion">Evaluacion</TabsTrigger>
             <TabsTrigger value="recursos">Recursos</TabsTrigger>
+            <TabsTrigger value="contenidos">Contenidos</TabsTrigger>
+            <TabsTrigger value="bibliografia">Bibliografia</TabsTrigger>
             <TabsTrigger value="propositos">Propositos</TabsTrigger>
             <TabsTrigger value="clases">Clases</TabsTrigger>
           </TabsList>
 
           <TabsContent value="fundamentacion" className="space-y-2 pt-2">
-            <Label>Fundamentacion</Label>
+            <div className="flex items-center justify-between gap-2">
+              <Label>Fundamentacion</Label>
+              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("fundamentacion")}>
+                <Maximize2 className="mr-2 h-4 w-4" />
+                Expandir
+              </Button>
+            </div>
             <Textarea
               value={plan.fundamentacion}
               onChange={(e) => updateField("fundamentacion", e.target.value)}
               placeholder="Escribir la fundamentacion del plan..."
               rows={6}
               disabled={readOnly}
+              onDoubleClick={() => setExpandedField("fundamentacion")}
             />
             <p className="text-xs text-muted-foreground">{plan.fundamentacion.length} caracteres</p>
           </TabsContent>
 
           <TabsContent value="estrategias" className="space-y-4 pt-2">
             <div className="space-y-2">
-              <Label>Estrategias marco</Label>
+              <div className="flex items-center justify-between gap-2">
+                <Label>Estrategias marco</Label>
+                <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("estrategias_marco")}>
+                  <Maximize2 className="mr-2 h-4 w-4" />
+                  Expandir
+                </Button>
+              </div>
               <Textarea
                 value={plan.estrategias_marco}
                 onChange={(e) => updateField("estrategias_marco", e.target.value)}
                 placeholder="Describir las estrategias generales..."
                 rows={4}
                 disabled={readOnly}
+                onDoubleClick={() => setExpandedField("estrategias_marco")}
               />
             </div>
 
@@ -396,27 +489,85 @@ export default function PlanEditor({
           </TabsContent>
 
           <TabsContent value="evaluacion" className="space-y-2 pt-2">
-            <Label>Evaluacion marco</Label>
+            <div className="flex items-center justify-between gap-2">
+              <Label>Evaluacion marco</Label>
+              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("evaluacion_marco")}>
+                <Maximize2 className="mr-2 h-4 w-4" />
+                Expandir
+              </Button>
+            </div>
             <Textarea
               value={plan.evaluacion_marco}
               onChange={(e) => updateField("evaluacion_marco", e.target.value)}
               placeholder="Describir el marco de evaluacion..."
               rows={6}
               disabled={readOnly}
+              onDoubleClick={() => setExpandedField("evaluacion_marco")}
             />
           </TabsContent>
 
           <TabsContent value="recursos" className="space-y-2 pt-2">
-            <Label>Recursos</Label>
+            <div className="flex items-center justify-between gap-2">
+              <Label>Recursos</Label>
+              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("resources")}>
+                <Maximize2 className="mr-2 h-4 w-4" />
+                Expandir
+              </Button>
+            </div>
             <Textarea
               value={plan.resources}
               onChange={(e) => updateField("resources", e.target.value)}
               placeholder="Describir materiales, soportes y alternativas low-tech..."
               rows={5}
               disabled={readOnly}
+              onDoubleClick={() => setExpandedField("resources")}
             />
           </TabsContent>
 
+          <TabsContent value="contenidos" className="space-y-4 pt-2">
+            <div className="rounded-md border p-3">
+              <p className="text-sm font-medium">Nodos curriculares del plan</p>
+              <p className="text-xs text-muted-foreground">
+                {curricularNodes.length} nodos mapeados para trazabilidad de clases.
+              </p>
+              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
+                {curricularNodes.length > 0 ? (
+                  curricularNodes.map((node) => (
+                    <p key={node.id} className="text-sm">
+                      <span className="font-medium text-muted-foreground">[{node.node_type}]</span> {node.name}
+                    </p>
+                  ))
+                ) : (
+                  <p className="text-sm text-muted-foreground">
+                    No hay nodos curriculares mapeados. Revisa el programa oficial y vuelve a rearmar el borrador.
+                  </p>
+                )}
+              </div>
+            </div>
+          </TabsContent>
+
+          <TabsContent value="bibliografia" className="space-y-4 pt-2">
+            <div className="rounded-md border p-3">
+              <p className="text-sm font-medium">Bibliografia detectada</p>
+              <p className="text-xs text-muted-foreground">
+                {bibliographyNodes.length} fuentes detectadas para soporte de brief y materiales.
+              </p>
+              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
+                {bibliographyNodes.length > 0 ? (
+                  bibliographyNodes.map((node) => (
+                    <p key={node.id} className="text-sm">
+                      <span className="font-medium text-muted-foreground">[FUENTE]</span> {node.name}
+                    </p>
+                  ))
+                ) : (
+                  <p className="text-sm text-muted-foreground">
+                    No se detectaron fuentes bibliograficas en el mapeo actual. Reimporta el programa y rearma el borrador.
+                  </p>
+                )}
+              </div>
+            </div>
+          </TabsContent>
+
           <TabsContent value="propositos" className="pt-2">
             <PlanObjectivesEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} />
           </TabsContent>
@@ -432,6 +583,26 @@ export default function PlanEditor({
             {validating ? "Validando..." : ctaLabel}
           </Button>
         )}
+
+        <Dialog open={!!expandedField} onOpenChange={(open) => !open && setExpandedField(null)}>
+          <DialogContent className="max-w-5xl">
+            <DialogHeader>
+              <DialogTitle>{expandedField ? fieldTitles[expandedField] : "Editor"}</DialogTitle>
+            </DialogHeader>
+            {expandedField && (
+              <div className="space-y-2">
+                <Textarea
+                  value={plan[expandedField]}
+                  onChange={(event) => updateField(expandedField, event.target.value)}
+                  rows={24}
+                  disabled={readOnly}
+                  className="max-h-[70vh] min-h-[60vh]"
+                />
+                <p className="text-xs text-muted-foreground">{plan[expandedField].length} caracteres</p>
+              </div>
+            )}
+          </DialogContent>
+        </Dialog>
       </CardContent>
     </Card>
   );
diff --git a/src/components/lesson/BibliographySelector.tsx b/src/components/lesson/BibliographySelector.tsx
index 057229f..edcd9cc 100644
--- a/src/components/lesson/BibliographySelector.tsx
+++ b/src/components/lesson/BibliographySelector.tsx
@@ -11,13 +11,53 @@ interface Node {
 
 interface BibliographySelectorProps {
   courseId: string;
+  lessonId?: string;
   selected: string[];
   onChange: (ids: string[]) => void;
   disabled?: boolean;
 }
 
+function normalizeName(value: string): string {
+  return value
+    .normalize("NFD")
+    .replace(/[\u0300-\u036f]/g, "")
+    .toLowerCase()
+    .replace(/\s+/g, " ")
+    .trim();
+}
+
+function shouldHideNode(name: string): boolean {
+  const normalized = normalizeName(name);
+  return (
+    normalized.startsWith("isbn ") ||
+    normalized.startsWith("cdd ") ||
+    normalized === "equipo de especialistas" ||
+    normalized.startsWith("diseno curricular para") ||
+    normalized.startsWith("educacion secundaria") ||
+    /^lic\.\s+/.test(normalized)
+  );
+}
+
+function isLikelyBibliographyEntry(name: string): boolean {
+  if (shouldHideNode(name)) return false;
+
+  const normalized = normalizeName(name);
+  const commaCount = (name.match(/,/g) || []).length;
+  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(name);
+  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(name);
+  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(name.trim());
+
+  if (normalized.includes("dgcye | diseno curricular")) return false;
+  if (!hasAuthorPrefix) return false;
+  if (commaCount < 3) return false;
+  if (!hasYear && !hasEditionFallback && commaCount < 4) return false;
+
+  return true;
+}
+
 export default function BibliographySelector({
   courseId,
+  lessonId,
   selected,
   onChange,
   disabled,
@@ -27,36 +67,115 @@ export default function BibliographySelector({
 
   useEffect(() => {
     const fetchNodes = async () => {
-      const { data: plan } = await supabase.from("plans").select("id").eq("course_id", courseId).single();
-
-      if (!plan) {
+      setLoading(true);
+
+      const cleanCandidates = (rawNodes: Array<Node & { order_index?: number }>): Node[] => {
+        const contentFirst = rawNodes.filter((node) =>
+          ["CONTENIDO", "BLOQUE", "UNIDAD"].includes(node.node_type)
+        );
+        const candidates = contentFirst.length > 0 ? contentFirst : rawNodes;
+        const bibliographyOnly = candidates.filter((node) => isLikelyBibliographyEntry(node.name));
+        const filtered = bibliographyOnly.filter((node) => !shouldHideNode(node.name));
+        const dedupMap = new Map<string, Node>();
+        filtered.forEach((node) => {
+          const key = `${node.node_type}:${normalizeName(node.name)}`;
+          if (!dedupMap.has(key)) dedupMap.set(key, node);
+        });
+        return Array.from(dedupMap.values());
+      };
+
+      const fetchNodesByIds = async (ids: string[]): Promise<Node[]> => {
+        const dedupedIds = Array.from(new Set(ids.filter(Boolean)));
+        if (dedupedIds.length === 0) return [];
+
+        const { data: nodesData } = await supabase
+          .from("curriculum_nodes")
+          .select("id, name, node_type, order_index")
+          .in("id", dedupedIds)
+          .order("order_index");
+
+        return cleanCandidates((nodesData || []) as Array<Node & { order_index?: number }>);
+      };
+
+      try {
+        const { data: plan } = await supabase.from("plans").select("id").eq("course_id", courseId).single();
+        if (!plan) {
+          setNodes([]);
+          return;
+        }
+
+        const nodeIdSources: string[][] = [];
+
+        if (lessonId) {
+          const { data: lesson } = await supabase
+            .from("lessons")
+            .select("plan_lesson_id")
+            .eq("id", lessonId)
+            .maybeSingle();
+
+          if (lesson?.plan_lesson_id) {
+            const { data: links } = await supabase
+              .from("plan_lesson_content_links")
+              .select("plan_content_mapping_id")
+              .eq("plan_lesson_id", lesson.plan_lesson_id);
+
+            const mappingIds = (links || []).map((link) => link.plan_content_mapping_id);
+            if (mappingIds.length > 0) {
+              const { data: lessonMappings } = await supabase
+                .from("plan_content_mappings")
+                .select("curriculum_node_id")
+                .in("id", mappingIds);
+
+              nodeIdSources.push((lessonMappings || []).map((mapping) => mapping.curriculum_node_id));
+            }
+          }
+        }
+
+        const { data: planMappings } = await supabase
+          .from("plan_content_mappings")
+          .select("curriculum_node_id")
+          .eq("plan_id", plan.id);
+
+        if ((planMappings || []).length > 0) {
+          nodeIdSources.push((planMappings || []).map((mapping) => mapping.curriculum_node_id));
+        }
+
+        for (const sourceIds of nodeIdSources) {
+          const resolved = await fetchNodesByIds(sourceIds);
+          if (resolved.length > 0) {
+            setNodes(resolved);
+            return;
+          }
+        }
+
+        const { data: courseData, error: courseError } = await supabase
+          .from("courses")
+          .select("curriculum_document_id")
+          .eq("id", courseId)
+          .maybeSingle();
+
+        if (!courseError && courseData?.curriculum_document_id) {
+          const { data: documentNodes } = await supabase
+            .from("curriculum_nodes")
+            .select("id, name, node_type, order_index")
+            .eq("curriculum_document_id", courseData.curriculum_document_id)
+            .order("order_index");
+
+          const fromDocument = cleanCandidates((documentNodes || []) as Array<Node & { order_index?: number }>);
+          if (fromDocument.length > 0) {
+            setNodes(fromDocument);
+            return;
+          }
+        }
+
+        setNodes([]);
+      } finally {
         setLoading(false);
-        return;
       }
-
-      const { data: mappings } = await supabase
-        .from("plan_content_mappings")
-        .select("curriculum_node_id")
-        .eq("plan_id", plan.id);
-
-      if (!mappings || mappings.length === 0) {
-        setLoading(false);
-        return;
-      }
-
-      const nodeIds = mappings.map((mapping) => mapping.curriculum_node_id);
-      const { data: nodesData } = await supabase
-        .from("curriculum_nodes")
-        .select("id, name, node_type")
-        .in("id", nodeIds)
-        .order("order_index");
-
-      setNodes(nodesData || []);
-      setLoading(false);
     };
 
     fetchNodes();
-  }, [courseId]);
+  }, [courseId, lessonId]);
 
   const toggle = (nodeId: string) => {
     if (disabled) return;
@@ -75,7 +194,11 @@ export default function BibliographySelector({
   }
 
   if (nodes.length === 0) {
-    return <p className="text-sm text-muted-foreground">No hay contenidos curriculares mapeados en el plan.</p>;
+    return (
+      <p className="text-sm text-muted-foreground">
+        No hay fuentes curriculares limpias para esta clase. Revisa mapeos de contenidos en la anual.
+      </p>
+    );
   }
 
   return (
@@ -90,7 +213,7 @@ export default function BibliographySelector({
               disabled={disabled || (!selected.includes(node.id) && selected.length >= 5)}
             />
             <div className="text-sm">
-              <span className="font-medium text-muted-foreground">[{node.node_type}]</span> {node.name}
+              <span className="font-medium text-muted-foreground">[FUENTE]</span> {node.name}
             </div>
           </div>
         ))}
diff --git a/src/pages/Lesson.tsx b/src/pages/Lesson.tsx
index 21d3e10..e694d82 100644
--- a/src/pages/Lesson.tsx
+++ b/src/pages/Lesson.tsx
@@ -16,6 +16,7 @@ import { useEntitlements } from "@/hooks/useEntitlements";
 import { StatusBadge, briefLabel, briefTone, materialLabel, materialTone, lessonStatusLabel, lessonStatusTone } from "@/components/ui/StatusBadge";
 import { StepHeader } from "@/components/ui/StepHeader";
 import { SkeletonList } from "@/components/ui/SkeletonList";
+import { ThinkingBook } from "@/components/ui/ThinkingBook";
 
 function extractCanonSummary(activitiesSummary?: string | null, fallbackTheme?: string | null) {
   const summary = (activitiesSummary || "").trim();
@@ -37,6 +38,53 @@ function extractCanonSummary(activitiesSummary?: string | null, fallbackTheme?:
   };
 }
 
+function isLikelyBibliographyEntry(name: string): boolean {
+  const trimmed = name.trim();
+  const commaCount = (trimmed.match(/,/g) || []).length;
+  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(trimmed);
+  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(trimmed);
+  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(trimmed);
+
+  return hasAuthorPrefix && commaCount >= 2 && (hasYear || hasEditionFallback || commaCount >= 3);
+}
+
+function isNoiseNode(name: string): boolean {
+  const normalized = name
+    .normalize("NFD")
+    .replace(/[\u0300-\u036f]/g, "")
+    .toLowerCase()
+    .replace(/\s+/g, "");
+
+  return (
+    normalized.includes("isbn") ||
+    normalized.includes("cdd") ||
+    normalized.includes("disenocurricular") ||
+    normalized.includes("educacionsecundaria") ||
+    normalized.includes("directorageneral") ||
+    normalized.includes("presidentadelconsejo") ||
+    normalized.includes("subsecretariadeeducacion") ||
+    normalized.includes("directoraprovincial") ||
+    normalized.includes("autoridades")
+  );
+}
+
+async function parseFunctionErrorMessage(error: any): Promise<string> {
+  if (!error) return "Error desconocido";
+  if (typeof error.message === "string" && !error.context) return error.message;
+
+  try {
+    const context = error.context as Response | undefined;
+    if (context) {
+      const payload = await context.json();
+      if (payload?.error) return payload.error;
+    }
+  } catch {
+    // Ignore context parsing errors.
+  }
+
+  return typeof error.message === "string" ? error.message : "Error desconocido";
+}
+
 export default function Lesson() {
   const { lessonId } = useParams<{ lessonId: string }>();
   const { entitlements } = useEntitlements();
@@ -97,7 +145,7 @@ export default function Lesson() {
             .select("id, name, node_type")
             .in("id", nodeIds)
             .order("order_index");
-          setMappedCurriculumNodes(mappedNodes || []);
+          setMappedCurriculumNodes((mappedNodes || []).filter((node) => !isNoiseNode(node.name)));
         } else {
           setMappedCurriculumNodes([]);
         }
@@ -113,7 +161,8 @@ export default function Lesson() {
         .from("curriculum_nodes")
         .select("id, name, node_type")
         .in("id", briefRes.data.bibliografia_confirmada);
-      setBibliographyNodes(nodes || []);
+      const filteredSources = (nodes || []).filter((node) => isLikelyBibliographyEntry(node.name));
+      setBibliographyNodes(filteredSources);
     } else {
       setBibliographyNodes([]);
     }
@@ -131,7 +180,11 @@ export default function Lesson() {
         body: { lesson_id: lessonId },
       });
       if (error) {
-        toast({ title: "Error al generar", description: error.message, variant: "destructive" });
+        toast({
+          title: "Error al generar",
+          description: await parseFunctionErrorMessage(error),
+          variant: "destructive",
+        });
         return;
       }
       if (data?.error) {
@@ -155,7 +208,11 @@ export default function Lesson() {
         body: { lesson_id: lessonId, regenerate_only: "teaching" },
       });
       if (error) {
-        toast({ title: "Error al regenerar", description: error.message, variant: "destructive" });
+        toast({
+          title: "Error al regenerar",
+          description: await parseFunctionErrorMessage(error),
+          variant: "destructive",
+        });
         return;
       }
       if (data?.error) {
@@ -176,7 +233,11 @@ export default function Lesson() {
         body: { lesson_id: lessonId, regenerate_only: "reading" },
       });
       if (error) {
-        toast({ title: "Error al regenerar", description: error.message, variant: "destructive" });
+        toast({
+          title: "Error al regenerar",
+          description: await parseFunctionErrorMessage(error),
+          variant: "destructive",
+        });
         return;
       }
       if (data?.error) {
@@ -281,6 +342,17 @@ export default function Lesson() {
       <main className="mx-auto max-w-6xl px-4 py-8">
         <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
           <div className="space-y-8">
+            {lesson.is_generating && (
+              <Card>
+                <CardContent className="pt-6">
+                  <ThinkingBook
+                    title="Estamos elaborando el material de la clase"
+                    detail="Cuando termine, la seccion de materiales se actualiza automaticamente."
+                  />
+                </CardContent>
+              </Card>
+            )}
+
             {planLesson && (
               <Card>
                 <CardHeader className="pb-3">
@@ -336,7 +408,7 @@ export default function Lesson() {
                       {bibliographyNodes.length > 0 ? (
                         bibliographyNodes.map((node) => (
                           <Badge key={node.id} variant="secondary">
-                            [{node.node_type}] {node.name}
+                            [FUENTE] {node.name}
                           </Badge>
                         ))
                       ) : (
@@ -359,7 +431,7 @@ export default function Lesson() {
                         {referencedNodes.length > 0 ? (
                           referencedNodes.map((node) => (
                             <Badge key={node.id} variant="outline">
-                              [{node.node_type}] {node.name}
+                              [FUENTE] {node.name}
                             </Badge>
                           ))
                         ) : (
diff --git a/src/components/lesson/ReadingMaterialView.tsx b/src/components/lesson/ReadingMaterialView.tsx
index 7b66c0a..d02ec68 100644
--- a/src/components/lesson/ReadingMaterialView.tsx
+++ b/src/components/lesson/ReadingMaterialView.tsx
@@ -1,8 +1,10 @@
+import { useState } from "react";
 import { Badge } from "@/components/ui/badge";
 import { Card, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
-import { AlertTriangle, Download, Eye } from "lucide-react";
+import { AlertTriangle, Copy, Download, Eye } from "lucide-react";
+import { supabase } from "@/integrations/supabase/client";
 
 interface ReadingMaterialViewProps {
   material: {
@@ -28,6 +30,8 @@ const statusVariant = (s: string): "default" | "secondary" | "destructive" => {
 };
 
 export default function ReadingMaterialView({ material, pdfBase64 }: ReadingMaterialViewProps) {
+  const [downloadError, setDownloadError] = useState("");
+
   const displayHtml = material.content_html
     .replace(/```(?:html|HTML)?\s*/gi, "")
     .replace(/<span\s+data-ref="[^"]*"\s*><\/span>/gi, "")
@@ -51,6 +55,54 @@ export default function ReadingMaterialView({ material, pdfBase64 }: ReadingMate
     window.open(url, "_blank");
   };
 
+  const extractStoragePath = (url: string): string | null => {
+    try {
+      const parsed = new URL(url);
+      const marker = "/storage/v1/object/public/reading-materials-pdf/";
+      const markerIndex = parsed.pathname.indexOf(marker);
+      if (markerIndex === -1) return null;
+      return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
+    } catch {
+      return null;
+    }
+  };
+
+  const downloadFromStorageApi = async () => {
+    if (!material.pdf_url) return;
+    setDownloadError("");
+
+    const path = extractStoragePath(material.pdf_url);
+    if (!path) {
+      setDownloadError("No se pudo resolver la ruta del PDF para descarga alternativa.");
+      return;
+    }
+
+    const { data, error } = await supabase.storage.from("reading-materials-pdf").download(path);
+    if (error || !data) {
+      setDownloadError(error?.message || "No se pudo descargar el PDF desde la API.");
+      return;
+    }
+
+    const url = URL.createObjectURL(data);
+    const link = document.createElement("a");
+    link.href = url;
+    link.download = "material-lectura.pdf";
+    document.body.appendChild(link);
+    link.click();
+    document.body.removeChild(link);
+    URL.revokeObjectURL(url);
+  };
+
+  const copyPdfLink = async () => {
+    if (!material.pdf_url) return;
+    setDownloadError("");
+    try {
+      await navigator.clipboard.writeText(material.pdf_url);
+    } catch {
+      setDownloadError("No se pudo copiar el enlace al portapapeles.");
+    }
+  };
+
   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
@@ -88,13 +140,32 @@ export default function ReadingMaterialView({ material, pdfBase64 }: ReadingMate
       </Card>
 
       {material.pdf_url && (
-        <div className="flex items-center gap-3">
-          <Button variant="outline" size="sm" className="text-xs" asChild>
-            <a href={material.pdf_url} target="_blank" rel="noopener noreferrer" download>
+        <div className="space-y-2">
+          <p className="text-xs text-muted-foreground">
+            Si tu navegador bloquea el dominio de Supabase (ERR_BLOCKED_BY_CLIENT), usa la descarga alternativa.
+          </p>
+          <div className="flex flex-wrap items-center gap-3">
+            <Button variant="outline" size="sm" className="text-xs" asChild>
+              <a href={material.pdf_url} target="_blank" rel="noopener noreferrer" download>
+                <Download className="mr-1 h-3 w-3" />
+                Descargar PDF
+              </a>
+            </Button>
+            <Button variant="outline" size="sm" className="text-xs" onClick={downloadFromStorageApi}>
               <Download className="mr-1 h-3 w-3" />
-              Descargar PDF
-            </a>
-          </Button>
+              Descarga alternativa
+            </Button>
+            <Button variant="outline" size="sm" className="text-xs" onClick={copyPdfLink}>
+              <Copy className="mr-1 h-3 w-3" />
+              Copiar enlace
+            </Button>
+          </div>
+          {downloadError && (
+            <Alert variant="destructive">
+              <AlertTriangle className="h-4 w-4" />
+              <AlertDescription className="text-xs">{downloadError}</AlertDescription>
+            </Alert>
+          )}
         </div>
       )}
 


```

### Phase 3 Patch
```diff
diff --git a/supabase/functions/_shared/curriculumImport.ts b/supabase/functions/_shared/curriculumImport.ts
index 8835684..2b0883c 100644
--- a/supabase/functions/_shared/curriculumImport.ts
+++ b/supabase/functions/_shared/curriculumImport.ts
@@ -192,6 +192,170 @@ function isLikelyContentLine(line: string): boolean {
   return false;
 }
 
+function isBibliographyHeading(line: string): boolean {
+  const normalized = normalizeText(line);
+  return normalized === "bibliografia" || normalized.startsWith("bibliografia ");
+}
+
+function isLikelyPageArtifactLine(line: string): boolean {
+  const compact = line.trim();
+  if (!compact) return true;
+  if (/^\d+$/.test(compact)) return true;
+  if (/^\d+\s*\|/.test(compact)) return true;
+  if (/\|\s*DGCyE\s*\|/i.test(compact)) return true;
+  if (/^pagina\s+\d+/i.test(compact)) return true;
+  return false;
+}
+
+function isLikelyBibliographyNoise(line: string): boolean {
+  const normalized = normalizeText(line);
+  if (!normalized) return true;
+  if (isLikelyPageArtifactLine(line)) return true;
+
+  return (
+    normalized.startsWith("isbn") ||
+    normalized.startsWith("cdd") ||
+    normalized.startsWith("indice") ||
+    normalized.startsWith("equipo de especialistas") ||
+    normalized.startsWith("diseno curricular para") ||
+    normalized.startsWith("educacion secundaria")
+  );
+}
+
+function isRepeatedAuthorMarker(raw: string): boolean {
+  const value = raw.replace(/[,:.;]+$/g, "").replace(/\s+/g, "");
+  if (!value || value.length < 2) return false;
+  return value.replace(/\p{Pd}/gu, "").length === 0;
+}
+
+function cleanBibliographyCandidate(line: string): string {
+  return line
+    .replace(/^[\u2022*-]\s+/u, "")
+    .replace(/^\d+[\).]\s+/, "")
+    .replace(/\s+/g, " ")
+    .trim();
+}
+
+function isLikelyBibliographyEntryStart(line: string, hasLastAuthor: boolean): boolean {
+  const candidate = cleanBibliographyCandidate(line);
+  if (!candidate || candidate.length < 14) return false;
+  if (isLikelyBibliographyNoise(candidate)) return false;
+
+  const commaCount = (candidate.match(/,/g) || []).length;
+  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(candidate);
+  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(candidate);
+  const firstToken = candidate.split(",")[0] || "";
+  const repeatedAuthor = isRepeatedAuthorMarker(firstToken);
+  const authorLike = /^[\p{Lu}][^,]{1,90},/u.test(candidate);
+
+  if (!authorLike && !(repeatedAuthor && hasLastAuthor)) return false;
+  if (commaCount < 3) return false;
+  if (!hasYear && !hasEditionFallback && commaCount < 4) return false;
+
+  return true;
+}
+
+function buildAuthorCarry(parts: string[]): string | null {
+  if (parts.length === 0) return null;
+
+  const surname = parts[0].trim();
+  if (!surname) return null;
+  if (parts.length === 1) return surname;
+
+  const maybeGivenName = parts[1].trim();
+  if (
+    maybeGivenName &&
+    maybeGivenName.length <= 48 &&
+    /^[\p{L}.'\- ]+$/u.test(maybeGivenName) &&
+    !/\b(en|vol\.?|libro|trad\.?|edicion|ediciones)\b/i.test(maybeGivenName) &&
+    !/\d/.test(maybeGivenName)
+  ) {
+    return `${surname}, ${maybeGivenName}`.replace(/\s+/g, " ").trim();
+  }
+
+  return surname;
+}
+
+function normalizeBibliographyEntry(
+  rawEntry: string,
+  lastAuthor: string | null
+): { citation: string; carryAuthor: string | null } | null {
+  const cleaned = cleanBibliographyCandidate(rawEntry);
+  if (!cleaned || isLikelyBibliographyNoise(cleaned)) return null;
+
+  const commaCount = (cleaned.match(/,/g) || []).length;
+  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(cleaned);
+  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(cleaned);
+  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
+  if (parts.length < 2) return null;
+
+  const firstToken = parts[0];
+  const repeatedAuthor = isRepeatedAuthorMarker(firstToken);
+  const authorLike = /^[\p{Lu}][^,]{1,90}$/u.test(firstToken);
+  if (!authorLike && !(repeatedAuthor && lastAuthor)) return null;
+  if (commaCount < 3) return null;
+  if (!hasYear && !hasEditionFallback && commaCount < 4) return null;
+
+  if (repeatedAuthor) {
+    if (!lastAuthor) return null;
+    const rest = parts.slice(1).join(", ").trim();
+    if (!rest) return null;
+    return {
+      citation: `${lastAuthor}, ${rest}`.replace(/\s+/g, " ").trim(),
+      carryAuthor: lastAuthor,
+    };
+  }
+
+  return {
+    citation: cleaned.replace(/\s+/g, " ").trim(),
+    carryAuthor: buildAuthorCarry(parts),
+  };
+}
+
+function isLikelyAuthorityLine(line: string): boolean {
+  const cleaned = cleanBibliographyCandidate(line);
+  if (!cleaned) return false;
+  if (isLikelyBibliographyNoise(cleaned)) return true;
+
+  const normalized = normalizeText(cleaned);
+  const commaCount = (cleaned.match(/,/g) || []).length;
+  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(cleaned);
+  if (hasYear && commaCount >= 2) return false;
+
+  const institutionalTokens = [
+    "autoridades",
+    "direccion general",
+    "dgcye",
+    "ministerio",
+    "subsecretaria",
+    "gobernacion",
+    "consejo general",
+    "equipo de especialistas",
+    "equipo tecnico",
+    "provincia de buenos aires",
+  ];
+
+  if (institutionalTokens.some((token) => normalized.includes(token))) return true;
+
+  if (
+    /\b(ministro|subsecretari[oa]|director(?:a)?(?:\s+general|\s+provincial)?|gobernador|presidente|vicepresidente|secretari[oa]|coordinador(?:a)?|jef[ea]|inspector(?:a)?)\b/i.test(
+      cleaned
+    )
+  ) {
+    return true;
+  }
+
+  if (
+    /^(lic\.|prof\.|dr\.|dra\.)\s+[\p{Lu}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+){1,4}$/u.test(cleaned) &&
+    commaCount <= 1 &&
+    !hasYear
+  ) {
+    return true;
+  }
+
+  return false;
+}
+
 function extractCurriculumNodes(rawText: string): DraftNode[] {
   const lines = rawText
     .split("\n")
@@ -202,6 +366,11 @@ function extractCurriculumNodes(rawText: string): DraftNode[] {
   let currentEje: (DraftNode & { fingerprint: string }) | null = null;
   let currentUnidad: (DraftNode & { fingerprint: string }) | null = null;
   let currentBloque: (DraftNode & { fingerprint: string }) | null = null;
+  let bibliographyParent: (DraftNode & { fingerprint: string }) | null = null;
+  let inBibliographySection = false;
+  let bibliographyDraft = "";
+  let lastBibliographyAuthor: string | null = null;
+  let authorityLineStreak = 0;
   let orderIndex = 0;
 
   const pushNode = (
@@ -229,7 +398,82 @@ function extractCurriculumNodes(rawText: string): DraftNode[] {
     return node;
   };
 
+  const flushBibliographyDraft = () => {
+    const parsed = normalizeBibliographyEntry(bibliographyDraft, lastBibliographyAuthor);
+    bibliographyDraft = "";
+    if (!parsed) return;
+
+    pushNode(
+      "CONTENIDO",
+      parsed.citation,
+      bibliographyParent?.tempId || currentEje?.tempId || null
+    );
+    lastBibliographyAuthor = parsed.carryAuthor || lastBibliographyAuthor;
+  };
+
   for (const line of lines) {
+    if (isBibliographyHeading(line)) {
+      flushBibliographyDraft();
+      currentEje = pushNode("EJE", line, null);
+      currentUnidad = null;
+      currentBloque = pushNode("BLOQUE", "Fuentes bibliograficas", currentEje?.tempId || null);
+      bibliographyParent = currentBloque || currentEje;
+      inBibliographySection = true;
+      lastBibliographyAuthor = null;
+      authorityLineStreak = 0;
+      continue;
+    }
+
+    if (inBibliographySection) {
+      const startsBibliographyEntry = isLikelyBibliographyEntryStart(
+        line,
+        Boolean(lastBibliographyAuthor)
+      );
+      const likelyAuthorityLine = isLikelyAuthorityLine(line);
+      const exitsBibliography =
+        isLikelySectionHeading(line) &&
+        !isBibliographyHeading(line) &&
+        !startsBibliographyEntry;
+
+      if (exitsBibliography) {
+        flushBibliographyDraft();
+        inBibliographySection = false;
+        bibliographyParent = null;
+        lastBibliographyAuthor = null;
+        authorityLineStreak = 0;
+      } else {
+        if (likelyAuthorityLine && !startsBibliographyEntry) {
+          authorityLineStreak += 1;
+          if (authorityLineStreak >= 3) {
+            flushBibliographyDraft();
+            inBibliographySection = false;
+            bibliographyParent = null;
+            lastBibliographyAuthor = null;
+            authorityLineStreak = 0;
+          }
+          continue;
+        }
+
+        authorityLineStreak = 0;
+
+        if (isLikelyBibliographyNoise(line)) {
+          continue;
+        }
+
+        const candidate = cleanBibliographyCandidate(line);
+        if (!candidate) continue;
+
+        if (startsBibliographyEntry) {
+          flushBibliographyDraft();
+          bibliographyDraft = candidate;
+        } else if (bibliographyDraft.length > 0) {
+          bibliographyDraft = `${bibliographyDraft} ${candidate}`.replace(/\s+/g, " ").trim();
+        }
+
+        continue;
+      }
+    }
+
     if (isLikelyUnitHeading(line)) {
       currentUnidad = pushNode("UNIDAD", line, currentEje?.tempId || null);
       currentBloque = null;
@@ -262,6 +506,7 @@ function extractCurriculumNodes(rawText: string): DraftNode[] {
     }
   }
 
+  flushBibliographyDraft();
   return nodes.map(({ fingerprint: _fingerprint, ...node }) => node);
 }
 
diff --git a/supabase/functions/bootstrap-course-plan/index.ts b/supabase/functions/bootstrap-course-plan/index.ts
index d1d0e6d..280b6a7 100644
--- a/supabase/functions/bootstrap-course-plan/index.ts
+++ b/supabase/functions/bootstrap-course-plan/index.ts
@@ -1,4 +1,4 @@
-import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
+﻿import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
@@ -58,6 +58,134 @@ function isFilosofiaSubject(subject: string): boolean {
   return normalizeKey(subject) === "filosofia";
 }
 
+function isCurriculumNoiseText(normalized: string): boolean {
+  const compact = normalized.replace(/\s+/g, "");
+  return (
+    normalized.startsWith("diseno curricular para") ||
+    normalized.startsWith("educacion secundaria") ||
+    normalized.startsWith("isbn") ||
+    normalized.startsWith("cdd") ||
+    normalized.startsWith("indice") ||
+    normalized.startsWith("presentacion") ||
+    normalized.startsWith("equipo de especialistas") ||
+    normalized.startsWith("direccion general") ||
+    normalized.startsWith("dgcye") ||
+    compact.includes("directorageneral") ||
+    compact.includes("presidentadelconsejo") ||
+    compact.includes("subsecretariadeeducacion") ||
+    compact.includes("directoraprovincialdegestioneducativa") ||
+    compact.includes("gobernador") ||
+    compact.includes("ministro") ||
+    compact.includes("autoridades")
+  );
+}
+
+function isCurriculumNoiseNode(node: CurriculumNodeRow): boolean {
+  const normalized = normalizeKey(node.name);
+  if (!normalized) return true;
+  if (isCurriculumNoiseText(normalized)) return true;
+  if (/^\d+$/.test(normalized)) return true;
+  return false;
+}
+
+function isLikelyBibliographyNodeName(name: string): boolean {
+  const normalized = normalizeKey(name);
+  if (!normalized || isCurriculumNoiseText(normalized)) return false;
+
+  const trimmed = name.trim();
+  const commaCount = (trimmed.match(/,/g) || []).length;
+  const hasAuthorPrefix = /^[A-ZÃÃ‰ÃÃ“ÃšÃ‘][^,]{1,90},/.test(trimmed);
+  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(trimmed);
+  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(trimmed);
+
+  if (!hasAuthorPrefix) return false;
+  if (commaCount < 2) return false;
+  if (!hasYear && !hasEditionFallback && commaCount < 3) return false;
+  return true;
+}
+
+function formatReadableParagraphs(text: string, minParagraphs = 4): string {
+  const raw = (text || "").replace(/\r/g, "").trim();
+  if (!raw) return raw;
+
+  const existingParagraphs = raw
+    .split(/\n\s*\n/)
+    .map((paragraph) => paragraph.trim())
+    .filter(Boolean);
+  if (existingParagraphs.length >= minParagraphs) {
+    return existingParagraphs.join("\n\n");
+  }
+
+  const normalized = raw.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
+  const sentences = normalized.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [normalized];
+  if (sentences.length < 4) return normalized;
+
+  const targetParagraphs = Math.min(6, Math.max(minParagraphs, Math.ceil(sentences.length / 3)));
+  const chunkSize = Math.ceil(sentences.length / targetParagraphs);
+  const paragraphs: string[] = [];
+
+  for (let index = 0; index < sentences.length; index += chunkSize) {
+    const chunk = sentences
+      .slice(index, index + chunkSize)
+      .map((sentence) => sentence.trim())
+      .filter(Boolean)
+      .join(" ")
+      .trim();
+    if (chunk) paragraphs.push(chunk);
+  }
+
+  return paragraphs.join("\n\n");
+}
+
+function uniqueNodes(nodes: CurriculumNodeRow[]): CurriculumNodeRow[] {
+  const byId = new Map<string, CurriculumNodeRow>();
+  for (const node of nodes) {
+    if (!byId.has(node.id)) byId.set(node.id, node);
+  }
+  return Array.from(byId.values());
+}
+
+function selectPlanningNodes(nodes: CurriculumNodeRow[]): CurriculumNodeRow[] {
+  const preferred = nodes.filter(
+    (node) =>
+      ["CONTENIDO", "BLOQUE", "UNIDAD"].includes(node.node_type) &&
+      !isCurriculumNoiseNode(node)
+  );
+  if (preferred.length > 0) return preferred;
+
+  const fallback = nodes.filter((node) => !isCurriculumNoiseNode(node));
+  if (fallback.length > 0) return fallback;
+
+  return nodes;
+}
+
+function buildNodePools(nodes: CurriculumNodeRow[]): {
+  nodesForPrompt: CurriculumNodeRow[];
+  nodesForMappings: CurriculumNodeRow[];
+  coreNodes: CurriculumNodeRow[];
+  bibliographyNodes: CurriculumNodeRow[];
+} {
+  const planningNodes = selectPlanningNodes(nodes);
+  const bibliographyNodes = uniqueNodes(
+    planningNodes.filter((node) => isLikelyBibliographyNodeName(node.name))
+  );
+
+  const coreNodes = uniqueNodes(
+    planningNodes.filter((node) => !isLikelyBibliographyNodeName(node.name))
+  );
+
+  const safeCoreNodes = coreNodes.length > 0 ? coreNodes : planningNodes;
+  const nodesForPrompt = uniqueNodes([...safeCoreNodes, ...bibliographyNodes]).slice(0, 180);
+  const nodesForMappings = uniqueNodes([...safeCoreNodes, ...bibliographyNodes]).slice(0, 260);
+
+  return {
+    nodesForPrompt,
+    nodesForMappings,
+    coreNodes: safeCoreNodes,
+    bibliographyNodes,
+  };
+}
+
 function buildActivitiesSummary(operation: string, evidence: string): string {
   return `Operacion: ${operation} Evidencia minima: ${evidence}`;
 }
@@ -436,8 +564,8 @@ function normalizeBootstrapPayload(
   return {
     fundamentacion:
       typeof payload?.fundamentacion === "string" && payload.fundamentacion.trim().length > 0
-        ? payload.fundamentacion.trim()
-        : fallback.fundamentacion,
+        ? formatReadableParagraphs(payload.fundamentacion.trim())
+        : formatReadableParagraphs(fallback.fundamentacion),
     estrategias_marco:
       typeof payload?.estrategias_marco === "string" && payload.estrategias_marco.trim().length > 0
         ? payload.estrategias_marco.trim()
@@ -479,7 +607,7 @@ function normalizeBootstrapPayload(
 }
 
 async function ensureCurriculumNodes(
-  adminClient: ReturnType<typeof createClient>,
+  adminClient: any,
   curriculumDocumentId: string,
   subject: string,
   officialTitle: string | null
@@ -619,6 +747,7 @@ serve(async (req) => {
       course.subject,
       curriculumDocument.official_title || null
     );
+    const nodePools = buildNodePools(nodes);
 
     const { data: planLessons, error: planLessonsError } = await adminClient
       .from("plan_lessons")
@@ -637,7 +766,7 @@ serve(async (req) => {
 
     const targetPlanStatus = (lessonCount || 0) > 0 ? "EDITED" : "INCOMPLETE";
 
-    const nodeNames = nodes.map((node) => `[${node.node_type}] ${node.name}`);
+    const nodeNames = nodePools.nodesForPrompt.map((node) => `[${node.node_type}] ${node.name}`);
     const subjectCanonNote = isFyHctSubject(course.subject)
       ? [
           "Canon disciplinar obligatorio para FyHyCyT:",
@@ -729,7 +858,7 @@ ${nodeNames.join("\n")}`;
     const normalized = normalizeBootstrapPayload(
       aiPayload,
       course.subject,
-      nodes.map((node) => node.name),
+      nodePools.nodesForPrompt.map((node) => node.name),
       planLessons.length
     );
 
@@ -757,7 +886,7 @@ ${nodeNames.join("\n")}`;
       await adminClient.from("plan_objectives").insert(objectiveRows);
     }
 
-    const mappingRows = nodes.map((node, index: number) => ({
+    const mappingRows = nodePools.nodesForMappings.map((node, index: number) => ({
       plan_id: body.plan_id!,
       curriculum_node_id: node.id,
       order_index: index,
@@ -795,15 +924,37 @@ ${nodeNames.join("\n")}`;
       .delete()
       .in("plan_lesson_id", planLessons.map((lesson: any) => lesson.id));
 
-    if (nodes.length > 0 && mappingIdByNodeId.size > 0) {
-      const linkRows = planLessons.flatMap((lesson: any, index: number) => {
-        const firstNode = nodes[index % nodes.length];
-        const secondNode = nodes[(index + 1) % nodes.length];
-        const mappingIds = [firstNode, secondNode]
-          .map((node) => mappingIdByNodeId.get(node.id))
-          .filter((value, valueIndex, array): value is string => !!value && array.indexOf(value) === valueIndex);
+    if (nodePools.nodesForMappings.length > 0 && mappingIdByNodeId.size > 0) {
+      const coreNodesForLinking = nodePools.coreNodes.filter((node) => mappingIdByNodeId.has(node.id));
+      const bibliographyNodesForLinking = nodePools.bibliographyNodes.filter((node) =>
+        mappingIdByNodeId.has(node.id)
+      );
 
-        return mappingIds.map((mappingId) => ({
+      const linkRows = planLessons.flatMap((lesson: any, index: number) => {
+        const mappingIds = new Set<string>();
+
+        if (coreNodesForLinking.length > 0) {
+          const firstNode = coreNodesForLinking[index % coreNodesForLinking.length];
+          const secondNode = coreNodesForLinking[(index + 1) % coreNodesForLinking.length];
+          const firstMappingId = mappingIdByNodeId.get(firstNode.id);
+          const secondMappingId = mappingIdByNodeId.get(secondNode.id);
+          if (firstMappingId) mappingIds.add(firstMappingId);
+          if (secondMappingId) mappingIds.add(secondMappingId);
+        }
+
+        if (bibliographyNodesForLinking.length > 0) {
+          const bibliographyNode = bibliographyNodesForLinking[index % bibliographyNodesForLinking.length];
+          const bibliographyMappingId = mappingIdByNodeId.get(bibliographyNode.id);
+          if (bibliographyMappingId) mappingIds.add(bibliographyMappingId);
+        }
+
+        if (mappingIds.size === 0) {
+          const fallbackNode = nodePools.nodesForMappings[index % nodePools.nodesForMappings.length];
+          const fallbackMappingId = mappingIdByNodeId.get(fallbackNode.id);
+          if (fallbackMappingId) mappingIds.add(fallbackMappingId);
+        }
+
+        return Array.from(mappingIds).map((mappingId) => ({
           plan_lesson_id: lesson.id,
           plan_content_mapping_id: mappingId,
         }));
@@ -819,6 +970,8 @@ ${nodeNames.join("\n")}`;
         success: true,
         plan_status: targetPlanStatus,
         synthetic_nodes_created: syntheticNodesCreated,
+        prompt_nodes_count: nodePools.nodesForPrompt.length,
+        bibliography_nodes_count: nodePools.bibliographyNodes.length,
         objectives_count: objectiveRows.length,
         content_mappings_count: mappingRows.length,
         lessons_count: normalized.lessons.length,
@@ -832,3 +985,4 @@ ${nodeNames.join("\n")}`;
     );
   }
 });
+
diff --git a/supabase/functions/generate-materials/index.ts b/supabase/functions/generate-materials/index.ts
index 7f1696a..79291d0 100644
--- a/supabase/functions/generate-materials/index.ts
+++ b/supabase/functions/generate-materials/index.ts
@@ -1,4 +1,4 @@
-import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
+﻿import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";
 
@@ -8,7 +8,7 @@ const corsHeaders = {
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
-// ── Validation helpers ──
+// â”€â”€ Validation helpers â”€â”€
 
 function cleanMarkdownArtifacts(text: string): string {
   return text.replace(/```(?:html|HTML)?\s*/gi, "").trim();
@@ -39,6 +39,40 @@ function isFilosofiaSubject(subject: string): boolean {
   return normalizeKey(subject) === "filosofia";
 }
 
+function isLikelyBibliographySource(name: string): boolean {
+  const trimmed = (name || "").trim();
+  if (!trimmed) return false;
+  const normalized = normalizeKey(trimmed);
+  if (
+    normalized.startsWith("diseno curricular para") ||
+    normalized.startsWith("educacion secundaria") ||
+    normalized.startsWith("isbn") ||
+    normalized.startsWith("cdd") ||
+    normalized.startsWith("indice") ||
+    normalized.startsWith("presentacion") ||
+    normalized.startsWith("equipo de especialistas")
+  ) {
+    return false;
+  }
+
+  const commaCount = (trimmed.match(/,/g) || []).length;
+  const hasAuthorPrefix = /^[A-ZÃÃ‰ÃÃ“ÃšÃ‘][^,]{1,90},/.test(trimmed);
+  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(trimmed);
+  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(trimmed);
+  return hasAuthorPrefix && commaCount >= 2 && (hasYear || hasEditionFallback || commaCount >= 3);
+}
+
+function buildReadingSourcesParagraph(bibliographyNodes: Array<{ name: string }>): string {
+  const labels = bibliographyNodes
+    .map((node) => (node.name || "").replace(/\s+/g, " ").trim())
+    .filter((label) => label.length > 0)
+    .slice(0, 6);
+
+  if (labels.length === 0) return "";
+
+  return `<p><strong>Fuentes de base del texto:</strong> ${labels.join(" | ")}.</p>`;
+}
+
 function extractLessonCanon(
   activitiesSummary: string | null | undefined,
   fallbackTheme: string
@@ -94,13 +128,13 @@ function validateReadingMaterial(
   }
   // M-2: Validate no subtitles
   if (/<h[1-6]\b/i.test(html)) {
-    reasons.push("Contiene subtítulos HTML prohibidos");
+    reasons.push("Contiene subtÃ­tulos HTML prohibidos");
   }
 
   if (/=\s*\d+/.test(stripHtml(html))) {
-    reasons.push("Contiene resolución matemática");
+    reasons.push("Contiene resoluciÃ³n matemÃ¡tica");
   }
-  const mathPhrases = ["la solución es", "por lo tanto x =", "la respuesta es"];
+  const mathPhrases = ["la soluciÃ³n es", "por lo tanto x =", "la respuesta es"];
   const plainText = stripHtml(html).toLowerCase();
   for (const phrase of mathPhrases) {
     if (plainText.includes(phrase)) {
@@ -112,7 +146,7 @@ function validateReadingMaterial(
   if (
     subjectLower.includes("social") ||
     subjectLower.includes("historia") ||
-    subjectLower.includes("geografía") ||
+    subjectLower.includes("geografÃ­a") ||
     subjectLower.includes("ciudadan")
   ) {
     const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
@@ -122,11 +156,11 @@ function validateReadingMaterial(
     if (paragraphs.length > 0) {
       const lastParagraph = paragraphs[paragraphs.length - 1].toLowerCase();
       const closurePhrases = [
-        "en conclusión",
+        "en conclusiÃ³n",
         "por lo tanto",
         "en definitiva",
         "se puede afirmar que",
-        "así se demuestra que",
+        "asÃ­ se demuestra que",
       ];
       for (const phrase of closurePhrases) {
         if (lastParagraph.includes(phrase)) {
@@ -148,10 +182,14 @@ function validateReadingMaterial(
     }
   }
 
+  if (!/fuentes de base del texto\s*:/i.test(stripHtml(html))) {
+    reasons.push("Falta trazabilidad final de fuentes usadas");
+  }
+
   return { valid: reasons.length === 0, reasons };
 }
 
-// ── PDF generation with pdf-lib ──
+// â”€â”€ PDF generation with pdf-lib â”€â”€
 
 async function generatePdfFromHtml(html: string): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
   const cleanHtml = html.replace(/<span\s+data-ref="[^"]*"\s*><\/span>/gi, "");
@@ -228,7 +266,7 @@ async function generatePdfFromHtml(html: string): Promise<{ pdfBytes: Uint8Array
   return { pdfBytes: new Uint8Array(pdfBytes), pageCount };
 }
 
-// ── Watermark helper ──
+// â”€â”€ Watermark helper â”€â”€
 
 async function applyWatermark(pdfDoc: PDFDocument): Promise<void> {
   const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
@@ -259,7 +297,7 @@ async function applyWatermark(pdfDoc: PDFDocument): Promise<void> {
   }
 }
 
-// ── AI call helper ──
+// â”€â”€ AI call helper â”€â”€
 
 async function callAI(
   apiKey: string,
@@ -294,7 +332,7 @@ function isMissingCurriculumColumnError(error: { message?: string } | null | und
   return message.includes("curriculum_document_id") && message.includes("courses");
 }
 
-// ── Entitlements helpers ──
+// â”€â”€ Entitlements helpers â”€â”€
 
 function getCurrentMonday(): string {
   const now = new Date();
@@ -365,19 +403,19 @@ serve(async (req) => {
     if (lessonIds.length === 0) throw new Error("Al menos un lesson_id requerido");
     // G-1: max_classes_per_session limits lessons per invocation (1-3)
     if (lessonIds.length > 3) {
-      return new Response(JSON.stringify({ error: "Máximo 3 lecciones por sesión" }), {
+      return new Response(JSON.stringify({ error: "MÃ¡ximo 3 lecciones por sesiÃ³n" }), {
         status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
   } catch (e) {
-    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Body inválido" }), {
+    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Body invÃ¡lido" }), {
       status: 400,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 
   try {
-    // ── 0. Entitlements gating ──
+    // â”€â”€ 0. Entitlements gating â”€â”€
 
     const { data: entitlements } = await adminClient
       .from("user_entitlements")
@@ -406,7 +444,7 @@ serve(async (req) => {
       // Validate weekly sessions
       if (usageCounter.sessions_used_this_week >= entitlements.max_weekly_sessions) {
         return new Response(
-          JSON.stringify({ error: `Alcanzaste el límite de ${entitlements.max_weekly_sessions} sesiones semanales de tu plan` }),
+          JSON.stringify({ error: `Alcanzaste el lÃ­mite de ${entitlements.max_weekly_sessions} sesiones semanales de tu plan` }),
           { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
@@ -414,7 +452,7 @@ serve(async (req) => {
       // G-1: Validate lessons count per invocation against max_classes_per_session
       if (lessonIds.length > entitlements.max_classes_per_session) {
         return new Response(
-          JSON.stringify({ error: `Máximo ${entitlements.max_classes_per_session} clases por sesión en tu plan` }),
+          JSON.stringify({ error: `MÃ¡ximo ${entitlements.max_classes_per_session} clases por sesiÃ³n en tu plan` }),
           { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
@@ -425,14 +463,14 @@ serve(async (req) => {
     let sharedCourseId: string | null = null;
 
     for (const lessonId of lessonIds) {
-      // ── 1. Validate preconditions per lesson ──
+      // â”€â”€ 1. Validate preconditions per lesson â”€â”€
       const { data: lesson, error: lessonErr } = await userClient
         .from("lessons")
         .select("*, course_id, plan_lesson_id, status, is_generating, lesson_number")
         .eq("id", lessonId)
         .single();
       if (lessonErr || !lesson) {
-        return new Response(JSON.stringify({ error: `Lección ${lessonId} no encontrada` }), {
+        return new Response(JSON.stringify({ error: `LecciÃ³n ${lessonId} no encontrada` }), {
           status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
@@ -447,7 +485,7 @@ serve(async (req) => {
       }
 
       if (lesson.is_generating) {
-        return new Response(JSON.stringify({ error: `Lección ${lessonId} ya se está generando` }), {
+        return new Response(JSON.stringify({ error: `LecciÃ³n ${lessonId} ya se estÃ¡ generando` }), {
           status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
@@ -461,14 +499,14 @@ serve(async (req) => {
         .select("id");
 
       if (!lockResult || lockResult.length === 0) {
-        return new Response(JSON.stringify({ error: `Lección ${lessonId} ya se está generando` }), {
+        return new Response(JSON.stringify({ error: `LecciÃ³n ${lessonId} ya se estÃ¡ generando` }), {
           status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
 
       if (lesson.status === "LOCKED") {
         await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
-        return new Response(JSON.stringify({ error: `Lección ${lessonId} está bloqueada` }), {
+        return new Response(JSON.stringify({ error: `LecciÃ³n ${lessonId} estÃ¡ bloqueada` }), {
           status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
@@ -512,7 +550,7 @@ serve(async (req) => {
       }
       if (!course || course.status !== "ACTIVE") {
         await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
-        return new Response(JSON.stringify({ error: "El curso no está activo" }), {
+        return new Response(JSON.stringify({ error: "El curso no estÃ¡ activo" }), {
           status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
@@ -524,7 +562,7 @@ serve(async (req) => {
         .single();
       if (!plan || plan.status !== "VALIDATED") {
         await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
-        return new Response(JSON.stringify({ error: "El plan no está validado" }), {
+        return new Response(JSON.stringify({ error: "El plan no estÃ¡ validado" }), {
           status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
@@ -543,7 +581,7 @@ serve(async (req) => {
       if (!planLesson.theme || !planLesson.justification || !planLesson.learning_outcome) {
         await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
         return new Response(
-          JSON.stringify({ error: "El plan lesson debe tener tema, justificación y resultado de aprendizaje" }),
+          JSON.stringify({ error: "El plan lesson debe tener tema, justificaciÃ³n y resultado de aprendizaje" }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
@@ -595,23 +633,37 @@ serve(async (req) => {
       }
       if (!brief.bibliografia_confirmada || brief.bibliografia_confirmada.length === 0) {
         await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
-        return new Response(JSON.stringify({ error: "Debe confirmar al menos una fuente bibliográfica" }), {
+        return new Response(JSON.stringify({ error: "Debe confirmar al menos una fuente bibliogrÃ¡fica" }), {
           status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
 
-      // ── 3. Get curriculum context ──
+      // â”€â”€ 3. Get curriculum context â”€â”€
       const { data: nodes } = await adminClient
         .from("curriculum_nodes")
         .select("id, name, node_type")
         .in("id", brief.bibliografia_confirmada);
 
-      const curriculumContext = (nodes || [])
+      const bibliographyNodes = (nodes || []).filter((node: any) =>
+        isLikelyBibliographySource(node.name || "")
+      );
+      if (bibliographyNodes.length === 0) {
+        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
+        return new Response(
+          JSON.stringify({
+            error:
+              "La bibliografia confirmada no contiene fuentes validas (autor/titulo). Reabre el brief y selecciona fuentes bibliograficas reales.",
+          }),
+          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
+        );
+      }
+
+      const curriculumContext = bibliographyNodes
         .map((n: any) => `[${n.node_type}] ${n.name}`)
         .join("\n");
 
-      const bibliographyIds = (nodes || []).map((n: any) => n.id);
-      const bibliographyContext = (nodes || [])
+      const bibliographyIds = bibliographyNodes.map((n: any) => n.id);
+      const bibliographyContext = bibliographyNodes
         .map((n: any) => `- ${n.name} [${n.node_type}] (ID: ${n.id})`)
         .join("\n");
       const disciplineCanon = isFyHctSubject(course.subject)
@@ -629,23 +681,23 @@ serve(async (req) => {
             ].join("\n")
           : "Canon disciplinar: mantene la clase alineada con el plan, el tiempo real y la evidencia esperada.";
 
-      // ── 4. Generate TeachingMaterial ──
+      // â”€â”€ 4. Generate TeachingMaterial â”€â”€
       let teachingStatus = "VALIDATED";
 
       if (regenerateOnly !== "reading") {
-        const teachingSystemPrompt = `Sos un experto en diseño de secuencias didácticas para nivel secundario en Argentina.
-Generá un material didáctico completo para una clase real dentro de una planificación anual ya definida.
+        const teachingSystemPrompt = `Sos un experto en diseÃ±o de secuencias didÃ¡cticas para nivel secundario en Argentina.
+GenerÃ¡ un material didÃ¡ctico completo para una clase real dentro de una planificaciÃ³n anual ya definida.
 
 CONTEXTO:
 - Materia: ${course.subject}
 - Clase anual: ${planLesson.lesson_number}
 - Tema: ${planLesson.theme}
-- Justificación: ${planLesson.justification}
+- JustificaciÃ³n: ${planLesson.justification}
 - Resultado de aprendizaje esperado: ${planLesson.learning_outcome}
 - Operacion canonica: ${lessonOperation}
 - Evidencia minima de la clase: ${minimumEvidence}
 - Enfoque deseado: ${brief.enfoque_deseado || "No especificado"}
-- Dinámica sugerida: ${brief.tipo_dinamica_sugerida || "No especificada"}
+- DinÃ¡mica sugerida: ${brief.tipo_dinamica_sugerida || "No especificada"}
 - Nivel de profundidad: ${brief.nivel_profundidad}
 - Observaciones del docente: ${brief.observaciones_docente || "Ninguna"}
 
@@ -668,24 +720,24 @@ CANON OBLIGATORIO - Debe incluir todas estas secciones:
 4. Producto esperado: debe coincidir con la evidencia minima o ser su version inmediata y verificable.
 5. 1-3 criterios de logro: observables y medibles sobre el producto o evidencia.
 6. Diferenciacion: al menos un apoyo y un desafio. El apoyo debe ser usable como ajuste low-tech o de accesibilidad.
-7. Cierre: debe dejar lista la salida hacia la próxima clase o consolidar lo producido hoy.
+7. Cierre: debe dejar lista la salida hacia la prÃ³xima clase o consolidar lo producido hoy.
 
 REGLAS:
 - No inventes otra clase distinta del plan anual.
 - No generes actividades sueltas: cada bloque debe empujar al producto esperado.
-- No escribas una clase genérica "sobre el tema". Es esta clase, con esta operacion y esta evidencia.
-- Si la materia es de Sociales, no uses cierres formulaicos como "En conclusión", "Por lo tanto" o "En definitiva".`;
+- No escribas una clase genÃ©rica "sobre el tema". Es esta clase, con esta operacion y esta evidencia.
+- Si la materia es de Sociales, no uses cierres formulaicos como "En conclusiÃ³n", "Por lo tanto" o "En definitiva".`;
 
         const teachingTools = [
           {
             type: "function",
             function: {
               name: "create_teaching_material",
-              description: "Crear material didáctico estructurado",
+              description: "Crear material didÃ¡ctico estructurado",
               parameters: {
                 type: "object",
                 properties: {
-                  purpose: { type: "string", description: "Propósito de la clase" },
+                  purpose: { type: "string", description: "PropÃ³sito de la clase" },
                   activities: {
                     type: "array",
                     items: {
@@ -711,7 +763,7 @@ REGLAS:
                     items: {
                       type: "object",
                       properties: {
-                        type: { type: "string", enum: ["apoyo", "desafío"] },
+                        type: { type: "string", enum: ["apoyo", "desafÃ­o"] },
                         description: { type: "string" },
                       },
                       required: ["type", "description"],
@@ -733,12 +785,10 @@ REGLAS:
           },
         ];
 
-        const teachingResult = await callAI(
-          geminiApiKey,
-          "gemini-2.5-flash",
+        const teachingResult = await callAI(geminiApiKey, "gemini-2.5-flash",
           [
             { role: "system", content: teachingSystemPrompt },
-            { role: "user", content: "Generá el material didáctico completo." },
+            { role: "user", content: "GenerÃ¡ el material didÃ¡ctico completo." },
           ],
           teachingTools,
           { type: "function", function: { name: "create_teaching_material" } }
@@ -751,10 +801,10 @@ REGLAS:
         // M-1: Post-AI structural validation
         const teachingValidationErrors: string[] = [];
         if (!teachingArgs.purpose || teachingArgs.purpose.trim().length === 0) {
-          teachingValidationErrors.push("purpose vacío");
+          teachingValidationErrors.push("purpose vacÃ­o");
         }
         if (!Array.isArray(teachingArgs.activities) || teachingArgs.activities.length === 0) {
-          teachingValidationErrors.push("activities vacío");
+          teachingValidationErrors.push("activities vacÃ­o");
         }
         const activityTypes = Array.isArray(teachingArgs.activities)
           ? teachingArgs.activities.map((activity: any) => activity.type)
@@ -769,16 +819,16 @@ REGLAS:
           teachingValidationErrors.push("falta actividad de cierre");
         }
         if (!teachingArgs.expected_product || teachingArgs.expected_product.trim().length === 0) {
-          teachingValidationErrors.push("expected_product vacío");
+          teachingValidationErrors.push("expected_product vacÃ­o");
         }
         if (!Array.isArray(teachingArgs.achievement_criteria) || teachingArgs.achievement_criteria.length === 0) {
-          teachingValidationErrors.push("achievement_criteria vacío");
+          teachingValidationErrors.push("achievement_criteria vacÃ­o");
         }
         if (!teachingArgs.closure || teachingArgs.closure.trim().length === 0) {
-          teachingValidationErrors.push("closure vacío");
+          teachingValidationErrors.push("closure vacÃ­o");
         }
         if (!Array.isArray(teachingArgs.differentiation) || teachingArgs.differentiation.length === 0) {
-          teachingValidationErrors.push("differentiation vacío");
+          teachingValidationErrors.push("differentiation vacÃ­o");
         }
         const differentiationTypes = Array.isArray(teachingArgs.differentiation)
           ? teachingArgs.differentiation.map((item: any) => item.type)
@@ -786,8 +836,8 @@ REGLAS:
         if (!differentiationTypes.includes("apoyo")) {
           teachingValidationErrors.push("falta apoyo");
         }
-        if (!differentiationTypes.includes("desafío")) {
-          teachingValidationErrors.push("falta desafío");
+        if (!differentiationTypes.includes("desafÃ­o")) {
+          teachingValidationErrors.push("falta desafÃ­o");
         }
 
         if (teachingValidationErrors.length > 0) {
@@ -817,7 +867,7 @@ REGLAS:
         }
       }
 
-      // ── 5. Generate ReadingMaterial ──
+      // â”€â”€ 5. Generate ReadingMaterial â”€â”€
       let readingStatus = "VALIDATED";
       let wordCount = 0;
       let lastReasons: string[] = [];
@@ -827,8 +877,8 @@ REGLAS:
       let watermarkApplied = false;
 
       if (regenerateOnly !== "teaching") {
-        const readingSystemPrompt = `Sos un redactor académico experto para nivel secundario en Argentina.
-Escribí un texto de lectura para alumnos que apoye exactamente la clase indicada dentro de una planificación anual ya definida.
+        const readingSystemPrompt = `Sos un redactor acadÃ©mico experto para nivel secundario en Argentina.
+EscribÃ­ un texto de lectura para alumnos que apoye exactamente la clase indicada dentro de una planificaciÃ³n anual ya definida.
 
 CONTEXTO:
 - Materia: ${course.subject}
@@ -844,7 +894,7 @@ ${formatSequenceNeighbor("Entrada esperada", previousPlanLesson)}
 ${formatSequenceNeighbor("Salida a preparar", nextPlanLesson)}
 
 CONTENIDOS CURRICULARES A REFERENCIAR:
-${(nodes || []).map((n: any) => `- ${n.name} (ID: ${n.id})`).join("\n")}
+${bibliographyNodes.map((n: any) => `- ${n.name} (ID: ${n.id})`).join("\n")}
 
 FUENTES CONFIRMADAS:
 ${bibliographyContext || "- Sin detalle disponible"}
@@ -853,18 +903,20 @@ ${disciplineCanon}
 
 REGLAS OBLIGATORIAS:
 1. Exactamente entre 1000 y 1300 palabras (contando solo texto visible).
-2. Texto corrido en párrafos. NO usar subtítulos. NO usar listas. NO usar viñetas.
+2. Texto corrido en pÃ¡rrafos. NO usar subtÃ­tulos. NO usar listas. NO usar viÃ±etas.
 3. NO incluir consignas ni preguntas al alumno.
 4. NO incluir meta-explicaciones ("en este texto vamos a...").
-5. Para cada contenido curricular referenciado, incluir al menos un tag invisible: <span data-ref="ID_DEL_NODO"></span> en algún punto relevante del texto.
-6. ${course.subject.toLowerCase().includes("social") || course.subject.toLowerCase().includes("historia") ? "En el último párrafo NO usar 'En conclusión', 'Por lo tanto', 'En definitiva', 'Se puede afirmar que', 'Así se demuestra que'." : ""}
-7. ${course.subject.toLowerCase().includes("matemática") ? "NO resolver ejercicios. NO mostrar soluciones numéricas." : ""}
-8. Devolver el texto como HTML válido con tags <p> para cada párrafo.
-9. Los tags <span data-ref="..."></span> deben estar DENTRO de los párrafos, como elementos inline invisibles.
-10. El texto no debe ser una explicación genérica del tema. Debe preparar o sostener la operacion de esta clase y ayudar a producir la evidencia minima.
+5. Para cada contenido curricular referenciado, incluir al menos un tag invisible: <span data-ref="ID_DEL_NODO"></span> en algÃºn punto relevante del texto.
+6. ${course.subject.toLowerCase().includes("social") || course.subject.toLowerCase().includes("historia") ? "En el Ãºltimo pÃ¡rrafo NO usar 'En conclusiÃ³n', 'Por lo tanto', 'En definitiva', 'Se puede afirmar que', 'AsÃ­ se demuestra que'." : ""}
+7. ${course.subject.toLowerCase().includes("matemÃ¡tica") ? "NO resolver ejercicios. NO mostrar soluciones numÃ©ricas." : ""}
+8. Devolver el texto como HTML vÃ¡lido con tags <p> para cada pÃ¡rrafo.
+9. Los tags <span data-ref="..."></span> deben estar DENTRO de los pÃ¡rrafos, como elementos inline invisibles.
+10. El texto no debe ser una explicaciÃ³n genÃ©rica del tema. Debe preparar o sostener la operacion de esta clase y ayudar a producir la evidencia minima.
 11. Si la materia es FyHyCyT, prioriza casos, validacion, metodos, evidencias, decisiones y relaciones ciencia-tecnologia-sociedad. No la conviertas en filosofia abstracta sin situacion.
-12. Si la materia es Filosofía, prioriza problema, conceptos, posiciones, argumentos y objeciones. No la conviertas en metodologia científica.
-13. Mantené trazabilidad explícita con la bibliografía confirmada y los nodos curriculares seleccionados.`;
+12. Si la materia es FilosofÃ­a, prioriza problema, conceptos, posiciones, argumentos y objeciones. No la conviertas en metodologia cientÃ­fica.
+13. MantenÃ© trazabilidad explÃ­cita con la bibliografÃ­a confirmada y los nodos curriculares seleccionados.
+14. No copies fragmentos extensos de obras protegidas. Prioriza parÃ¡frasis; si usas cita textual, que no supere 20 palabras.
+15. El Ãºltimo pÃ¡rrafo debe iniciar con "Fuentes de base del texto:" y nombrar las fuentes usadas.`;
 
         let readingHtml = "";
         let readingValid = false;
@@ -875,22 +927,24 @@ REGLAS OBLIGATORIAS:
           attempts++;
           const retryHint =
             attempts > 1
-              ? `\n\nINTENTO ${attempts}: El texto anterior falló validación por: ${lastReasons.join(", ")}. Corregí esos problemas.`
+              ? `\n\nINTENTO ${attempts}: El texto anterior fallÃ³ validaciÃ³n por: ${lastReasons.join(", ")}. CorregÃ­ esos problemas.`
               : "";
 
-          const readingResult = await callAI(
-            geminiApiKey,
-            "gemini-2.5-pro",
+          const readingResult = await callAI(geminiApiKey, "gemini-2.5-pro",
             [
               { role: "system", content: readingSystemPrompt },
               {
                 role: "user",
-                content: `Escribí el texto de lectura sobre "${planLesson.theme}".${retryHint}`,
+                content: `EscribÃ­ el texto de lectura sobre "${planLesson.theme}".${retryHint}`,
               },
             ]
           );
 
           readingHtml = cleanMarkdownArtifacts(readingResult.choices[0].message.content || "");
+          const sourcesParagraph = buildReadingSourcesParagraph(bibliographyNodes);
+          if (sourcesParagraph && !/fuentes de base del texto\s*:/i.test(stripHtml(readingHtml))) {
+            readingHtml = `${readingHtml}\n${sourcesParagraph}`;
+          }
 
           const validation = validateReadingMaterial(readingHtml, bibliographyIds, course.subject);
           
@@ -905,7 +959,7 @@ REGLAS OBLIGATORIAS:
             pdfPageCount = pageCount;
 
             if (pageCount < 2 || pageCount > 4) {
-              lastReasons = [`Conteo de páginas fuera de rango: ${pageCount} (debe ser 2-4)`];
+              lastReasons = [`Conteo de pÃ¡ginas fuera de rango: ${pageCount} (debe ser 2-4)`];
               readingValid = false;
               continue;
             }
@@ -963,7 +1017,7 @@ REGLAS OBLIGATORIAS:
         );
       }
 
-      // ── 6. Finalize this lesson ──
+      // â”€â”€ 6. Finalize this lesson â”€â”€
       await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
 
       if (regenerateOnly !== "reading") {
@@ -997,7 +1051,7 @@ REGLAS OBLIGATORIAS:
         .eq("user_id", userId);
     }
 
-    // Return results — backward compatible for single lesson
+    // Return results â€” backward compatible for single lesson
     if (allResults.length === 1) {
       return new Response(
         JSON.stringify({ success: true, ...allResults[0] }),
@@ -1022,3 +1076,4 @@ REGLAS OBLIGATORIAS:
     );
   }
 });
+
diff --git a/src/integrations/supabase/types.ts b/src/integrations/supabase/types.ts
index 3777b4d..9d4d006 100644
--- a/src/integrations/supabase/types.ts
+++ b/src/integrations/supabase/types.ts
@@ -18,6 +18,7 @@ export type Database = {
         Row: {
           academic_year: number
           created_at: string
+          curriculum_document_id: string | null
           id: string
           orientation: string | null
           school_id: string
@@ -31,6 +32,7 @@ export type Database = {
         Insert: {
           academic_year: number
           created_at?: string
+          curriculum_document_id?: string | null
           id?: string
           orientation?: string | null
           school_id: string
@@ -44,6 +46,7 @@ export type Database = {
         Update: {
           academic_year?: number
           created_at?: string
+          curriculum_document_id?: string | null
           id?: string
           orientation?: string | null
           school_id?: string
@@ -55,6 +58,13 @@ export type Database = {
           year_level?: number
         }
         Relationships: [
+          {
+            foreignKeyName: "courses_curriculum_document_id_fkey"
+            columns: ["curriculum_document_id"]
+            isOneToOne: false
+            referencedRelation: "curriculum_documents"
+            referencedColumns: ["id"]
+          },
           {
             foreignKeyName: "courses_school_id_fkey"
             columns: ["school_id"]
diff --git a/supabase/migrations/20260305113000_fix_courses_curriculum_link.sql b/supabase/migrations/20260305113000_fix_courses_curriculum_link.sql
new file mode 100644
index 0000000..9938cb3
--- /dev/null
+++ b/supabase/migrations/20260305113000_fix_courses_curriculum_link.sql
@@ -0,0 +1,21 @@
+ALTER TABLE public.courses
+ADD COLUMN IF NOT EXISTS curriculum_document_id UUID;
+
+DO $$
+BEGIN
+  IF NOT EXISTS (
+    SELECT 1
+    FROM pg_constraint
+    WHERE conname = 'courses_curriculum_document_id_fkey'
+      AND conrelid = 'public.courses'::regclass
+  ) THEN
+    ALTER TABLE public.courses
+      ADD CONSTRAINT courses_curriculum_document_id_fkey
+      FOREIGN KEY (curriculum_document_id)
+      REFERENCES public.curriculum_documents(id)
+      ON DELETE SET NULL;
+  END IF;
+END $$;
+
+CREATE INDEX IF NOT EXISTS courses_curriculum_document_id_idx
+  ON public.courses(curriculum_document_id);


```

