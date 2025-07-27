import * as vscode from 'vscode';

/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 */
export function activate(context: vscode.ExtensionContext) {
  // eslint-disable-next-line no-console
  console.log('Webhook Extension activated');

  // Register the test command
  const disposable = vscode.commands.registerCommand('webhookTool.test', () => {
    vscode.window.showInformationMessage('Webhook Extension is working!');
  });

  context.subscriptions.push(disposable);
}

/**
 * This method is called when your extension is deactivated
 */
export function deactivate() {
  // eslint-disable-next-line no-console
  console.log('Webhook Extension deactivated');
}
