export type AppMode = "studio" | "production";
export type DataProvider = "mock" | "supabase" | "firebase";
export type AiProvider = "mock" | "google";

function normalize(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = normalize(value);
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

const requestedMode = normalize(import.meta.env.VITE_APP_MODE);

export const APP_MODE: AppMode =
  requestedMode === "studio" || import.meta.env.MODE === "studio" ? "studio" : "production";

const requestedDataProvider = normalize(import.meta.env.VITE_DATA_PROVIDER);
const requestedAiProvider = normalize(import.meta.env.VITE_AI_PROVIDER);

export const DATA_PROVIDER: DataProvider =
  requestedDataProvider === "firebase" || requestedDataProvider === "supabase" || requestedDataProvider === "mock"
    ? (requestedDataProvider as DataProvider)
    : APP_MODE === "studio"
      ? "mock"
      : "supabase";

export const AI_PROVIDER: AiProvider =
  requestedAiProvider === "google" || requestedAiProvider === "mock"
    ? (requestedAiProvider as AiProvider)
    : APP_MODE === "studio"
      ? "mock"
      : "google";

export const IS_STUDIO_MODE = APP_MODE === "studio";
export const USE_MOCK_DATA_PROVIDER = DATA_PROVIDER === "mock";
export const STUDIO_AUTO_LOGIN = readBool(import.meta.env.VITE_STUDIO_AUTO_LOGIN, true);
