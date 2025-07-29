import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RequestRecord, StorageMetadata, StorageSchema } from './request-record';

/**
 * Interface defining storage operations for webhook requests
 */
export interface RequestStorage {
  /**
   * Save a request record to storage
   * @param request The request record to save
   */
  saveRequest(request: RequestRecord): Promise<void>;

  /**
   * Get all stored request records
   * @returns Array of all stored request records
   */
  getRequests(): Promise<RequestRecord[]>;

  /**
   * Get a specific request record by ID
   * @param id The ID of the request record to retrieve
   * @returns The request record if found, undefined otherwise
   */
  getRequest(id: string): Promise<RequestRecord | undefined>;

  /**
   * Delete a specific request record by ID
   * @param id The ID of the request record to delete
   */
  deleteRequest(id: string): Promise<void>;

  /**
   * Clear all stored request records
   */
  clearAll(): Promise<void>;

  /**
   * Cleanup old requests when over the maximum limit
   */
  cleanup(): Promise<void>;
}

/**
 * File-based implementation of RequestStorage using VS Code workspace storage
 */
export class FileRequestStorage implements RequestStorage {
  private readonly storageFilePath: string;
  private readonly maxRequests: number;
  private readonly storageVersion = '1.0.0';

  constructor(context: vscode.ExtensionContext, maxRequests: number = 100) {
    // Use VS Code's workspace storage URI for file location
    this.storageFilePath = path.join(
      context.storageUri?.fsPath || context.globalStorageUri.fsPath,
      'webhook-requests.json'
    );
    this.maxRequests = maxRequests;
  }

  /**
   * Save a request record to storage
   */
  async saveRequest(request: RequestRecord): Promise<void> {
    try {
      const schema = await this.loadSchema();
      
      // Add the new request
      schema.requests.push(request);
      
      // Update metadata
      schema.metadata.totalRequestsReceived++;
      
      // Check if cleanup is needed
      if (schema.requests.length > this.maxRequests) {
        // Remove oldest requests (FIFO)
        const excessCount = schema.requests.length - this.maxRequests;
        schema.requests.splice(0, excessCount);
        schema.metadata.lastCleanup = new Date();
      }
      
      await this.saveSchema(schema);
    } catch (error) {
      throw new Error(`Failed to save request: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get all stored request records
   */
  async getRequests(): Promise<RequestRecord[]> {
    try {
      const schema = await this.loadSchema();
      return schema.requests;
    } catch (error) {
      throw new Error(`Failed to get requests: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get a specific request record by ID
   */
  async getRequest(id: string): Promise<RequestRecord | undefined> {
    try {
      const schema = await this.loadSchema();
      return schema.requests.find(request => request.id === id);
    } catch (error) {
      throw new Error(`Failed to get request: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Delete a specific request record by ID
   */
  async deleteRequest(id: string): Promise<void> {
    try {
      const schema = await this.loadSchema();
      const initialLength = schema.requests.length;
      schema.requests = schema.requests.filter(request => request.id !== id);
      
      // Only save if we actually removed something
      if (schema.requests.length < initialLength) {
        await this.saveSchema(schema);
      }
    } catch (error) {
      throw new Error(`Failed to delete request: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Clear all stored request records
   */
  async clearAll(): Promise<void> {
    try {
      const schema = await this.loadSchema();
      schema.requests = [];
      // Keep totalRequestsReceived as historical data
      await this.saveSchema(schema);
    } catch (error) {
      throw new Error(`Failed to clear requests: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Cleanup old requests when over the maximum limit
   */
  async cleanup(): Promise<void> {
    try {
      const schema = await this.loadSchema();
      
      if (schema.requests.length > this.maxRequests) {
        // Remove oldest requests (FIFO)
        const excessCount = schema.requests.length - this.maxRequests;
        schema.requests.splice(0, excessCount);
        schema.metadata.lastCleanup = new Date();
        await this.saveSchema(schema);
      }
    } catch (error) {
      throw new Error(`Failed to cleanup requests: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Load the storage schema from file
   */
  private async loadSchema(): Promise<StorageSchema> {
    try {
      // Ensure storage directory exists
      await this.ensureStorageDirectory();
      
      // Try to read existing file
      const fileContent = await fs.readFile(this.storageFilePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // Validate and convert date strings back to Date objects
      return this.deserializeSchema(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, create default schema
        return this.createDefaultSchema();
      } else if (error instanceof SyntaxError) {
        // Corrupted JSON, create backup and start fresh
        await this.handleCorruptedFile();
        return this.createDefaultSchema();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save the storage schema to file using atomic write
   */
  private async saveSchema(schema: StorageSchema): Promise<void> {
    // Ensure storage directory exists
    await this.ensureStorageDirectory();
    
    // Serialize the schema with proper Date handling
    const serializedData = this.serializeSchema(schema);
    const jsonData = JSON.stringify(serializedData, null, 2);
    
    // Use atomic write: write to temp file then rename
    const tempFilePath = `${this.storageFilePath}.tmp`;
    
    try {
      await fs.writeFile(tempFilePath, jsonData, 'utf8');
      await fs.rename(tempFilePath, this.storageFilePath);
    } catch (error) {
      // Clean up temp file if something went wrong
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Ensure the storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    const storageDir = path.dirname(this.storageFilePath);
    
    try {
      await fs.access(storageDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(storageDir, { recursive: true });
    }
  }

  /**
   * Create a default storage schema
   */
  private createDefaultSchema(): StorageSchema {
    return {
      metadata: {
        version: this.storageVersion,
        lastCleanup: new Date(),
        totalRequestsReceived: 0,
      },
      requests: [],
    };
  }

  /**
   * Handle corrupted storage file by creating a backup
   */
  private async handleCorruptedFile(): Promise<void> {
    const backupPath = `${this.storageFilePath}.backup.${Date.now()}`;
    
    try {
      await fs.copyFile(this.storageFilePath, backupPath);
      // eslint-disable-next-line no-console
      console.warn(`Corrupted storage file backed up to: ${backupPath}`);
    } catch {
      // If we can't create backup, at least try to remove the corrupted file
      try {
        await fs.unlink(this.storageFilePath);
      } catch {
        // Ignore deletion errors
      }
    }
  }

  /**
   * Serialize schema for JSON storage, converting Dates to ISO strings
   */
  private serializeSchema(schema: StorageSchema): any {
    return {
      metadata: {
        ...schema.metadata,
        lastCleanup: schema.metadata.lastCleanup.toISOString(),
      },
      requests: schema.requests.map(request => ({
        ...request,
        timestamp: request.timestamp.toISOString(),
      })),
    };
  }

  /**
   * Deserialize schema from JSON storage, converting ISO strings back to Dates
   */
  private deserializeSchema(data: any): StorageSchema {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid storage data format');
    }

    if (!data.metadata || !Array.isArray(data.requests)) {
      throw new Error('Missing required storage schema properties');
    }

    return {
      metadata: {
        version: data.metadata.version || this.storageVersion,
        lastCleanup: new Date(data.metadata.lastCleanup),
        totalRequestsReceived: data.metadata.totalRequestsReceived || 0,
      },
      requests: data.requests.map((request: any) => ({
        ...request,
        timestamp: new Date(request.timestamp),
      })),
    };
  }
}