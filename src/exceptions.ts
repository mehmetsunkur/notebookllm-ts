// Full exception hierarchy mirroring notebooklm-py

export class NotebookLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends NotebookLMError {}
export class ConfigurationError extends NotebookLMError {}

export class NetworkError extends NotebookLMError {}
export class RPCTimeoutError extends NetworkError {}

export class RPCError extends NotebookLMError {
  constructor(
    message: string,
    public readonly rpcId?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export class DecodingError extends RPCError {}
export class AuthError extends RPCError {}
export class RateLimitError extends RPCError {}
export class ServerError extends RPCError {}
export class ClientError extends RPCError {}

export class NotebookError extends NotebookLMError {}
export class NotebookNotFoundError extends NotebookError {}

export class SourceError extends NotebookLMError {}
export class SourceAddError extends SourceError {}
export class SourceNotFoundError extends SourceError {}
export class SourceProcessingError extends SourceError {}
export class SourceTimeoutError extends SourceError {}

export class ArtifactError extends NotebookLMError {}
export class ArtifactNotFoundError extends ArtifactError {}
export class ArtifactNotReadyError extends ArtifactError {}
export class ArtifactParseError extends ArtifactError {}
export class ArtifactDownloadError extends ArtifactError {}
