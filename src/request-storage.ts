import { WebhookConfig } from './config';

/**
 * Interface for webhook request data
 */
export interface WebhookRequest {
  /** Unique identifier for the request */
  id: string;
  /** Timestamp when the request was received */
  timestamp: Date;
  /** HTTP method (POST, PUT, etc.) */
  method: string;
  /** Request path */
  path: string;
  /** Request headers */
  headers: Record<string, string | string[]>;
  /** Request body */
  body: unknown;
  /** Response status code sent back */
  responseCode: number;
}

/**
 * Interface defining the request storage contract
 */
export interface RequestStorage {
  /**
   * Add a new webhook request to storage
   * @param request The request data to store
   */
  addRequest(request: WebhookRequest): void;

  /**
   * Get all stored requests
   * @returns Array of stored webhook requests
   */
  getRequests(): WebhookRequest[];

  /**
   * Get the total number of stored requests
   * @returns The count of stored requests
   */
  getRequestCount(): number;

  /**
   * Clear all stored requests
   */
  clearRequests(): void;

  /**
   * Update the storage configuration
   * @param config The new configuration to use
   */
  updateConfig(config: WebhookConfig): void;
}

/**
 * In-memory implementation of request storage
 */
export class InMemoryRequestStorage implements RequestStorage {
  private requests: WebhookRequest[] = [];
  private maxRequests: number;

  constructor(config: WebhookConfig) {
    this.maxRequests = config.storage.maxRequests;
  }

  /**
   * Add a new webhook request to storage
   */
  addRequest(request: WebhookRequest): void {
    this.requests.unshift(request); // Add to beginning for most recent first

    // Trim to max requests limit
    if (this.requests.length > this.maxRequests) {
      this.requests = this.requests.slice(0, this.maxRequests);
    }
  }

  /**
   * Get all stored requests
   */
  getRequests(): WebhookRequest[] {
    return [...this.requests]; // Return a copy to prevent external modification
  }

  /**
   * Get the total number of stored requests
   */
  getRequestCount(): number {
    return this.requests.length;
  }

  /**
   * Clear all stored requests
   */
  clearRequests(): void {
    this.requests = [];
  }

  /**
   * Update the storage configuration
   */
  updateConfig(config: WebhookConfig): void {
    this.maxRequests = config.storage.maxRequests;

    // Trim existing requests if new limit is smaller
    if (this.requests.length > this.maxRequests) {
      this.requests = this.requests.slice(0, this.maxRequests);
    }
  }
}
