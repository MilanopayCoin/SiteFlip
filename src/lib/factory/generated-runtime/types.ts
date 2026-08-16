/** Durable generated-app runtime artifact (persisted in factory_projects.sandbox). */

export const GENERATED_APP_MARKER = 'data-jiy-generated-app="1"';
export const GENERATED_APP_ERROR_MARKER = 'data-jiy-generated-app-error="1"';

export const MVP_PAGES = [
  "landing",
  "register",
  "login",
  "dashboard",
  "customers",
  "services",
  "bookings",
  "calendar",
  "settings",
] as const;

export type MvpPageId = (typeof MVP_PAGES)[number];

export interface GeneratedRuntimeArtifact {
  projectId: string;
  businessId: string;
  version: string;
  buildId: string;
  artifactId: string;
  entrypoint: string;
  runtimeKind: "platform_html_mvp";
  pages: string[];
  appName: string;
  createdAt: string;
}

export type RuntimeStage =
  | "resolve_project"
  | "load_artifact"
  | "render_app"
  | "verify_http"
  | "error";

export interface RuntimeLogFields {
  projectId: string;
  buildId: string | null;
  artifactId: string | null;
  runtimeStage: RuntimeStage;
  httpStatus: number;
  page?: string;
  error?: string;
}
