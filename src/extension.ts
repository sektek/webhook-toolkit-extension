import * as vscode from 'vscode';
import { WebhookConfig, getConfiguration } from './config';

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

  // Listen for configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
    e => {
      if (e.affectsConfiguration('webhookTool')) {
        const newConfig = getConfiguration();
        // eslint-disable-next-line no-console
        console.log('Webhook configuration changed:', newConfig);

        // Show notification about configuration change
        vscode.window.showInformationMessage(
          'Webhook Toolkit configuration has been updated. Changes will take effect on next restart.',
        );
      }
    },
  );

  context.subscriptions.push(
    testDisposable,
    showConfigDisposable,
    configChangeDisposable,
  );
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
export function deactivate() {
  // eslint-disable-next-line no-console
  console.log('Webhook Extension deactivated');
}
