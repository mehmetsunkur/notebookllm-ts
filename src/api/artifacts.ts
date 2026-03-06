import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Artifact, ArtifactTask, ArtifactType } from "../types.ts";
import {
  ArtifactNotFoundError,
  ArtifactNotReadyError,
  ArtifactDownloadError,
} from "../exceptions.ts";

export class ArtifactsAPI extends ClientCore {
  async list(notebookId: string, type?: ArtifactType): Promise<Artifact[]> {
    const raw = await this.rpc(
      RPCMethod.LIST_ARTIFACTS,
      [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"'],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    const artifacts = parseArtifactList(raw);
    if (type) return artifacts.filter((a) => a.type === type);
    return artifacts;
  }

  async get(notebookId: string, artifactId: string): Promise<Artifact> {
    const artifacts = await this.list(notebookId);
    const artifact = artifacts.find((a) => a.id === artifactId);
    if (!artifact) {
      throw new ArtifactNotFoundError(`No artifact found: ${artifactId}`);
    }
    return artifact;
  }

  async rename(notebookId: string, artifactId: string, newTitle: string): Promise<Artifact> {
    await this.rpc(
      RPCMethod.RENAME_ARTIFACT,
      [[artifactId, newTitle], [["title"]]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    return this.get(notebookId, artifactId);
  }

  async delete(notebookId: string, artifactId: string): Promise<void> {
    await this.rpc(
      RPCMethod.DELETE_ARTIFACT,
      [[2], artifactId],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
  }

  async export(
    notebookId: string,
    artifactId: string,
    exportType?: string,
    title?: string,
  ): Promise<string> {
    const exportCode = exportType?.toLowerCase() === "sheets" ? 2 : 1;
    const raw = await this.rpc(
      RPCMethod.EXPORT_ARTIFACT,
      [null, artifactId, null, title ?? "Export", exportCode],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return JSON.stringify(raw);
  }

  async poll(taskId: string): Promise<ArtifactTask> {
    const raw = await this.rpc(RPCMethod.POLL_ARTIFACT_TASK, [taskId], {
      allowNull: true,
    });
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
    _sourceIds?: string[],
  ): Promise<string[]> {
    const raw = await this.rpc(
      RPCMethod.GET_SUGGESTED_REPORTS,
      [[2], notebookId],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    if (!Array.isArray(raw)) return [];

    const items = Array.isArray(raw[0]) ? raw[0] : raw;
    return items
      .filter(Array.isArray)
      .map((item) => String((item as unknown[])[0] ?? ""))
      .filter((v) => v.length > 0);
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
  private async createArtifact(notebookId: string, artifactPayload: unknown[], wait?: boolean): Promise<Artifact | ArtifactTask> {
    const before = await this.list(notebookId);
    const raw = await this.rpc(
      RPCMethod.CREATE_ARTIFACT,
      [[2], notebookId, artifactPayload],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    if (this.verbose) {
      console.error(`[ARTIFACT] create raw: ${safeJson(raw)}`);
    }
    const task = parseArtifactTask(raw);
    const effectiveTaskId = task.taskId || (await this.inferNewArtifactId(notebookId, before));

    if (wait && effectiveTaskId) {
      return this.wait(notebookId, effectiveTaskId);
    }
    if (effectiveTaskId) return { ...task, taskId: effectiveTaskId };
    return task;
  }

  async generateAudio(notebookId: string, options: AudioOptions = {}): Promise<Artifact | ArtifactTask> {
    const sourceTriple = (options.sourceIds ?? []).map((sid) => [[sid]]);
    const sourceDouble = (options.sourceIds ?? []).map((sid) => [sid]);

    const payload = [
      null,
      null,
      1,
      sourceTriple,
      null,
      null,
      [
        null,
        [
          options.description ?? null,
          mapAudioLength(options.length),
          null,
          sourceDouble,
          options.language ?? "en",
          null,
          mapAudioFormat(options.format),
        ],
      ],
    ];

    return this.createArtifact(notebookId, payload, options.wait);
  }

  async generateVideo(notebookId: string, options: VideoOptions = {}): Promise<Artifact | ArtifactTask> {
    const sourceTriple = (options.sourceIds ?? []).map((sid) => [[sid]]);
    const sourceDouble = (options.sourceIds ?? []).map((sid) => [sid]);

    const payload = [
      null,
      null,
      3,
      sourceTriple,
      null,
      null,
      null,
      null,
      [
        null,
        null,
        [
          sourceDouble,
          options.language ?? "en",
          options.description ?? null,
          null,
          mapVideoFormat(options.format),
          mapVideoStyle(options.style),
        ],
      ],
    ];

    return this.createArtifact(notebookId, payload, options.wait);
  }

  async generateSlideDeck(notebookId: string, options: SlideDeckOptions = {}): Promise<Artifact | ArtifactTask> {
    const sourceTriple = (options.sourceIds ?? []).map((sid) => [[sid]]);

    const payload = [
      null,
      null,
      8,
      sourceTriple,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      [[options.description ?? null, options.language ?? "en", mapSlideFormat(options.format), mapSlideLength(options.length)]],
    ];

    return this.createArtifact(notebookId, payload, options.wait);
  }

  async reviseSlide(notebookId: string, options: ReviseSlideOptions): Promise<Artifact | ArtifactTask> {
    const before = await this.list(notebookId);
    const raw = await this.rpc(
      RPCMethod.REVISE_SLIDE,
      [[2], options.artifactId, [[[options.slideNumber, options.description]]]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    const task = parseArtifactTask(raw);
    const effectiveTaskId = task.taskId || (await this.inferNewArtifactId(notebookId, before));
    if (options.wait && effectiveTaskId) {
      return this.wait(notebookId, effectiveTaskId);
    }
    if (effectiveTaskId) return { ...task, taskId: effectiveTaskId };
    return task;
  }

  async generateQuiz(notebookId: string, options: QuizOptions = {}): Promise<Artifact | ArtifactTask> {
    const sourceTriple = (options.sourceIds ?? []).map((sid) => [[sid]]);

    const payload = [
      null,
      null,
      4,
      sourceTriple,
      null,
      null,
      null,
      null,
      null,
      [
        null,
        [
          2,
          null,
          options.description ?? null,
          null,
          null,
          null,
          null,
          [mapQuizQuantity(options.quantity), mapQuizDifficulty(options.difficulty)],
        ],
      ],
    ];

    return this.createArtifact(notebookId, payload, options.wait);
  }

  async generateFlashcards(notebookId: string, options: FlashcardsOptions = {}): Promise<Artifact | ArtifactTask> {
    const sourceTriple = (options.sourceIds ?? []).map((sid) => [[sid]]);

    const payload = [
      null,
      null,
      4,
      sourceTriple,
      null,
      null,
      null,
      null,
      null,
      [
        null,
        [
          1,
          null,
          options.description ?? null,
          null,
          null,
          null,
          [mapQuizDifficulty(options.difficulty), mapQuizQuantity(options.quantity)],
        ],
      ],
    ];

    return this.createArtifact(notebookId, payload, options.wait);
  }

  async generateInfographic(notebookId: string, options: InfographicOptions = {}): Promise<Artifact | ArtifactTask> {
    const sourceTriple = (options.sourceIds ?? []).map((sid) => [[sid]]);

    const payload = [
      null,
      null,
      7,
      sourceTriple,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      [[
        options.description ?? null,
        options.language ?? "en",
        null,
        mapInfographicOrientation(options.orientation),
        mapInfographicDetail(options.detail),
      ]],
    ];

    return this.createArtifact(notebookId, payload, options.wait);
  }

  async generateDataTable(notebookId: string, options: DataTableOptions): Promise<Artifact | ArtifactTask> {
    const sourceTriple = (options.sourceIds ?? []).map((sid) => [[sid]]);

    const payload = [
      null,
      null,
      9,
      sourceTriple,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      [null, [options.description, options.language ?? "en"]],
    ];

    return this.createArtifact(notebookId, payload, options.wait);
  }

  async generateMindMap(notebookId: string, options: GenerateOptions = {}): Promise<Artifact | ArtifactTask> {
    const sourceNested = (options.sourceIds ?? []).map((sid) => [[sid]]);
    const raw = await this.rpc(
      RPCMethod.GENERATE_MIND_MAP,
      [
        sourceNested,
        null,
        null,
        null,
        null,
        ["interactive_mindmap", [["[CONTEXT]", ""]], ""],
        null,
        [2, null, [1]],
      ],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );

    const task = parseArtifactTask(raw);
    return task;
  }

  async generateReport(notebookId: string, options: ReportOptions = {}): Promise<Artifact | ArtifactTask> {
    const sourceTriple = (options.sourceIds ?? []).map((sid) => [[sid]]);
    const sourceDouble = (options.sourceIds ?? []).map((sid) => [sid]);

    const reportTitle = mapReportTitle(options.format);
    const reportDescription = mapReportDescription(options.format);

    const payload = [
      null,
      null,
      2,
      sourceTriple,
      null,
      null,
      null,
      [
        null,
        [
          reportTitle,
          reportDescription,
          null,
          sourceDouble,
          options.language ?? "en",
          options.description ?? null,
          null,
          true,
        ],
      ],
    ];

    return this.createArtifact(notebookId, payload, options.wait);
  }

  private async inferNewArtifactId(notebookId: string, before: Artifact[]): Promise<string | undefined> {
    const beforeIds = new Set(before.map((a) => a.id));
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const after = await this.list(notebookId);
      const created = after.find((a) => !beforeIds.has(a.id));
      if (created?.id) return created.id;
      if (attempt < 5) {
        await sleep(2000);
      }
    }
    const latest = await this.list(notebookId);
    if (latest[0]?.id) return latest[0].id;
    return undefined;
  }
}

function parseArtifact(raw: unknown): Artifact {
  if (!Array.isArray(raw)) {
    return { id: "", type: "audio", title: "", status: "unknown" };
  }
  const arr = raw as unknown[];
  const data = Array.isArray(arr[1]) ? (arr[1] as unknown[]) : arr;
  return {
    id: String(data[0] ?? arr[0] ?? ""),
    type: mapArtifactType(data[2]),
    title: String(data[1] ?? arr[1] ?? ""),
    status: mapArtifactStatus(data[4] ?? arr[3]),
    taskId: typeof data[0] === "string" ? data[0] : undefined,
    createdMs: undefined,
    downloadUrl: extractDownloadUrl(data),
  };
}

function parseArtifactList(raw: unknown): Artifact[] {
  if (!Array.isArray(raw)) return [];
  const outer = raw as unknown[];
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;
  return list
    .filter(Array.isArray)
    .map((item) => parseArtifact(item))
    .filter((a) => a.id.length > 0);
}

function parseArtifactTask(raw: unknown): ArtifactTask {
  let taskId = "";
  let status: ArtifactTask["status"] = "failed";

  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    const artifactData = raw[0] as unknown[];
    if (typeof artifactData[0] === "string" && isUuid(artifactData[0])) {
      taskId = artifactData[0];
      status = mapArtifactStatus(artifactData[4]);
    }
  }
  if (!taskId) {
    taskId = extractFirstUuid(raw) ?? "";
    status = taskId ? "generating" : "failed";
  }

  return {
    taskId,
    artifactId: undefined,
    status,
  };
}

function extractFirstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractFirstString(item);
      if (nested) return nested;
    }
  }
  return undefined;
}

function extractFirstUuid(value: unknown): string | undefined {
  if (typeof value === "string") {
    const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return match ? match[0] : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractFirstUuid(item);
      if (nested) return nested;
    }
  }
  return undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractDownloadUrl(data: unknown[]): string | undefined {
  const candidates = [data[6], data[7], data[8]];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return undefined;
}

function mapArtifactStatus(status: unknown): Artifact["status"] {
  if (status === 1 || status === 2) return "generating";
  if (status === 3 || status === "ready" || status === "completed") return "ready";
  if (status === 4 || status === "failed") return "failed";
  return "unknown";
}

function mapArtifactType(typeCode: unknown): ArtifactType {
  if (typeCode === 1) return "audio";
  if (typeCode === 2) return "report";
  if (typeCode === 3) return "video";
  if (typeCode === 4) return "quiz";
  if (typeCode === 5) return "mind_map";
  if (typeCode === 7) return "infographic";
  if (typeCode === 8) return "slide_deck";
  if (typeCode === 9) return "data_table";
  return "report";
}

function mapAudioFormat(format?: string): number | null {
  const f = format?.toLowerCase();
  if (f === "deep_dive" || f === "deep-dive") return 1;
  if (f === "brief") return 2;
  if (f === "critique") return 3;
  if (f === "debate") return 4;
  return null;
}

function mapAudioLength(length?: string): number | null {
  const l = length?.toLowerCase();
  if (l === "short") return 1;
  if (l === "long") return 3;
  if (l === "medium" || l === "default") return 2;
  return null;
}

function mapVideoFormat(format?: string): number | null {
  const f = format?.toLowerCase();
  if (f === "explainer") return 1;
  if (f === "brief") return 2;
  return null;
}

function mapVideoStyle(style?: string): number | null {
  const s = style?.toLowerCase();
  if (s === "auto" || s === "auto_select") return 1;
  if (s === "classic") return 3;
  if (s === "whiteboard") return 4;
  return null;
}

function mapQuizQuantity(quantity?: number): number | null {
  if (quantity == null) return null;
  if (quantity <= 5) return 1;
  return 2;
}

function mapQuizDifficulty(difficulty?: string): number | null {
  const d = difficulty?.toLowerCase();
  if (d === "easy") return 1;
  if (d === "medium") return 2;
  if (d === "hard") return 3;
  return null;
}

function mapInfographicOrientation(orientation?: string): number | null {
  const o = orientation?.toLowerCase();
  if (o === "landscape") return 1;
  if (o === "portrait") return 2;
  if (o === "square") return 3;
  return null;
}

function mapInfographicDetail(detail?: string): number | null {
  const d = detail?.toLowerCase();
  if (d === "low" || d === "concise") return 1;
  if (d === "medium" || d === "standard") return 2;
  if (d === "high" || d === "detailed") return 3;
  return null;
}

function mapSlideFormat(format?: string): number | null {
  const f = format?.toLowerCase();
  if (f === "detailed" || f === "detailed_deck") return 1;
  if (f === "presenter" || f === "presenter_slides") return 2;
  return null;
}

function mapSlideLength(length?: string): number | null {
  const l = length?.toLowerCase();
  if (l === "short") return 2;
  if (l === "default" || l === "medium") return 1;
  return null;
}

function mapReportTitle(format?: string): string {
  const f = format?.toLowerCase();
  if (f === "study_guide" || f === "study-guide") return "Study Guide";
  if (f === "blog_post" || f === "blog-post") return "Blog Post";
  if (f === "custom") return "Custom Report";
  return "Briefing Doc";
}

function mapReportDescription(format?: string): string {
  const f = format?.toLowerCase();
  if (f === "study_guide" || f === "study-guide") {
    return "Short-answer quiz, essay questions, glossary";
  }
  if (f === "blog_post" || f === "blog-post") {
    return "Insightful takeaways in readable article format";
  }
  if (f === "custom") {
    return "Custom format";
  }
  return "Key insights and important quotes";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
