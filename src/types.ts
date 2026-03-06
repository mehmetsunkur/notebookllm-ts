// Shared TypeScript interfaces and types

export type SourceType = "url" | "file" | "text" | "drive" | "research";
export type SourceStatus = "processing" | "ready" | "failed" | "unknown";

export type ArtifactType =
  | "audio"
  | "video"
  | "quiz"
  | "flashcards"
  | "study_guide"
  | "briefing_doc"
  | "faq"
  | "timeline"
  | "infographic"
  | "slide_deck"
  | "data_table"
  | "mind_map"
  | "report";

export type ArtifactStatus = "generating" | "ready" | "failed" | "unknown";

export type Permission = "viewer" | "commenter" | "editor";

export interface Notebook {
  id: string;
  title: string;
  createdMs?: number;
  updatedMs?: number;
  sourceCount?: number;
  sources?: Source[];
  artifacts?: Artifact[];
  shareSettings?: ShareSettings;
}

export interface Source {
  id: string;
  title: string;
  type?: SourceType;
  status?: SourceStatus;
  url?: string;
  createdMs?: number;
  updatedMs?: number;
}

export interface SourceFullText {
  sourceId: string;
  content: string;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  taskId?: string;
  createdMs?: number;
  updatedMs?: number;
  content?: string | Record<string, unknown>;
  downloadUrl?: string;
}

export interface ArtifactTask {
  taskId: string;
  artifactId?: string;
  status: ArtifactStatus;
  progress?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceCitation[];
  timestamp?: number;
}

export interface SourceCitation {
  sourceId: string;
  text?: string;
}

export interface ChatResponse {
  answer: string;
  citations?: SourceCitation[];
  conversationId?: string;
  followUpQuestions?: string[];
}

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  status: "pending" | "processing" | "ready" | "failed";
  summary?: string;
}

export interface ResearchStatus {
  status: "idle" | "running" | "complete" | "failed";
  sources?: ResearchSource[];
  query?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdMs?: number;
  updatedMs?: number;
}

export interface ShareSettings {
  isPublic: boolean;
  shareLink?: string;
  viewLevel?: "view" | "comment" | "edit";
  collaborators?: Collaborator[];
}

export interface Collaborator {
  email: string;
  permission: Permission;
  addedMs?: number;
}

export interface Language {
  code: string;
  name: string;
}

export interface AuthTokens {
  /** CSRF token (SNLM0e) */
  snlm0e: string;
  /** Session SID (FdrFJe) */
  fdrfje: string;
  /** Blob hash (cfb2h / bl) */
  cfb2h: string;
}

export interface Context {
  notebookId?: string;
  conversationId?: string;
}

export interface Config {
  language?: string;
}

export interface StorageState {
  cookies: CookieEntry[];
  origins?: OriginEntry[];
}

export interface CookieEntry {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

export interface OriginEntry {
  origin: string;
  localStorage?: { name: string; value: string }[];
}

// CLI-specific option types
export interface GlobalOptions {
  storage?: string;
  verbose?: boolean;
  json?: boolean;
}

export interface GenerateOptions {
  source?: string[];
  language?: string;
  wait?: boolean;
  retry?: number;
  json?: boolean;
}

export interface DownloadOptions {
  all?: boolean;
  latest?: boolean;
  earliest?: boolean;
  name?: string;
  dryRun?: boolean;
  force?: boolean;
  format?: string;
}
