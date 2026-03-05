import { APP_MODE as RUNTIME_APP_MODE, IS_STUDIO_MODE } from "@/config/runtime";

export type AppMode = "simulation" | "production";
export const APP_MODE: AppMode = IS_STUDIO_MODE ? "simulation" : "production";
export const IS_SIMULATION = IS_STUDIO_MODE;
export const RUNTIME_MODE = RUNTIME_APP_MODE;
