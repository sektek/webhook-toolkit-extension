/* eslint-disable sort-imports */
import * as vscode from 'vscode';
import { WebhookConfig, getConfiguration } from './config';
import { FileRequestStorage, RequestStorage } from './request-storage';
import { WebhookLogProvider } from './log-view-provider';
import { RequestRecord } from './request-record';
import { WebhookSidebarProvider } from './sidebar-provider';
import { WebhookServer, WebhookServerImpl } from './webhook-server';
import { WebhookStatusBar } from './status-bar';
/* eslint-enable sort-imports */

// Global webhook server instance
let webhookServer: WebhookServer | null = null;

// Global request storage instance
let requestStorage: RequestStorage | null = null;

// Global status bar instance
let webhookStatusBar: WebhookStatusBar | null = null;

// Global sidebar provider instance
let webhookSidebarProvider: WebhookSidebarProvider | null = null;

// Global log view provider instance
let webhookLogProvider: WebhookLogProvider | null = null;

// Constants
const SERVER_NOT_INITIALIZED_ERROR = 'Webhook server not initialized';
const NO_REQUEST_SELECTED_MESSAGE = 'No request selected';

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

  // Create and register sidebar provider
  webhookSidebarProvider = new WebhookSidebarProvider(
    context.extensionUri,
    webhookServer,
    requestStorage,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WebhookSidebarProvider.viewType,
      webhookSidebarProvider,
    ),
  );

  // Create and register log view provider
  webhookLogProvider = new WebhookLogProvider(requestStorage);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      'webhookTool.logView',
      webhookLogProvider,
    ),
  );

  // Set up initial context variable
  updateHasRequestsContext();

  // Set up periodic refresh for log view (every 5 seconds when server is running)
  const refreshInterval = setInterval(async () => {
    if (webhookServer?.isRunning() && webhookLogProvider) {
      webhookLogProvider.refresh();
      await updateHasRequestsContext();
    }
  }, 5000);

  // Clean up interval on deactivation
  context.subscriptions.push({
    dispose: () => clearInterval(refreshInterval),
  });

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

        // Update sidebar
        webhookSidebarProvider?.updateStatus();

        // Refresh log view
        webhookLogProvider?.refresh();
        await updateHasRequestsContext();

        vscode.window.showInformationMessage(
          `Webhook server started successfully on port ${actualPort}`,
        );
      } catch (error) {
        // Ensure status bar reflects actual state on error
        webhookStatusBar?.updateStatus(false, null);

        // Update sidebar
        webhookSidebarProvider?.updateStatus();
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

        // Update sidebar
        webhookSidebarProvider?.updateStatus();

        vscode.window.showInformationMessage(
          'Webhook server stopped successfully',
        );
      } catch (error) {
        // Ensure status bar reflects actual state on error
        const actualState = webhookServer.isRunning();
        const actualPort = webhookServer.getPort();
        webhookStatusBar?.updateStatus(actualState, actualPort);

        // Update sidebar
        webhookSidebarProvider?.updateStatus();

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
              webhookSidebarProvider?.updateStatus();
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
              webhookSidebarProvider?.updateStatus();
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

        // Update sidebar
        webhookSidebarProvider?.updateStatus();

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

          // Refresh log view
          webhookLogProvider?.refresh();
          await updateHasRequestsContext();

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

  // Register the open sidebar command
  const openSidebarDisposable = vscode.commands.registerCommand(
    'webhookTool.openSidebar',
    async () => {
      await vscode.commands.executeCommand(
        'workbench.view.extension.webhookToolkit',
      );
    },
  );

  // Register the open log panel command
  const openLogPanelDisposable = vscode.commands.registerCommand(
    'webhookTool.openLogPanel',
    async () => {
      await vscode.commands.executeCommand(
        'workbench.view.extension.webhookTool.panel',
      );
    },
  );

  // Register the open request details command
  const openRequestDetailsDisposable = vscode.commands.registerCommand(
    'webhookTool.openRequestDetails',
    async (item?: vscode.TreeItem) => {
      if (!webhookLogProvider) {
        vscode.window.showErrorMessage('Log view provider not initialized');
        return;
      }

      let requestId: string | undefined;

      if (item && item.id) {
        requestId = item.id;
      } else {
        // If no item provided, get the selected item from the tree view
        // This handles keyboard shortcuts
        const selection = await vscode.window.showQuickPick([], {
          placeHolder: NO_REQUEST_SELECTED_MESSAGE,
        });
        if (!selection) {
          return;
        }
      }

      if (!requestId) {
        vscode.window.showWarningMessage('No request selected');
        return;
      }

      try {
        const request = await webhookLogProvider.getRequestById(requestId);
        if (!request) {
          vscode.window.showErrorMessage('Request not found');
          return;
        }

        // Create and show request details in a new document
        const content = formatRequestDetails(request);
        const doc = await vscode.workspace.openTextDocument({
          content,
          language: 'json',
        });
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open request details: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  );

  // Register the delete request command
  const deleteRequestDisposable = vscode.commands.registerCommand(
    'webhookTool.deleteRequest',
    async (item?: vscode.TreeItem) => {
      if (!webhookLogProvider) {
        vscode.window.showErrorMessage('Log view provider not initialized');
        return;
      }

      let requestId: string | undefined;

      if (item && item.id) {
        requestId = item.id;
      }

      if (!requestId) {
        vscode.window.showWarningMessage('No request selected');
        return;
      }

      try {
        const request = await webhookLogProvider.getRequestById(requestId);
        if (!request) {
          vscode.window.showErrorMessage('Request not found');
          return;
        }

        const confirmation = await vscode.window.showWarningMessage(
          `Delete request ${request.method} ${request.path}?`,
          { modal: true },
          'Delete',
          'Cancel',
        );

        if (confirmation === 'Delete') {
          await webhookLogProvider.deleteRequest(requestId);
          await updateHasRequestsContext();
          vscode.window.showInformationMessage('Request deleted successfully');
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to delete request: ${error instanceof Error ? error.message : error}`,
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
    openSidebarDisposable,
    openLogPanelDisposable,
    openRequestDetailsDisposable,
    deleteRequestDisposable,
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

    // Update sidebar
    webhookSidebarProvider?.updateStatus();

    vscode.window.showInformationMessage(
      `Webhook server restarted successfully on port ${actualPort}`,
    );
  } catch (error) {
    // Ensure status bar reflects actual state on error
    const actualState = webhookServer.isRunning();
    const actualPort = webhookServer.getPort();
    webhookStatusBar?.updateStatus(actualState, actualPort);

    // Update sidebar
    webhookSidebarProvider?.updateStatus();

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
 * Format request details for display in a text document
 */
function formatRequestDetails(request: RequestRecord): string {
  const details = {
    id: request.id,
    timestamp: request.timestamp.toISOString(),
    method: request.method,
    path: request.path,
    ip: request.ip,
    contentType: request.contentType || 'Not specified',
    bodySize: `${request.bodySize} bytes`,
    headers: request.headers,
    body: request.body || '(empty)',
  };

  return JSON.stringify(details, null, 2);
}

/**
 * Update the webhookTool.hasRequests context variable
 */
async function updateHasRequestsContext(): Promise<void> {
  if (!webhookLogProvider) {
    await vscode.commands.executeCommand(
      'setContext',
      'webhookTool.hasRequests',
      false,
    );
    return;
  }

  try {
    const hasRequests = await webhookLogProvider.hasRequests();
    await vscode.commands.executeCommand(
      'setContext',
      'webhookTool.hasRequests',
      hasRequests,
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update hasRequests context:', error);
    await vscode.commands.executeCommand(
      'setContext',
      'webhookTool.hasRequests',
      false,
    );
  }
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
