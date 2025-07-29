/**
 * Interface defining the structure of a webhook request record
 */
export interface RequestRecord {
  /** Unique identifier for the request (UUID) */
  id: string;
  /** Timestamp when the request was received */
  timestamp: Date;
  /** IP address of the client that sent the request */
  ip: string;
  /** HTTP method (POST or PUT) */
  method: 'POST' | 'PUT';
  /** Request path */
  path: string;
  /** HTTP headers as key-value pairs */
  headers: Record<string, string>;
  /** Request body as string */
  body: string;
  /** Content-Type header value (optional) */
  contentType?: string;
  /** Size of the request body in bytes */
  bodySize: number;
}

/**
 * Interface defining metadata about the storage file
 */
export interface StorageMetadata {
  /** Version of the storage schema */
  version: string;
  /** Timestamp of the last cleanup operation */
  lastCleanup: Date;
  /** Total number of requests received since storage initialization */
  totalRequestsReceived: number;
}

/**
 * Interface defining the overall structure of the storage file
 */
export interface StorageSchema {
  /** Storage metadata */
  metadata: StorageMetadata;
  /** Array of stored webhook requests */
  requests: RequestRecord[];
}
