// Public API exports for programmatic use of notebooklm-ts

export { NotebookLMClient } from "./api/client.ts";
export type { CoreOptions } from "./api/core.ts";

// API sub-namespaces (for advanced use)
export { NotebooksAPI } from "./api/notebooks.ts";
export { SourcesAPI } from "./api/sources.ts";
export { GenerateAPI, ArtifactsAPI } from "./api/artifacts.ts";
export { ChatAPI } from "./api/chat.ts";
export { ResearchAPI } from "./api/research.ts";
export { NotesAPI } from "./api/notes.ts";
export { SettingsAPI } from "./api/settings.ts";
export { SharingAPI } from "./api/sharing.ts";

// Types
export type {
  Notebook,
  Source,
  SourceType,
  SourceStatus,
  SourceFullText,
  Artifact,
  ArtifactType,
  ArtifactStatus,
  ArtifactTask,
  ChatMessage,
  ChatResponse,
  SourceCitation,
  ResearchSource,
  ResearchStatus,
  Note,
  ShareSettings,
  Collaborator,
  Permission,
  Language,
  AuthTokens,
  Context,
  Config,
  StorageState,
} from "./types.ts";

// Exceptions
export {
  NotebookLMError,
  ValidationError,
  ConfigurationError,
  NetworkError,
  RPCTimeoutError,
  RPCError,
  DecodingError,
  AuthError,
  RateLimitError,
  ServerError,
  ClientError,
  NotebookError,
  NotebookNotFoundError,
  SourceError,
  SourceAddError,
  SourceNotFoundError,
  SourceProcessingError,
  SourceTimeoutError,
  ArtifactError,
  ArtifactNotFoundError,
  ArtifactNotReadyError,
  ArtifactParseError,
  ArtifactDownloadError,
} from "./exceptions.ts";

// Low-level RPC utilities (for advanced users)
export { encodeRequest, encodeMultiRequest } from "./rpc/encoder.ts";
export { decodeResponse, decodeMultiResponse, splitChunks, parseChunk } from "./rpc/decoder.ts";
export { RPCMethod } from "./rpc/methods.ts";

// Auth utilities
export { fetchTokens, extractTokensFromHtml } from "./auth/tokens.ts";
export { loadCookieHeader, loadAuthFromStorage, buildCookieHeader } from "./auth/storage.ts";
export { login } from "./auth/login.ts";

// Path utilities
export { getHomeDir, getStoragePath, getContextPath, getConfigPath } from "./paths.ts";
