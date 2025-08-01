import * as vscode from 'vscode';
import { WebhookConfig, getConfiguration } from './config';
import { RequestStorage } from './request-storage';
import { WebhookServer } from './webhook-server';

/**
 * Message types for communication between webview and extension
 */
interface WebviewMessage {
  type:
    | 'startServer'
    | 'stopServer'
    | 'getStatus'
    | 'openSettings'
    | 'clearRequests';
  data?: unknown;
}

/**
 * Status data sent to webview
 */
interface StatusData {
  isRunning: boolean;
  port: number | null;
  config: WebhookConfig;
  requestCount: number;
  error?: string;
}

/**
 * Webview provider for the webhook toolkit sidebar
 */
export class WebhookSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'webhookToolkit.sidebar';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly server: WebhookServer,
    private readonly storage: RequestStorage,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      this._handleMessage(message);
    });

    // Send initial status when webview is ready
    this._updateStatus();

    // Update status when webview becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._updateStatus();
      }
    });
  }

  /**
   * Update the webview with current status
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
            '@ext:webhook-toolkit',
          );
          break;
        case 'clearRequests':
          await this._clearRequests();
          break;
        default:
          // eslint-disable-next-line no-console
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error handling webview message:', error);
      this._sendErrorToWebview(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Start the webhook server
   */
  private async _startServer(): Promise<void> {
    if (this.server.isRunning()) {
      this._sendErrorToWebview('Server is already running');
      return;
    }

    try {
      const config = getConfiguration();
      await this.server.start(config.server.port, config.server.autoFindPort);
      this._updateStatus();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this._sendErrorToWebview(`Failed to start server: ${errorMessage}`);
      this._updateStatus();
    }
  }

  /**
   * Stop the webhook server
   */
  private async _stopServer(): Promise<void> {
    if (!this.server.isRunning()) {
      this._sendErrorToWebview('Server is not running');
      return;
    }

    try {
      await this.server.stop();
      this._updateStatus();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this._sendErrorToWebview(`Failed to stop server: ${errorMessage}`);
      this._updateStatus();
    }
  }

  /**
   * Clear stored webhook requests
   */
  private async _clearRequests(): Promise<void> {
    try {
      await this.storage.clearAll();
      this._updateStatus();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this._sendErrorToWebview(`Failed to clear requests: ${errorMessage}`);
    }
  }

  /**
   * Send current status to webview
   */
  private async _updateStatus(): Promise<void> {
    if (!this._view) {
      return;
    }

    try {
      const config = getConfiguration();
      const requests = await this.storage.getRequests();
      const statusData: StatusData = {
        isRunning: this.server.isRunning(),
        port: this.server.getPort(),
        config,
        requestCount: requests.length,
      };

      await this._view.webview.postMessage({
        type: 'statusUpdate',
        data: statusData,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error updating status:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this._sendErrorToWebview(`Failed to get status: ${errorMessage}`);
    }
  }

  /**
   * Send error message to webview
   */
  private async _sendErrorToWebview(error: string): Promise<void> {
    if (!this._view) {
      return;
    }

    await this._view.webview.postMessage({
      type: 'error',
      data: { message: error },
    });
  }

  /**
   * Generate HTML content for the webview
   */
  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webhook Toolkit</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            margin: 0;
            padding: 16px;
        }

        .section {
            margin-bottom: 20px;
        }

        .section-title {
            font-weight: 600;
            font-size: 13px;
            color: var(--vscode-sideBarSectionHeader-foreground);
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .status-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 13px;
        }

        .status-label {
            color: var(--vscode-sideBar-foreground);
        }

        .status-value {
            color: var(--vscode-textLink-foreground);
            font-weight: 500;
        }

        .status-running {
            color: var(--vscode-gitDecoration-addedResourceForeground);
        }

        .status-stopped {
            color: var(--vscode-gitDecoration-deletedResourceForeground);
        }

        .button {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 13px;
            border-radius: 2px;
            margin: 4px 0;
            transition: background-color 0.2s;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .button:active {
            background-color: var(--vscode-button-hoverBackground);
        }

        .button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            opacity: 0.6;
        }

        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-color: var(--vscode-button-border);
        }

        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 8px;
            border-radius: 3px;
            font-size: 12px;
            margin: 8px 0;
        }

        .loading {
            opacity: 0.6;
            pointer-events: none;
        }

        .icon {
            font-family: codicon;
            font-size: 16px;
            margin-right: 6px;
        }

        .link-button {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            font-size: 12px;
            cursor: pointer;
            border: none;
            background: none;
            padding: 2px 0;
            margin: 2px 0;
        }

        .link-button:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">Server Status</div>
        <div class="status-item">
            <span class="status-label">Status:</span>
            <span id="server-status" class="status-value status-stopped">Stopped</span>
        </div>
        <div class="status-item">
            <span class="status-label">Port:</span>
            <span id="server-port" class="status-value">-</span>
        </div>
        <button id="toggle-button" class="button" onclick="toggleServer()">
            <span class="icon">▶</span>
            Start Server
        </button>
    </div>

    <div class="section">
        <div class="section-title">Configuration</div>
        <div class="status-item">
            <span class="status-label">Default Port:</span>
            <span id="config-port" class="status-value">3000</span>
        </div>
        <div class="status-item">
            <span class="status-label">Auto Find Port:</span>
            <span id="config-auto-find" class="status-value">Yes</span>
        </div>
        <div class="status-item">
            <span class="status-label">Response Code:</span>
            <span id="config-response-code" class="status-value">201</span>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Requests</div>
        <div class="status-item">
            <span class="status-label">Stored:</span>
            <span id="request-count" class="status-value">0</span>
        </div>
        <button class="button secondary" onclick="clearRequests()">
            <span class="icon">🗑</span>
            Clear Requests
        </button>
    </div>

    <div class="section">
        <div class="section-title">Actions</div>
        <button class="link-button" onclick="openSettings()">
            <span class="icon">⚙</span>
            Open Settings
        </button>
    </div>

    <div id="error-container"></div>

    <script>
        const vscode = acquireVsCodeApi();
        let isLoading = false;

        // Send initial status request
        vscode.postMessage({ type: 'getStatus' });

        function setLoading(loading) {
            isLoading = loading;
            document.body.classList.toggle('loading', loading);
            document.getElementById('toggle-button').disabled = loading;
        }

        function updateStatus(status) {
            setLoading(false);
            clearError();

            // Update server status
            const statusElement = document.getElementById('server-status');
            const portElement = document.getElementById('server-port');
            const toggleButton = document.getElementById('toggle-button');

            if (status.isRunning) {
                statusElement.textContent = 'Running';
                statusElement.className = 'status-value status-running';
                portElement.textContent = status.port || '-';
                toggleButton.innerHTML = '<span class="icon">⏹</span>Stop Server';
            } else {
                statusElement.textContent = 'Stopped';
                statusElement.className = 'status-value status-stopped';
                portElement.textContent = '-';
                toggleButton.innerHTML = '<span class="icon">▶</span>Start Server';
            }

            // Update configuration
            document.getElementById('config-port').textContent = status.config.server.port;
            document.getElementById('config-auto-find').textContent = status.config.server.autoFindPort ? 'Yes' : 'No';
            document.getElementById('config-response-code').textContent = status.config.server.responseCode;

            // Update request count
            document.getElementById('request-count').textContent = status.requestCount;
        }

        function showError(message) {
            const errorContainer = document.getElementById('error-container');
            errorContainer.innerHTML = '<div class="error">' + message + '</div>';
            setLoading(false);
        }

        function clearError() {
            document.getElementById('error-container').innerHTML = '';
        }

        function toggleServer() {
            if (isLoading) return;

            setLoading(true);
            const statusElement = document.getElementById('server-status');
            const isRunning = statusElement.textContent === 'Running';

            if (isRunning) {
                vscode.postMessage({ type: 'stopServer' });
            } else {
                vscode.postMessage({ type: 'startServer' });
            }
        }

        function clearRequests() {
            // Always send the clearRequests message to the extension for confirmation
            vscode.postMessage({ type: 'clearRequests' });
        }

        function openSettings() {
            vscode.postMessage({ type: 'openSettings' });
        }

        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'statusUpdate':
                    updateStatus(message.data);
                    break;
                case 'error':
                    showError(message.data.message);
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}
