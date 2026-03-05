import type { Session, User } from "@supabase/supabase-js";
import {
  buildMockPlanDraft,
  getMockProgramsForProvince,
  resolveMockProgram,
  saveMockCurriculumForCourse,
} from "@/mock/curriculumCatalog";
import { STUDIO_AUTO_LOGIN } from "@/config/runtime";

type QueryError = { message: string } | null;
type QueryResult<T = any> = { data: T; error: QueryError; count?: number | null };
type TableRow = Record<string, any>;
type DbState = Record<string, TableRow[]>;

const DB_STORAGE_KEY = "copiloto.studio.db.v1";
const SESSION_STORAGE_KEY = "copiloto.studio.session.v1";

const FREE_ENTITLEMENTS = {
  max_courses: 1,
  max_students_per_course: 35,
  max_weekly_sessions: 2,
  max_classes_per_session: 3,
  watermark_enabled: true,
  history_enabled: false,
  copiloto_mode: "none",
  auto_complete_forms_enabled: false,
  persistent_storage_enabled: false,
};

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toRowArray(value: unknown): TableRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as TableRow[];
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function initialDbState(): DbState {
  const programs = getMockProgramsForProvince("PBA");
  const curriculumDocuments = programs.map((program) => ({
    ...program,
    status: "VERIFIED",
    updated_at: nowIso(),
  }));

  return {
    profiles: [],
    subscriptions: [],
    user_entitlements: [],
    usage_counters: [],
    schools: [
      {
        id: "school_demo_1",
        official_name: "Escuela Demo",
        district: "Demo",
        locality: "Demo",
        school_type: "COMUN",
        user_created: false,
        created_by: null,
      },
    ],
    curriculum_documents: curriculumDocuments,
    curriculum_nodes: [],
    courses: [],
    plans: [],
    plan_lessons: [],
    plan_objectives: [],
    plan_content_mappings: [],
    lessons: [],
    lesson_briefs: [],
    lesson_content_links: [],
    teaching_materials: [],
    reading_materials: [],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function buildUser(email: string, name?: string): User {
  const normalizedEmail = normalize(email);
  const id = `user_${normalizedEmail.replace(/[^a-z0-9]/g, "_")}`;
  return {
    id,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { name: name || normalizedEmail.split("@")[0] },
    aud: "authenticated",
    created_at: nowIso(),
    email: normalizedEmail,
    role: "authenticated",
  } as User;
}

function buildSession(user: User): Session {
  return {
    access_token: `studio_access_${user.id}`,
    refresh_token: `studio_refresh_${user.id}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  } as Session;
}

class MockQueryBuilder implements PromiseLike<QueryResult<any>> {
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private filters: Array<(row: TableRow) => boolean> = [];
  private selectedColumns = "*";
  private selectOptions: Record<string, any> = {};
  private rowMode: "many" | "single" | "maybeSingle" = "many";
  private orderBy: { column: string; ascending: boolean } | null = null;

  constructor(
    private readonly client: MockSupabaseClient,
    private readonly table: string
  ) {}

  select(columns = "*", options?: Record<string, any>) {
    this.selectedColumns = columns;
    this.selectOptions = options || {};
    return this;
  }

  insert(values: any) {
    this.action = "insert";
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.action = "update";
    this.payload = values || {};
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  upsert(values: any) {
    this.action = "upsert";
    this.payload = values;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => row?.[column] === value);
    return this;
  }

  in(column: string, values: any[]) {
    const allowed = new Set(values || []);
    this.filters.push((row) => allowed.has(row?.[column]));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  single() {
    this.rowMode = "single";
    return this;
  }

  maybeSingle() {
    this.rowMode = "maybeSingle";
    return this;
  }

  then<TResult1 = QueryResult<any>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.client
      .executeQuery({
        table: this.table,
        action: this.action,
        payload: this.payload,
        filters: this.filters,
        selectedColumns: this.selectedColumns,
        selectOptions: this.selectOptions,
        rowMode: this.rowMode,
        orderBy: this.orderBy,
      })
      .then(onfulfilled as any, onrejected as any);
  }
}

class MockSupabaseClient {
  private db: DbState;
  private listeners = new Set<(event: string, session: Session | null) => void>();
  private session: Session | null;

  constructor() {
    this.db = readJson<DbState>(DB_STORAGE_KEY, initialDbState());
    this.db = this.normalizeDb(this.db);
    this.session = readJson<Session | null>(SESSION_STORAGE_KEY, null);
    if (!this.session && STUDIO_AUTO_LOGIN) {
      const user = buildUser("studio@local.dev", "Docente Demo");
      this.session = buildSession(user);
      this.ensureUserRows(user);
      this.persist();
    }
  }

  private normalizeDb(db: DbState): DbState {
    const base = initialDbState();
    const normalized: DbState = {};
    for (const key of Object.keys(base)) {
      normalized[key] = toRowArray((db as any)?.[key]);
    }
    return normalized;
  }

  private persist() {
    writeJson(DB_STORAGE_KEY, this.db);
    writeJson(SESSION_STORAGE_KEY, this.session);
  }

  private currentUser(): User | null {
    return this.session?.user || null;
  }

  private emit(event: string) {
    for (const listener of this.listeners) {
      listener(event, this.session);
    }
  }

  private tableRows(table: string): TableRow[] {
    if (!this.db[table]) this.db[table] = [];
    return this.db[table];
  }

  private ensureUserRows(user: User) {
    const profiles = this.tableRows("profiles");
    if (!profiles.find((row) => row.id === user.id)) {
      profiles.push({
        id: user.id,
        name: (user.user_metadata as any)?.name || "Docente Demo",
        email: user.email,
      });
    }

    const subscriptions = this.tableRows("subscriptions");
    if (!subscriptions.find((row) => row.user_id === user.id && row.status === "ACTIVE")) {
      subscriptions.push({
        id: uid("sub"),
        user_id: user.id,
        plan_type: "FREE",
        status: "ACTIVE",
      });
    }

    const entitlements = this.tableRows("user_entitlements");
    if (!entitlements.find((row) => row.user_id === user.id)) {
      entitlements.push({
        id: uid("ent"),
        user_id: user.id,
        ...FREE_ENTITLEMENTS,
      });
    }
  }

  private hydrateRow(table: string, row: TableRow): TableRow {
    const hydrated = { ...row };

    if (table === "courses") {
      const school = this.tableRows("schools").find((s) => s.id === row.school_id);
      hydrated.schools = school
        ? { official_name: school.official_name, school_type: school.school_type }
        : null;
      const plan = this.tableRows("plans").find((p) => p.course_id === row.id);
      hydrated.plans = plan ? { status: plan.status } : null;
    }

    return hydrated;
  }

  private applyFilters(rows: TableRow[], filters: Array<(row: TableRow) => boolean>): TableRow[] {
    if (!filters.length) return rows;
    return rows.filter((row) => filters.every((filterFn) => filterFn(row)));
  }

  private applyOrder(rows: TableRow[], orderBy: { column: string; ascending: boolean } | null): TableRow[] {
    if (!orderBy) return rows;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const av = a?.[orderBy.column];
      const bv = b?.[orderBy.column];
      if (av === bv) return 0;
      if (av == null) return orderBy.ascending ? 1 : -1;
      if (bv == null) return orderBy.ascending ? -1 : 1;
      return av > bv ? (orderBy.ascending ? 1 : -1) : orderBy.ascending ? -1 : 1;
    });
    return sorted;
  }

  private shapeResult(rows: TableRow[], mode: "many" | "single" | "maybeSingle"): QueryResult<any> {
    if (mode === "single") {
      if (rows.length !== 1) return { data: null, error: { message: "Expected a single row" } };
      return { data: rows[0], error: null };
    }
    if (mode === "maybeSingle") {
      if (rows.length > 1) return { data: null, error: { message: "Expected zero or one row" } };
      return { data: rows[0] || null, error: null };
    }
    return { data: rows, error: null };
  }

  private cascadeDeleteCourses(courseIds: string[]) {
    const plans = this.tableRows("plans");
    const planIds = plans.filter((p) => courseIds.includes(p.course_id)).map((p) => p.id);
    const lessons = this.tableRows("lessons");
    const lessonIds = lessons.filter((l) => courseIds.includes(l.course_id)).map((l) => l.id);

    this.db.plans = plans.filter((p) => !courseIds.includes(p.course_id));
    this.db.plan_lessons = this.tableRows("plan_lessons").filter((row) => !planIds.includes(row.plan_id));
    this.db.plan_objectives = this.tableRows("plan_objectives").filter((row) => !planIds.includes(row.plan_id));
    this.db.plan_content_mappings = this.tableRows("plan_content_mappings").filter(
      (row) => !planIds.includes(row.plan_id)
    );
    this.db.lessons = lessons.filter((row) => !courseIds.includes(row.course_id));
    this.db.lesson_briefs = this.tableRows("lesson_briefs").filter((row) => !lessonIds.includes(row.lesson_id));
    this.db.lesson_content_links = this.tableRows("lesson_content_links").filter((row) => !lessonIds.includes(row.lesson_id));
    this.db.teaching_materials = this.tableRows("teaching_materials").filter((row) => !lessonIds.includes(row.lesson_id));
    this.db.reading_materials = this.tableRows("reading_materials").filter((row) => !lessonIds.includes(row.lesson_id));
  }

  async executeQuery(params: {
    table: string;
    action: "select" | "insert" | "update" | "delete" | "upsert";
    payload: any;
    filters: Array<(row: TableRow) => boolean>;
    selectedColumns: string;
    selectOptions: Record<string, any>;
    rowMode: "many" | "single" | "maybeSingle";
    orderBy: { column: string; ascending: boolean } | null;
  }): Promise<QueryResult<any>> {
    const rows = this.tableRows(params.table);
    const filtered = this.applyFilters(rows, params.filters);

    if (params.action === "select") {
      const ordered = this.applyOrder(filtered, params.orderBy);
      const hydrated = ordered.map((row) => this.hydrateRow(params.table, row));
      const count = params.selectOptions?.count === "exact" ? hydrated.length : null;
      if (params.selectOptions?.head) {
        return { data: null, error: null, count };
      }
      const shaped = this.shapeResult(hydrated, params.rowMode);
      return { ...shaped, count };
    }

    if (params.action === "insert" || params.action === "upsert") {
      const entries = Array.isArray(params.payload) ? params.payload : [params.payload];
      const inserted: TableRow[] = [];
      for (const entry of entries) {
        const row = { ...(entry || {}) };
        if (!row.id) row.id = uid(params.table.slice(0, 3));
        if (row.created_at == null) row.created_at = nowIso();
        if (params.table === "courses" && row.status == null) row.status = "ACTIVE";
        if (params.table === "plans") {
          if (row.status == null) row.status = "INCOMPLETE";
          if (row.fundamentacion == null) row.fundamentacion = "";
          if (row.estrategias_marco == null) row.estrategias_marco = "";
          if (row.estrategias_practicas == null) row.estrategias_practicas = [];
          if (row.evaluacion_marco == null) row.evaluacion_marco = "";
          if (row.resources == null) row.resources = "";
        }
        if (params.table === "lessons") {
          if (row.status == null) row.status = "IN_PROGRESS";
          if (row.is_generating == null) row.is_generating = false;
        }
        rows.push(row);
        inserted.push(this.hydrateRow(params.table, row));
      }
      this.persist();
      return this.shapeResult(inserted, params.rowMode);
    }

    if (params.action === "update") {
      const updated: TableRow[] = [];
      for (const row of filtered) {
        Object.assign(row, params.payload || {});
        updated.push(this.hydrateRow(params.table, row));
      }
      this.persist();
      return this.shapeResult(updated, params.rowMode);
    }

    if (params.action === "delete") {
      const idsToDelete = new Set(filtered.map((row) => row.id));
      this.db[params.table] = rows.filter((row) => !idsToDelete.has(row.id));
      if (params.table === "courses") {
        this.cascadeDeleteCourses(filtered.map((row) => row.id));
      }
      this.persist();
      return this.shapeResult(filtered, params.rowMode);
    }

    return { data: null, error: { message: `Unsupported action ${params.action}` } };
  }

  from(table: string) {
    return new MockQueryBuilder(this, table);
  }

  auth = {
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
      this.listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.listeners.delete(callback);
            },
          },
        },
      };
    },
    getSession: async (): Promise<QueryResult<{ session: Session | null }>> => {
      return { data: { session: this.session }, error: null };
    },
    signInWithPassword: async ({
      email,
    }: {
      email: string;
      password: string;
    }): Promise<QueryResult<{ user: User; session: Session }>> => {
      const user = buildUser(email || "studio@local.dev");
      this.session = buildSession(user);
      this.ensureUserRows(user);
      this.persist();
      this.emit("SIGNED_IN");
      return { data: { user, session: this.session }, error: null };
    },
    signUp: async ({
      email,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: { name?: string } };
    }): Promise<QueryResult<{ user: User; session: Session }>> => {
      const user = buildUser(email || "studio@local.dev", options?.data?.name);
      this.session = buildSession(user);
      this.ensureUserRows(user);
      this.persist();
      this.emit("SIGNED_IN");
      return { data: { user, session: this.session }, error: null };
    },
    signInWithOAuth: async ({
      provider,
    }: {
      provider: "google" | "apple";
      options?: { redirectTo?: string };
    }): Promise<QueryResult<{ provider: string }>> => {
      const user = buildUser(`${provider}@studio.local`, `Docente ${provider}`);
      this.session = buildSession(user);
      this.ensureUserRows(user);
      this.persist();
      this.emit("SIGNED_IN");
      return { data: { provider }, error: null };
    },
    signOut: async (): Promise<QueryResult<null>> => {
      this.session = null;
      this.persist();
      this.emit("SIGNED_OUT");
      return { data: null, error: null };
    },
    setSession: async (tokens: any): Promise<QueryResult<{ session: Session | null }>> => {
      const user = tokens?.user ? (tokens.user as User) : this.currentUser();
      this.session = user ? buildSession(user) : null;
      if (user) this.ensureUserRows(user);
      this.persist();
      this.emit("SIGNED_IN");
      return { data: { session: this.session }, error: null };
    },
  };

  functions = {
    invoke: async (name: string, payload?: { body?: any }): Promise<QueryResult<any>> => {
      const body = payload?.body || {};

      if (name === "resolve-curriculum-document") {
        const candidates = resolveMockProgram(body.province, body.subject, body.cycle, Number(body.year_level));
        if (candidates.length === 0) {
          return {
            data: {
              status: "not_found",
              reason: "No se encontro programa para esa combinacion en modo studio.",
              official_index_url: "https://www.abc.gob.ar",
            },
            error: null,
          };
        }
        if (candidates.length === 1) {
          return {
            data: { status: "resolved", document: candidates[0], official_index_url: "https://www.abc.gob.ar" },
            error: null,
          };
        }
        return {
          data: { status: "ambiguous", candidates, official_index_url: "https://www.abc.gob.ar" },
          error: null,
        };
      }

      if (name === "check-course-limit") {
        const userId = this.currentUser()?.id;
        const ent = this.tableRows("user_entitlements").find((row) => row.user_id === userId);
        const max = ent?.max_courses ?? 1;
        const current = this.tableRows("courses").filter(
          (row) => row.user_id === userId && row.status === "ACTIVE"
        ).length;
        return { data: { can_create: current < max, current, max }, error: null };
      }

      if (name === "bootstrap-course-plan") {
        const plan = this.tableRows("plans").find((row) => row.id === body.plan_id);
        const course = this.tableRows("courses").find((row) => row.id === body.course_id);
        const document = this.tableRows("curriculum_documents").find((row) => row.id === body.curriculum_document_id);
        if (!plan || !course || !document) {
          return { data: { error: "No se pudo bootstrapping en modo studio" }, error: null };
        }
        saveMockCurriculumForCourse(course.id, document as any);
        const draft = buildMockPlanDraft(course.subject || "Materia");
        Object.assign(plan, {
          status: "INCOMPLETE",
          fundamentacion: draft.fundamentacion,
          estrategias_marco: draft.estrategias_marco,
          estrategias_practicas: draft.estrategias_practicas,
          evaluacion_marco: draft.evaluacion_marco,
          resources: draft.resources,
        });
        this.db.plan_objectives = this.tableRows("plan_objectives").filter((row) => row.plan_id !== plan.id);
        this.db.plan_objectives.push(
          ...draft.objectives.map((objective, index) => ({
            id: uid("obj"),
            plan_id: plan.id,
            description: objective,
            order_index: index,
          }))
        );

        const existingLessons = this.tableRows("plan_lessons").filter((row) => row.plan_id === plan.id);
        for (const lesson of draft.lessons) {
          const target = existingLessons.find((row) => row.lesson_number === lesson.lesson_number);
          if (target) {
            Object.assign(target, lesson);
          }
        }
        this.persist();
        return { data: { plan_status: "INCOMPLETE", synthetic_nodes_created: false }, error: null };
      }

      if (name === "generate-materials") {
        const lessonId = body.lesson_id;
        const lesson = this.tableRows("lessons").find((row) => row.id === lessonId);
        if (!lesson) return { data: { error: "Leccion no encontrada" }, error: null };
        const planLesson = this.tableRows("plan_lessons").find((row) => row.id === lesson.plan_lesson_id);

        if (body.regenerate_only !== "reading") {
          const teachingRows = this.tableRows("teaching_materials");
          const existingTeaching = teachingRows.find((row) => row.lesson_id === lessonId);
          const teaching = {
            id: existingTeaching?.id || uid("tm"),
            lesson_id: lessonId,
            purpose: `Desarrollar ${planLesson?.theme || "el foco de la clase"} con produccion verificable.`,
            activities: [
              { title: "Inicio", description: "Activacion del saber previo", duration_minutes: 10, type: "inicio" },
              { title: "Desarrollo", description: "Trabajo guiado con fuentes", duration_minutes: 25, type: "desarrollo" },
              { title: "Cierre", description: "Socializacion y sintesis", duration_minutes: 10, type: "cierre" },
            ],
            expected_product: "Produccion breve verificable",
            achievement_criteria: ["Claridad conceptual", "Uso de evidencias"],
            differentiation: [
              { type: "apoyo", description: "Guia de pasos y ejemplos" },
              { type: "desafio", description: "Extension argumentativa adicional" },
            ],
            closure: "Cierre con proyeccion a la siguiente clase.",
            status: "VALIDATED",
          };
          if (existingTeaching) Object.assign(existingTeaching, teaching);
          else teachingRows.push(teaching);
        }

        if (body.regenerate_only !== "teaching") {
          const readingRows = this.tableRows("reading_materials");
          const existingReading = readingRows.find((row) => row.lesson_id === lessonId);
          const contentHtml =
            "<p>Este es un material de lectura generado en modo studio para validar flujo sin backend externo.</p>" +
            "<p>El contenido mantiene una estructura de texto corrido para pruebas de interfaz y revisiones didacticas.</p>";
          const reading = {
            id: existingReading?.id || uid("rm"),
            lesson_id: lessonId,
            word_count: 52,
            content_html: contentHtml,
            status: "VALIDATED",
            validation_reasons: [],
            pdf_url: null,
          };
          if (existingReading) Object.assign(existingReading, reading);
          else readingRows.push(reading);
        }

        lesson.is_generating = false;
        this.persist();
        return { data: { ok: true, reading_pdf_base64: null }, error: null };
      }

      if (name === "set-test-plan") {
        const userId = this.currentUser()?.id;
        if (!userId) return { data: { error: "Sin sesion activa" }, error: null };
        const planType = body.plan_type || "FREE";
        const subscription = this.tableRows("subscriptions").find((row) => row.user_id === userId);
        if (subscription) subscription.plan_type = planType;
        this.persist();
        return { data: { ok: true, plan_type: planType }, error: null };
      }

      if (name === "import-curriculum-pdf") {
        return { data: { imported: 0, mode: "studio" }, error: null };
      }

      return { data: { ok: true, mode: "studio", function_name: name }, error: null };
    },
  };

  rpc = async (name: string, params?: any): Promise<QueryResult<any>> => {
    if (name === "validate_plan") {
      const planId = params?.p_plan_id;
      const plan = this.tableRows("plans").find((row) => row.id === planId);
      if (!plan) return { data: { success: false, errors: ["Plan no encontrado"] }, error: null };
      plan.status = "VALIDATED";

      const planLessons = this.tableRows("plan_lessons").filter((row) => row.plan_id === planId);
      const existingLessons = this.tableRows("lessons");
      for (const planLesson of planLessons) {
        const exists = existingLessons.find((lesson) => lesson.plan_lesson_id === planLesson.id);
        if (!exists) {
          existingLessons.push({
            id: uid("les"),
            course_id: plan.course_id,
            plan_lesson_id: planLesson.id,
            lesson_number: planLesson.lesson_number,
            scheduled_date: null,
            status: "IN_PROGRESS",
            is_generating: false,
          });
        }
      }
      this.persist();
      return { data: { success: true, errors: [] }, error: null };
    }
    return { data: null, error: { message: `RPC ${name} not mocked` } };
  };

  storage = {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: any) => ({ data: { path: _path }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `mock://storage/${path}` } }),
    }),
  };
}

let clientSingleton: MockSupabaseClient | null = null;

export function createMockSupabaseClient(): any {
  if (!clientSingleton) {
    clientSingleton = new MockSupabaseClient();
  }
  return clientSingleton as any;
}

