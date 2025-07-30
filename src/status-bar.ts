import * as vscode from 'vscode';

/**
 * Manages the webhook server status bar item in VS Code
 */
export class WebhookStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private isServerRunning: boolean = false;
  private currentPort: number | null = null;

  constructor(private context: vscode.ExtensionContext) {
    // Create status bar item with specified configuration
    this.statusBarItem = vscode.window.createStatusBarItem(
      'webhookTool.serverStatus',
      vscode.StatusBarAlignment.Left,
      100,
    );

    // Set command for click action
    this.statusBarItem.command = 'webhookTool.toggleServer';

    // Initialize with stopped status
    this.updateStatus(false, null);

    // Show the status bar item immediately
    this.show();
  }

  /**
   * Update the status bar display based on server state
   * @param isRunning Whether the server is currently running
   * @param port The port number if running, null if stopped
   */
  updateStatus(isRunning: boolean, port: number | null): void {
    this.isServerRunning = isRunning;
    this.currentPort = port;

    if (isRunning && port !== null) {
      // Server is running
      this.statusBarItem.text = `🔗 Webhook: Running :${port}`;
      this.statusBarItem.color = new vscode.ThemeColor(
        'statusBarItem.warningForeground',
      );
      this.statusBarItem.tooltip = `Click to start/stop webhook server (Current: Running on port ${port})`;
    } else {
      // Server is stopped
      this.statusBarItem.text = '🔗 Webhook: Stopped';
      this.statusBarItem.color = undefined; // No color for stopped state
      this.statusBarItem.tooltip =
        'Click to start/stop webhook server (Current: Stopped)';
    }
  }

  /**
   * Show the status bar item
   */
  show(): void {
    this.statusBarItem.show();
  }

  /**
   * Hide the status bar item
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Get the current server running state
   * @returns True if server is running, false otherwise
   */
  getServerRunningState(): boolean {
    return this.isServerRunning;
  }

  /**
   * Get the current port
   * @returns The current port number or null if stopped
   */
  getCurrentPort(): number | null {
    return this.currentPort;
  }

  /**
   * Dispose of the status bar item
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
