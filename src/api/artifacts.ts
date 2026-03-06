import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Artifact, ArtifactTask, ArtifactType } from "../types.ts";
import {
  ArtifactNotFoundError,
  ArtifactNotReadyError,
  ArtifactDownloadError,
  ArtifactParseError,
} from "../exceptions.ts";

export class ArtifactsAPI extends ClientCore {
  async list(notebookId: string, type?: ArtifactType): Promise<Artifact[]> {
    const raw = await this.rpc(RPCMethod.LIST_ARTIFACTS, [notebookId, type ?? null]);
    const artifacts = parseArtifactList(raw);
    if (type) return artifacts.filter((a) => a.type === type);
    return artifacts;
  }

  async get(notebookId: string, artifactId: string): Promise<Artifact> {
    const raw = await this.rpc(RPCMethod.GET_ARTIFACT, [notebookId, artifactId]);
    return parseArtifact(raw);
  }

  async rename(notebookId: string, artifactId: string, newTitle: string): Promise<Artifact> {
    const raw = await this.rpc(RPCMethod.RENAME_ARTIFACT, [notebookId, artifactId, newTitle]);
    return parseArtifact(raw);
  }

  async delete(notebookId: string, artifactId: string): Promise<void> {
    await this.rpc(RPCMethod.DELETE_ARTIFACT, [notebookId, artifactId]);
  }

  async export(
    notebookId: string,
    artifactId: string,
    exportType?: string,
    title?: string,
  ): Promise<string> {
    const raw = await this.rpc(RPCMethod.EXPORT_ARTIFACT, [
      notebookId,
      artifactId,
      exportType ?? null,
      title ?? null,
    ]);
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return String(raw);
  }

  async poll(taskId: string): Promise<ArtifactTask> {
    const raw = await this.rpc(RPCMethod.POLL_ARTIFACT_TASK, [taskId]);
    return parseArtifactTask(raw);
  }

  async wait(
    notebookId: string,
    artifactId: string,
    options: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<Artifact> {
    const timeout = options.timeoutMs ?? 10 * 60 * 1000;
    const interval = options.intervalMs ?? 5000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const artifact = await this.get(notebookId, artifactId);
      if (artifact.status === "ready") return artifact;
      if (artifact.status === "failed") {
        throw new ArtifactNotReadyError(`Artifact generation failed: ${artifactId}`);
      }
      await sleep(interval);
    }

    throw new ArtifactNotReadyError(
      `Artifact ${artifactId} was not ready within timeout`,
    );
  }

  async pollTask(
    taskId: string,
    options: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<ArtifactTask> {
    const timeout = options.timeoutMs ?? 10 * 60 * 1000;
    const interval = options.intervalMs ?? 5000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const task = await this.poll(taskId);
      if (task.status === "ready") return task;
      if (task.status === "failed") {
        throw new ArtifactNotReadyError(`Artifact task failed: ${taskId}`);
      }
      await sleep(interval);
    }

    throw new ArtifactNotReadyError(`Task ${taskId} timed out`);
  }

  async download(notebookId: string, artifactId: string): Promise<Uint8Array> {
    const artifact = await this.get(notebookId, artifactId);
    if (artifact.status !== "ready") {
      throw new ArtifactNotReadyError(`Artifact ${artifactId} is not ready (status: ${artifact.status})`);
    }
    if (!artifact.downloadUrl) {
      throw new ArtifactDownloadError(`No download URL for artifact ${artifactId}`);
    }
    return this.downloadBinary(artifact.downloadUrl);
  }

  async suggestions(
    notebookId: string,
    sourceIds?: string[],
  ): Promise<string[]> {
    const raw = await this.rpc(RPCMethod.ARTIFACT_SUGGESTIONS, [
      notebookId,
      sourceIds ?? null,
    ]);
    if (Array.isArray(raw)) return (raw as unknown[]).map(String);
    return [];
  }

  async findById(notebookId: string, partialId: string): Promise<Artifact> {
    const artifacts = await this.list(notebookId);
    const match = artifacts.find(
      (a) => a.id === partialId || a.id.startsWith(partialId),
    );
    if (!match) {
      throw new ArtifactNotFoundError(`No artifact found matching ID prefix: ${partialId}`);
    }
    return match;
  }
}

// --- Generate methods (separate class that extends ArtifactsAPI) ---

export interface GenerateOptions {
  sourceIds?: string[];
  language?: string;
  wait?: boolean;
  retry?: number;
}

export interface AudioOptions extends GenerateOptions {
  description?: string;
  format?: string;
  length?: string;
}

export interface VideoOptions extends GenerateOptions {
  description?: string;
  format?: string;
  style?: string;
}

export interface SlideDeckOptions extends GenerateOptions {
  description?: string;
  format?: string;
  length?: string;
}

export interface QuizOptions extends GenerateOptions {
  description?: string;
  difficulty?: string;
  quantity?: number;
}

export interface FlashcardsOptions extends GenerateOptions {
  description?: string;
  difficulty?: string;
  quantity?: number;
}

export interface InfographicOptions extends GenerateOptions {
  description?: string;
  orientation?: string;
  detail?: string;
}

export interface DataTableOptions extends GenerateOptions {
  description: string;
}

export interface ReportOptions extends GenerateOptions {
  description?: string;
  format?: string;
  append?: boolean;
}

export interface ReviseSlideOptions extends GenerateOptions {
  artifactId: string;
  slideNumber: number;
  description: string;
}

export class GenerateAPI extends ArtifactsAPI {
  private async generate(
    notebookId: string,
    method: string,
    params: unknown[],
    options: GenerateOptions,
  ): Promise<Artifact | ArtifactTask> {
    const payload = [notebookId, ...params, options.sourceIds ?? null, options.language ?? null];
    const raw = await this.rpc(method, payload);
    const task = parseArtifactTask(raw);

    if (options.wait) {
      return this.pollTask(task.taskId);
    }
    return task;
  }

  async generateAudio(notebookId: string, options: AudioOptions = {}): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_AUDIO, [
      options.description ?? null,
      options.format ?? null,
      options.length ?? null,
    ], options);
  }

  async generateVideo(notebookId: string, options: VideoOptions = {}): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_VIDEO, [
      options.description ?? null,
      options.format ?? null,
      options.style ?? null,
    ], options);
  }

  async generateSlideDeck(notebookId: string, options: SlideDeckOptions = {}): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_SLIDE_DECK, [
      options.description ?? null,
      options.format ?? null,
      options.length ?? null,
    ], options);
  }

  async reviseSlide(notebookId: string, options: ReviseSlideOptions): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.REVISE_SLIDE, [
      options.description,
      options.artifactId,
      options.slideNumber,
    ], options);
  }

  async generateQuiz(notebookId: string, options: QuizOptions = {}): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_QUIZ, [
      options.description ?? null,
      options.difficulty ?? null,
      options.quantity ?? null,
    ], options);
  }

  async generateFlashcards(notebookId: string, options: FlashcardsOptions = {}): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_FLASHCARDS, [
      options.description ?? null,
      options.difficulty ?? null,
      options.quantity ?? null,
    ], options);
  }

  async generateInfographic(notebookId: string, options: InfographicOptions = {}): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_INFOGRAPHIC, [
      options.description ?? null,
      options.orientation ?? null,
      options.detail ?? null,
    ], options);
  }

  async generateDataTable(notebookId: string, options: DataTableOptions): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_DATA_TABLE, [
      options.description,
    ], options);
  }

  async generateMindMap(notebookId: string, options: GenerateOptions = {}): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_MIND_MAP, [], options);
  }

  async generateReport(notebookId: string, options: ReportOptions = {}): Promise<Artifact | ArtifactTask> {
    return this.generate(notebookId, RPCMethod.GENERATE_REPORT, [
      options.description ?? null,
      options.format ?? null,
      options.append ?? false,
    ], options);
  }
}

// --- Parsers ---

function parseArtifact(raw: unknown): Artifact {
  if (!Array.isArray(raw)) {
    return { id: "", type: "audio", title: "", status: "unknown" };
  }
  const arr = raw as unknown[];
  return {
    id: String(arr[0] ?? ""),
    type: (arr[1] as ArtifactType) ?? "audio",
    title: String(arr[2] ?? ""),
    status: (arr[3] as Artifact["status"]) ?? "unknown",
    taskId: typeof arr[4] === "string" ? arr[4] : undefined,
    createdMs: typeof arr[5] === "number" ? arr[5] : undefined,
    downloadUrl: typeof arr[6] === "string" ? arr[6] : undefined,
  };
}

function parseArtifactList(raw: unknown): Artifact[] {
  if (!Array.isArray(raw)) return [];
  const outer = raw as unknown[];
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;
  return list.filter(Array.isArray).map(parseArtifact);
}

function parseArtifactTask(raw: unknown): ArtifactTask {
  if (!Array.isArray(raw)) {
    return { taskId: String(raw), status: "generating" };
  }
  const arr = raw as unknown[];
  return {
    taskId: String(arr[0] ?? ""),
    artifactId: typeof arr[1] === "string" ? arr[1] : undefined,
    status: (arr[2] as ArtifactTask["status"]) ?? "generating",
    progress: typeof arr[3] === "number" ? arr[3] : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
