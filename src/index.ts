// Public API exports for programmatic use of notebooklm-ts

export { NotebookLMClient } from "./api/client.js";
export type { CoreOptions } from "./api/core.js";

// API sub-namespaces (for advanced use)
export { NotebooksAPI } from "./api/notebooks.js";
export { SourcesAPI } from "./api/sources.js";
export { GenerateAPI, ArtifactsAPI } from "./api/artifacts.js";
export { ChatAPI } from "./api/chat.js";
export { ResearchAPI } from "./api/research.js";
export { NotesAPI } from "./api/notes.js";
export { SettingsAPI } from "./api/settings.js";
export { SharingAPI } from "./api/sharing.js";

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
} from "./types.js";

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
} from "./exceptions.js";

// Low-level RPC utilities (for advanced users)
export { encodeRequest, encodeMultiRequest } from "./rpc/encoder.js";
export { decodeResponse, decodeMultiResponse, splitChunks, parseChunk } from "./rpc/decoder.js";
export { RPCMethod } from "./rpc/methods.js";

// Auth utilities
export { fetchTokens, extractTokensFromHtml } from "./auth/tokens.js";
export { loadCookieHeader, loadAuthFromStorage, buildCookieHeader } from "./auth/storage.js";
export { login } from "./auth/login.js";

// Path utilities
export { getHomeDir, getStoragePath, getContextPath, getConfigPath } from "./paths.js";
