import * as vscode from 'vscode';
import { FileRequestStorage, RequestStorage } from './request-storage';
import { WebhookConfig, getConfiguration } from './config';
import { WebhookServer, WebhookServerImpl } from './webhook-server';
import { WebhookStatusBar } from './status-bar';

// Global webhook server instance
let webhookServer: WebhookServer | null = null;

// Global request storage instance
let requestStorage: RequestStorage | null = null;

// Global status bar instance
let webhookStatusBar: WebhookStatusBar | null = null;

// Constants
const SERVER_NOT_INITIALIZED_ERROR = 'Webhook server not initialized';

/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 */
export function activate(context: vscode.ExtensionContext) {
  // eslint-disable-next-line no-console
  console.log('Webhook Extension activated');

  // Get initial configuration
  const config = getConfiguration();
  // eslint-disable-next-line no-console
  console.log('Webhook Extension configuration loaded:', config);

  // Initialize request storage
  requestStorage = new FileRequestStorage(context, config.storage.maxRequests);

  // Create webhook server instance with storage
  webhookServer = new WebhookServerImpl(config, requestStorage);

  // Create status bar instance
  webhookStatusBar = new WebhookStatusBar(context);

  // Register the test command
  const testDisposable = vscode.commands.registerCommand(
    'webhookTool.test',
    () => {
      vscode.window.showInformationMessage('Webhook Extension is working!');
    },
  );

  // Register the show configuration command
  const showConfigDisposable = vscode.commands.registerCommand(
    'webhookTool.showConfig',
    () => {
      const currentConfig = getConfiguration();
      const configMessage = formatConfigurationMessage(currentConfig);
      vscode.window.showInformationMessage(
        `Current Webhook Configuration:\n${configMessage}`,
        { modal: false },
      );
    },
  );

  // Register the start server command
  const startServerDisposable = vscode.commands.registerCommand(
    'webhookTool.startServer',
    async () => {
      if (!webhookServer) {
        vscode.window.showErrorMessage(SERVER_NOT_INITIALIZED_ERROR);
        return;
      }

      if (webhookServer.isRunning()) {
        vscode.window.showWarningMessage('Webhook server is already running');
        return;
      }

      try {
        const currentConfig = getConfiguration();
        const actualPort = await webhookServer.start(
          currentConfig.server.port,
          currentConfig.server.autoFindPort,
        );

        // Update status bar
        webhookStatusBar?.updateStatus(true, actualPort);

        vscode.window.showInformationMessage(
          `Webhook server started successfully on port ${actualPort}`,
        );
      } catch (error) {
        // Ensure status bar reflects actual state on error
        webhookStatusBar?.updateStatus(false, null);
        vscode.window.showErrorMessage(
          `Failed to start webhook server: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  );

  // Register the stop server command
  const stopServerDisposable = vscode.commands.registerCommand(
    'webhookTool.stopServer',
    async () => {
      if (!webhookServer) {
        vscode.window.showErrorMessage(SERVER_NOT_INITIALIZED_ERROR);
        return;
      }

      if (!webhookServer.isRunning()) {
        vscode.window.showWarningMessage('Webhook server is not running');
        return;
      }

      try {
        await webhookServer.stop();

        // Update status bar
        webhookStatusBar?.updateStatus(false, null);

        vscode.window.showInformationMessage(
          'Webhook server stopped successfully',
        );
      } catch (error) {
        // Ensure status bar reflects actual state on error
        const actualState = webhookServer.isRunning();
        const actualPort = webhookServer.getPort();
        webhookStatusBar?.updateStatus(actualState, actualPort);

        vscode.window.showErrorMessage(
          `Failed to stop webhook server: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  );

  // Register the toggle server command
  const toggleServerDisposable = vscode.commands.registerCommand(
    'webhookTool.toggleServer',
    async () => {
      if (!webhookServer) {
        vscode.window.showErrorMessage(SERVER_NOT_INITIALIZED_ERROR);
        return;
      }

      try {
        if (webhookServer.isRunning()) {
          // Server is running - stop it
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Stopping webhook server...',
              cancellable: false,
            },
            async () => {
              await webhookServer!.stop();
              webhookStatusBar?.updateStatus(false, null);
            },
          );
          vscode.window.showInformationMessage(
            'Webhook server stopped successfully',
          );
        } else {
          // Server is stopped - start it
          const currentConfig = getConfiguration();
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Starting webhook server...',
              cancellable: false,
            },
            async () => {
              const actualPort = await webhookServer!.start(
                currentConfig.server.port,
                currentConfig.server.autoFindPort,
              );
              webhookStatusBar?.updateStatus(true, actualPort);
              return actualPort;
            },
          );
          const port = webhookServer.getPort();
          vscode.window.showInformationMessage(
            `Webhook server started successfully on port ${port}`,
          );
        }
      } catch (error) {
        // Ensure status bar reflects actual state on error
        const actualState = webhookServer.isRunning();
        const actualPort = webhookServer.getPort();
        webhookStatusBar?.updateStatus(actualState, actualPort);

        vscode.window.showErrorMessage(
          `Failed to toggle webhook server: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  );

  // Register the clear storage command
  const clearStorageDisposable = vscode.commands.registerCommand(
    'webhookTool.clearStorage',
    async () => {
      if (!requestStorage) {
        vscode.window.showErrorMessage('Request storage not initialized');
        return;
      }

      try {
        const confirmation = await vscode.window.showWarningMessage(
          'Are you sure you want to clear all stored webhook requests? This action cannot be undone.',
          { modal: true },
          'Clear All',
          'Cancel',
        );

        if (confirmation === 'Clear All') {
          await requestStorage.clearAll();
          vscode.window.showInformationMessage(
            'All stored webhook requests have been cleared successfully',
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to clear storage: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  );

  // Register the get request count command
  const getRequestCountDisposable = vscode.commands.registerCommand(
    'webhookTool.getRequestCount',
    async () => {
      if (!requestStorage) {
        vscode.window.showErrorMessage('Request storage not initialized');
        return;
      }

      try {
        const requests = await requestStorage.getRequests();
        const count = requests.length;
        vscode.window.showInformationMessage(
          `Currently storing ${count} webhook request${count === 1 ? '' : 's'}`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to get request count: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  );

  // Listen for configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
    async e => {
      await handleConfigurationChange(e);
    },
  );

  context.subscriptions.push(
    testDisposable,
    showConfigDisposable,
    startServerDisposable,
    stopServerDisposable,
    toggleServerDisposable,
    clearStorageDisposable,
    getRequestCountDisposable,
    configChangeDisposable,
    webhookStatusBar, // Add status bar to disposables
  );
}

/**
 * Handle configuration changes for the webhook extension
 */
async function handleConfigurationChange(
  e: vscode.ConfigurationChangeEvent,
): Promise<void> {
  if (e.affectsConfiguration('webhookTool')) {
    const newConfig = getConfiguration();
    // eslint-disable-next-line no-console
    console.log('Webhook configuration changed:', newConfig);

    // Update server configuration
    if (webhookServer) {
      webhookServer.updateConfig(newConfig);
      // Ensure storage is still connected if it was set
      if (requestStorage) {
        webhookServer.setStorage(requestStorage);
      }
    }

    // If server is running, ask user if they want to restart it
    if (webhookServer && webhookServer.isRunning()) {
      const result = await vscode.window.showInformationMessage(
        'Webhook Toolkit configuration has been updated. Restart the server to apply changes?',
        'Restart Server',
        'Keep Running',
      );

      if (result === 'Restart Server') {
        await restartWebhookServer(newConfig);
      }
    } else {
      // Show notification about configuration change
      vscode.window.showInformationMessage(
        'Webhook Toolkit configuration has been updated.',
      );
    }
  }
}

/**
 * Restart the webhook server with new configuration
 */
async function restartWebhookServer(config: WebhookConfig): Promise<void> {
  if (!webhookServer) {
    return;
  }

  try {
    await webhookServer.stop();
    webhookStatusBar?.updateStatus(false, null);

    const actualPort = await webhookServer.start(
      config.server.port,
      config.server.autoFindPort,
    );
    webhookStatusBar?.updateStatus(true, actualPort);

    vscode.window.showInformationMessage(
      `Webhook server restarted successfully on port ${actualPort}`,
    );
  } catch (error) {
    // Ensure status bar reflects actual state on error
    const actualState = webhookServer.isRunning();
    const actualPort = webhookServer.getPort();
    webhookStatusBar?.updateStatus(actualState, actualPort);

    vscode.window.showErrorMessage(
      `Failed to restart webhook server: ${error instanceof Error ? error.message : error}`,
    );
  }
}

/**
 * Formats the configuration object into a readable string for display
 * @param config The webhook configuration to format
 * @returns A formatted string representation of the configuration
 */
function formatConfigurationMessage(config: WebhookConfig): string {
  return [
    `Server Port: ${config.server.port}`,
    `Auto Find Port: ${config.server.autoFindPort}`,
    `Response Code: ${config.server.responseCode}`,
    `Response Headers: ${JSON.stringify(config.server.responseHeaders)}`,
    `Response Body: "${config.server.responseBody}"`,
    `Max Requests: ${config.storage.maxRequests}`,
  ].join('\n');
}

/**
 * This method is called when your extension is deactivated
 */
export async function deactivate() {
  // eslint-disable-next-line no-console
  console.log('Webhook Extension deactivated');

  // Stop the webhook server if it's running
  if (webhookServer && webhookServer.isRunning()) {
    try {
      await webhookServer.stop();
      // eslint-disable-next-line no-console
      console.log('Webhook server stopped during deactivation');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        'Error stopping webhook server during deactivation:',
        error,
      );
    }
  }

  // Clean up status bar
  if (webhookStatusBar) {
    webhookStatusBar.dispose();
    webhookStatusBar = null;
  }

  webhookServer = null;
}
