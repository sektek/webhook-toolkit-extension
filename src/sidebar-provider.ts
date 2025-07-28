import * as vscode from 'vscode';

import { getConfiguration } from './config';
import { WebhookServer } from './webhook-server';
import { RequestStorage } from './request-storage';

/**
 * Message types for webview communication
 */
interface WebviewMessage {
  type: 'startServer' | 'stopServer' | 'getStatus' | 'openSettings';
  payload?: unknown;
}

/**
 * Server status for webview display
 */
interface ServerStatus {
  isRunning: boolean;
  port: number | null;
  requestCount: number;
  config: {
    port: number;
    autoFindPort: boolean;
    responseCode: number;
  };
}

/**
 * WebhookSidebarProvider implements the sidebar panel for the webhook extension
 */
export class WebhookSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'webhookToolkit.sidebar';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _webhookServer: WebhookServer,
    private readonly _requestStorage: RequestStorage,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this._handleMessage(message);
    });

    // Send initial status when webview becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._updateStatus();
      }
    });

    // Send initial status
    this._updateStatus();
  }

  /**
   * Update the sidebar status display
   */
  public updateStatus(): void {
    this._updateStatus();
  }

  /**
   * Handle messages from the webview
   */
  private async _handleMessage(message: WebviewMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'startServer':
          await this._startServer();
          break;
        case 'stopServer':
          await this._stopServer();
          break;
        case 'getStatus':
          this._updateStatus();
          break;
        case 'openSettings':
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'webhookTool',
          );
          break;
        default:
          // eslint-disable-next-line no-console
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      this._sendErrorMessage(
        `Operation failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Start the webhook server
   */
  private async _startServer(): Promise<void> {
    if (this._webhookServer.isRunning()) {
      this._sendErrorMessage('Server is already running');
      return;
    }

    try {
      const config = getConfiguration();
      const actualPort = await this._webhookServer.start(
        config.server.port,
        config.server.autoFindPort,
      );

      this._updateStatus();
      this._sendSuccessMessage(`Server started on port ${actualPort}`);
    } catch (error) {
      this._sendErrorMessage(
        `Failed to start server: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Stop the webhook server
   */
  private async _stopServer(): Promise<void> {
    if (!this._webhookServer.isRunning()) {
      this._sendErrorMessage('Server is not running');
      return;
    }

    try {
      await this._webhookServer.stop();
      this._updateStatus();
      this._sendSuccessMessage('Server stopped successfully');
    } catch (error) {
      this._sendErrorMessage(
        `Failed to stop server: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Send status update to webview
   */
  private _updateStatus(): void {
    if (!this._view) {
      return;
    }

    const config = getConfiguration();
    const status: ServerStatus = {
      isRunning: this._webhookServer.isRunning(),
      port: this._webhookServer.getPort(),
      requestCount: this._requestStorage.getRequestCount(),
      config: {
        port: config.server.port,
        autoFindPort: config.server.autoFindPort,
        responseCode: config.server.responseCode,
      },
    };

    this._view.webview.postMessage({
      type: 'statusUpdate',
      payload: status,
    });
  }

  /**
   * Send success message to webview
   */
  private _sendSuccessMessage(message: string): void {
    if (!this._view) {
      return;
    }

    this._view.webview.postMessage({
      type: 'showMessage',
      payload: { type: 'success', message },
    });
  }

  /**
   * Send error message to webview
   */
  private _sendErrorMessage(message: string): void {
    if (!this._view) {
      return;
    }

    this._view.webview.postMessage({
      type: 'showMessage',
      payload: { type: 'error', message },
    });
  }

  /**
   * Generate HTML content for the webview
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Webhook Toolkit</title>
  <style>
    :root {
      --vscode-font-family: var(--vscode-editor-font-family);
      --vscode-font-size: var(--vscode-editor-font-size);
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      padding: 16px;
      margin: 0;
      background-color: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
    }

    .section {
      margin-bottom: 20px;
      padding: 12px;
      border: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
      border-radius: 6px;
      background-color: var(--vscode-sideBarSectionHeader-background);
    }

    .section-title {
      font-weight: bold;
      margin-bottom: 8px;
      color: var(--vscode-sideBarSectionHeader-foreground);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .status-running {
      background-color: var(--vscode-charts-green);
    }

    .status-stopped {
      background-color: var(--vscode-charts-red);
    }

    .button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      width: 100%;
      margin-bottom: 8px;
      transition: background-color 0.2s;
    }

    .button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .button:disabled {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: not-allowed;
    }

    .button-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .button-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }

    .info-label {
      color: var(--vscode-descriptionForeground);
    }

    .info-value {
      font-weight: 500;
    }

    .message {
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 12px;
    }

    .message-success {
      background-color: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      color: var(--vscode-inputValidation-infoForeground);
    }

    .message-error {
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-inputValidation-errorForeground);
    }

    .quick-links {
      margin-top: 12px;
    }

    .link-button {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-decoration: underline;
      font-family: inherit;
      font-size: 12px;
      padding: 4px 0;
      display: block;
      width: 100%;
      text-align: left;
      margin-bottom: 4px;
    }

    .link-button:hover {
      color: var(--vscode-textLink-activeForeground);
    }

    .server-status {
      font-weight: 500;
      margin-bottom: 8px;
    }

    .loading {
      opacity: 0.6;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="message-container"></div>

  <!-- Server Status Section -->
  <div class="section">
    <div class="section-title">Server Status</div>
    <div class="server-status">
      <span id="status-indicator" class="status-indicator status-stopped"></span>
      <span id="server-status-text">Stopped</span>
    </div>
    <div class="info-row">
      <span class="info-label">Port:</span>
      <span id="current-port" class="info-value">N/A</span>
    </div>
    <div class="info-row">
      <span class="info-label">Requests:</span>
      <span id="request-count" class="info-value">0</span>
    </div>
  </div>

  <!-- Server Controls Section -->
  <div class="section">
    <div class="section-title">Controls</div>
    <button id="start-stop-btn" class="button" onclick="toggleServer()">
      Start Server
    </button>
    <button class="button button-secondary" onclick="openSettings()">
      Open Settings
    </button>
  </div>

  <!-- Configuration Section -->
  <div class="section">
    <div class="section-title">Configuration</div>
    <div class="info-row">
      <span class="info-label">Target Port:</span>
      <span id="config-port" class="info-value">3000</span>
    </div>
    <div class="info-row">
      <span class="info-label">Auto-find Port:</span>
      <span id="config-auto-find" class="info-value">Yes</span>
    </div>
    <div class="info-row">
      <span class="info-label">Response Code:</span>
      <span id="config-response-code" class="info-value">201</span>
    </div>
  </div>

  <!-- Quick Links Section -->
  <div class="section">
    <div class="section-title">Quick Actions</div>
    <div class="quick-links">
      <button class="link-button" onclick="openSettings()">
        Configure Webhook Settings
      </button>
      <button class="link-button" onclick="openOutputChannel()">
        View Extension Logs
      </button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let isServerRunning = false;

    // Handle messages from the extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'statusUpdate':
          updateStatus(message.payload);
          break;
        case 'showMessage':
          showMessage(message.payload.type, message.payload.message);
          break;
      }
    });

    function updateStatus(status) {
      isServerRunning = status.isRunning;
      
      const statusIndicator = document.getElementById('status-indicator');
      const statusText = document.getElementById('server-status-text');
      const currentPort = document.getElementById('current-port');
      const requestCount = document.getElementById('request-count');
      const startStopBtn = document.getElementById('start-stop-btn');

      // Update status indicator and text
      if (status.isRunning) {
        statusIndicator.className = 'status-indicator status-running';
        statusText.textContent = 'Running';
        currentPort.textContent = status.port || 'N/A';
        startStopBtn.textContent = 'Stop Server';
      } else {
        statusIndicator.className = 'status-indicator status-stopped';
        statusText.textContent = 'Stopped';
        currentPort.textContent = 'N/A';
        startStopBtn.textContent = 'Start Server';
      }

      // Update request count
      requestCount.textContent = status.requestCount.toString();

      // Update configuration display
      document.getElementById('config-port').textContent = status.config.port.toString();
      document.getElementById('config-auto-find').textContent = status.config.autoFindPort ? 'Yes' : 'No';
      document.getElementById('config-response-code').textContent = status.config.responseCode.toString();
    }

    function toggleServer() {
      const action = isServerRunning ? 'stopServer' : 'startServer';
      vscode.postMessage({ type: action });
    }

    function openSettings() {
      vscode.postMessage({ type: 'openSettings' });
    }

    function openOutputChannel() {
      // This will be implemented in a future update when output channel is added
      showMessage('info', 'Output channel feature coming soon');
    }

    function showMessage(type, text) {
      const container = document.getElementById('message-container');
      const message = document.createElement('div');
      message.className = \`message message-\${type}\`;
      message.textContent = text;
      container.appendChild(message);

      // Auto-remove message after 5 seconds
      setTimeout(() => {
        if (message.parentNode) {
          message.parentNode.removeChild(message);
        }
      }, 5000);
    }

    // Request initial status
    vscode.postMessage({ type: 'getStatus' });
  </script>
</body>
</html>`;
  }
}
