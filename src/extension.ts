import * as vscode from 'vscode';

import { WebhookSidebarProvider } from './sidebar-provider';
import { InMemoryRequestStorage, RequestStorage } from './request-storage';
import { WebhookConfig, getConfiguration } from './config';
import { WebhookServer, WebhookServerImpl } from './webhook-server';

// Global webhook server instance
let webhookServer: WebhookServer | null = null;
// Global request storage instance
let requestStorage: RequestStorage | null = null;
// Global sidebar provider instance
let sidebarProvider: WebhookSidebarProvider | null = null;

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

  // Create request storage instance
  requestStorage = new InMemoryRequestStorage(config);

  // Create webhook server instance with request storage
  webhookServer = new WebhookServerImpl(config, requestStorage);

  // Create and register sidebar provider
  sidebarProvider = new WebhookSidebarProvider(
    context.extensionUri,
    webhookServer,
    requestStorage,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WebhookSidebarProvider.viewType,
      sidebarProvider,
    ),
  );

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
        vscode.window.showErrorMessage('Webhook server not initialized');
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

        // Update sidebar status
        if (sidebarProvider) {
          sidebarProvider.updateStatus();
        }

        vscode.window.showInformationMessage(
          `Webhook server started successfully on port ${actualPort}`,
        );
      } catch (error) {
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
        vscode.window.showErrorMessage('Webhook server not initialized');
        return;
      }

      if (!webhookServer.isRunning()) {
        vscode.window.showWarningMessage('Webhook server is not running');
        return;
      }

      try {
        await webhookServer.stop();

        // Update sidebar status
        if (sidebarProvider) {
          sidebarProvider.updateStatus();
        }

        vscode.window.showInformationMessage(
          'Webhook server stopped successfully',
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to stop webhook server: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  );

  // Register the open sidebar command
  const openSidebarDisposable = vscode.commands.registerCommand(
    'webhookToolKit.openSidebar',
    () => {
      vscode.commands.executeCommand('workbench.view.extension.webhookToolkit');
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
    openSidebarDisposable,
    configChangeDisposable,
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
      webhookServer.updateConfig(newConfig, requestStorage || undefined);
    }

    // Update request storage configuration
    if (requestStorage) {
      requestStorage.updateConfig(newConfig);
    }

    // Update sidebar status
    if (sidebarProvider) {
      sidebarProvider.updateStatus();
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
    const actualPort = await webhookServer.start(
      config.server.port,
      config.server.autoFindPort,
    );
    vscode.window.showInformationMessage(
      `Webhook server restarted successfully on port ${actualPort}`,
    );

    // Update sidebar status
    if (sidebarProvider) {
      sidebarProvider.updateStatus();
    }
  } catch (error) {
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

  webhookServer = null;
  requestStorage = null;
  sidebarProvider = null;
}
