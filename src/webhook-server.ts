/* eslint-disable sort-imports */
import express, { Request, Response } from 'express';
import { Server } from 'http';
import { WebhookConfig } from './config';
import { createRequestRecord } from './request-factory';
import { RequestStorage } from './request-storage';
/* eslint-enable sort-imports */

/**
 * Interface defining the webhook server contract
 */
export interface WebhookServer {
  /**
   * Start the webhook server
   * @param port The port to start the server on
   * @param autoFindPort Whether to automatically find an available port if the specified port is busy
   * @returns Promise that resolves to the actual port used
   */
  start(port: number, autoFindPort: boolean): Promise<number>;

  /**
   * Stop the webhook server gracefully
   */
  stop(): Promise<void>;

  /**
   * Check if the server is currently running
   * @returns True if the server is running, false otherwise
   */
  isRunning(): boolean;

  /**
   * Get the current port the server is listening on
   * @returns The port number if running, null otherwise
   */
  getPort(): number | null;

  /**
   * Update the server configuration
   * @param config The new configuration to use
   */
  updateConfig(config: WebhookConfig): void;

  /**
   * Set the storage instance for capturing webhook requests
   * @param storage The RequestStorage instance to use
   */
  setStorage(storage: RequestStorage): void;
}

/**
 * Implementation of the webhook server using Express.js
 */
export class WebhookServerImpl implements WebhookServer {
  private app: express.Application;
  private server: Server | null = null;
  private currentPort: number | null = null;
  private config: WebhookConfig;
  private storage: RequestStorage | null = null;

  constructor(config: WebhookConfig, storage?: RequestStorage) {
    this.config = config;
    this.storage = storage || null;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Update the server configuration
   * @param config The new configuration to use
   */
  updateConfig(config: WebhookConfig): void {
    this.config = config;
  }

  /**
   * Set the storage instance for capturing webhook requests
   * @param storage The RequestStorage instance to use
   */
  setStorage(storage: RequestStorage): void {
    this.storage = storage;
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Parse JSON bodies with 10MB limit
    this.app.use(express.json({ limit: '10mb' }));

    // Parse raw bodies with 10MB limit
    this.app.use(express.raw({ limit: '10mb' }));

    // Parse text bodies with 10MB limit
    this.app.use(express.text({ limit: '10mb' }));

    // Parse URL-encoded bodies with 10MB limit
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Add request capture middleware
    this.app.use(async (req: Request, res: Response, next) => {
      try {
        await this.captureRequest(req);
      } catch (error) {
        // Log storage errors but don't block the request
        // eslint-disable-next-line no-console
        console.error('Error capturing request to storage:', error);
      }
      next();
    });
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Handle POST and PUT requests to any path using middleware
    this.app.use((req: Request, res: Response) => {
      if (req.method === 'POST' || req.method === 'PUT') {
        this.handleWebhookRequest(req, res);
      } else {
        // Return 404 for all other methods
        res.status(404).json({ error: 'Method not allowed' });
      }
    });
  }

  /**
   * Capture request data to storage
   */
  private async captureRequest(req: Request): Promise<void> {
    // Only capture POST and PUT requests
    if (req.method !== 'POST' && req.method !== 'PUT') {
      return;
    }

    if (!this.storage) {
      // eslint-disable-next-line no-console
      console.warn('Storage not configured, request will not be saved');
      return;
    }

    try {
      // Extract client IP address
      const ip = req.ip || req.socket.remoteAddress || 'unknown';

      // Create request record using factory
      const requestRecord = createRequestRecord(req, ip);

      // Save request to storage asynchronously
      await this.storage.saveRequest(requestRecord);

      // Trigger cleanup after saving
      setImmediate(async () => {
        try {
          await this.storage?.cleanup();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error during storage cleanup:', error);
        }
      });

      // eslint-disable-next-line no-console
      console.log(
        `Request captured: ${req.method} ${req.path} (ID: ${requestRecord.id})`,
      );
    } catch (error) {
      // Log error but don't throw to avoid blocking request processing
      // eslint-disable-next-line no-console
      console.error('Error capturing request:', error);
    }
  }

  /**
   * Handle incoming webhook requests
   */
  private handleWebhookRequest(req: Request, res: Response): void {
    // Log the request
    // eslint-disable-next-line no-console
    console.log(`Request received: ${req.method} ${req.path}`);

    try {
      // Set response headers from configuration, handling conflicts gracefully
      Object.entries(this.config.server.responseHeaders).forEach(
        ([key, value]) => {
          try {
            res.setHeader(key, value);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(`Failed to set response header ${key}: ${error}`);
          }
        },
      );

      // Set appropriate Content-Type for response body if not already set
      if (this.config.server.responseBody && !res.getHeader('content-type')) {
        res.setHeader('content-type', 'text/plain');
      }

      // Send response with configured status code and body
      res
        .status(this.config.server.responseCode)
        .send(this.config.server.responseBody);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error handling webhook request:', error);

      // Send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Start the webhook server
   */
  async start(port: number, autoFindPort: boolean): Promise<number> {
    if (this.server) {
      throw new Error('Server is already running');
    }

    let currentPort = port;
    let attempts = 0;
    const maxAttempts = autoFindPort ? 100 : 1;

    while (attempts < maxAttempts) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.server = this.app.listen(currentPort, '127.0.0.1', () => {
            this.currentPort = currentPort;
            // eslint-disable-next-line no-console
            console.log(
              `Webhook server started on http://127.0.0.1:${currentPort}`,
            );
            resolve();
          });

          this.server.on('error', (err: Error & { code?: string }) => {
            this.server = null;
            if (
              err.code === 'EADDRINUSE' &&
              autoFindPort &&
              attempts < maxAttempts - 1
            ) {
              // Port is in use, try next port
              reject(new Error(`Port ${currentPort} is in use`));
            } else {
              reject(err);
            }
          });
        });

        // Success - break out of the loop
        return currentPort;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            `Failed to start server after ${attempts} attempts. Last error: ${error}`,
          );
        }

        // Try next port
        currentPort++;
        // eslint-disable-next-line no-console
        console.log(
          `Port ${currentPort - 1} is busy, trying port ${currentPort}`,
        );
      }
    }

    throw new Error(`Failed to find an available port starting from ${port}`);
  }

  /**
   * Stop the webhook server gracefully
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    const serverToClose = this.server;
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    return new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      serverToClose.close(err => {
        if (err) {
          // eslint-disable-next-line no-console
          console.error('Error stopping webhook server:', err);
          reject(err);
        } else {
          // eslint-disable-next-line no-console
          console.log('Webhook server stopped');
          this.server = null;
          this.currentPort = null;
          resolve();
        }
      });
    });
  }

  /**
   * Check if the server is currently running
   */
  isRunning(): boolean {
    return this.server !== null && this.currentPort !== null;
  }

  /**
   * Get the current port the server is listening on
   */
  getPort(): number | null {
    return this.currentPort;
  }
}
