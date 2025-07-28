import * as vscode from 'vscode';

/**
 * Configuration interface for the Webhook Toolkit extension
 */
export interface WebhookConfig {
  /** Server configuration settings */
  server: {
    /** Port number for the webhook server (1024-65535) */
    port: number;
    /** Automatically find an available port if the specified port is in use */
    autoFindPort: boolean;
    /** HTTP response code to return for webhook requests (200-299) */
    responseCode: number;
    /** HTTP response headers to include in webhook responses */
    responseHeaders: Record<string, string>;
    /** HTTP response body to return for webhook requests */
    responseBody: string;
  };
  /** Storage configuration settings */
  storage: {
    /** Maximum number of webhook requests to store in memory (1-10000) */
    maxRequests: number;
  };
}

/**
 * Gets the complete webhook configuration from VS Code workspace settings
 * @returns The current webhook configuration with all settings
 */
export function getConfiguration(): WebhookConfig {
  const config = vscode.workspace.getConfiguration('webhookTool');

  return {
    server: {
      port: config.get<number>('server.port', 3000),
      autoFindPort: config.get<boolean>('server.autoFindPort', true),
      responseCode: config.get<number>('server.responseCode', 201),
      responseHeaders: config.get<Record<string, string>>(
        'server.responseHeaders',
        {},
      ),
      responseBody: config.get<string>('server.responseBody', ''),
    },
    storage: {
      maxRequests: config.get<number>('storage.maxRequests', 100),
    },
  };
}

/**
 * Gets a specific configuration value from VS Code workspace settings
 * @param key The configuration key to retrieve (e.g., 'server.port')
 * @returns The configuration value with proper typing
 */
export function getConfigValue<T>(key: string): T | undefined {
  const config = vscode.workspace.getConfiguration('webhookTool');
  return config.get<T>(key);
}

/**
 * Gets a specific configuration value with a default fallback
 * @param key The configuration key to retrieve (e.g., 'server.port')
 * @param defaultValue The default value to return if the setting is not found
 * @returns The configuration value or the default value
 */
export function getConfigValueWithDefault<T>(key: string, defaultValue: T): T {
  const config = vscode.workspace.getConfiguration('webhookTool');
  return config.get<T>(key, defaultValue);
}
