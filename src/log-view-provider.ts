import * as vscode from 'vscode';
import { RequestRecord } from './request-record';
import { RequestStorage } from './request-storage';

/**
 * Tree item representing a webhook request in the log view
 */
export class WebhookRequestTreeItem extends vscode.TreeItem {
  constructor(
    public readonly request: RequestRecord,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    // Format label: "[TIMESTAMP] [METHOD] [PATH] ([IP])"
    const timestamp = request.timestamp.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Truncate long paths
    const truncatedPath =
      request.path.length > 30
        ? `${request.path.substring(0, 27)}...`
        : request.path;

    super(
      `[${timestamp}] [${request.method}] ${truncatedPath} (${request.ip})`,
      collapsibleState,
    );

    this.tooltip = this.getTooltip();
    this.description = `${request.bodySize} bytes`;
    this.contextValue = 'requestItem';

    // Set different icons for POST vs PUT requests
    this.iconPath = new vscode.ThemeIcon(
      request.method === 'POST' ? 'mail' : 'edit',
    );

    // Store the request ID for command usage
    this.id = request.id;
  }

  /**
   * Generate detailed tooltip for the request
   */
  private getTooltip(): string {
    const { request } = this;
    const timestamp = request.timestamp.toLocaleString();

    const headerCount = Object.keys(request.headers).length;
    const contentType = request.contentType || 'unknown';

    return [
      `Timestamp: ${timestamp}`,
      `Method: ${request.method}`,
      `Path: ${request.path}`,
      `IP Address: ${request.ip}`,
      `Content-Type: ${contentType}`,
      `Body Size: ${request.bodySize} bytes`,
      `Headers: ${headerCount} header${headerCount === 1 ? '' : 's'}`,
    ].join('\n');
  }
}

/**
 * Tree data provider for webhook request logs
 */
export class WebhookLogProvider
  implements vscode.TreeDataProvider<WebhookRequestTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    WebhookRequestTreeItem | undefined | null | void
  > = new vscode.EventEmitter<
    WebhookRequestTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<
    WebhookRequestTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private readonly storage: RequestStorage) {}

  /**
   * Get tree item representation
   */
  getTreeItem(element: WebhookRequestTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children elements (webhook requests)
   */
  async getChildren(
    element?: WebhookRequestTreeItem,
  ): Promise<WebhookRequestTreeItem[]> {
    if (!element) {
      // Root level - return all requests
      try {
        const requests = await this.storage.getRequests();

        if (requests.length === 0) {
          return [];
        }

        // Sort requests by timestamp (newest first)
        const sortedRequests = requests.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        return sortedRequests.map(
          request =>
            new WebhookRequestTreeItem(
              request,
              vscode.TreeItemCollapsibleState.None,
            ),
        );
      } catch (error) {
        // Log error and return empty array
        // eslint-disable-next-line no-console
        console.error('Error loading webhook requests:', error);
        return [];
      }
    }

    // No children for individual request items
    return [];
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get a specific request by ID
   */
  async getRequest(id: string): Promise<RequestRecord | undefined> {
    try {
      return await this.storage.getRequest(id);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting request:', error);
      return undefined;
    }
  }

  /**
   * Delete a request by ID
   */
  async deleteRequest(id: string): Promise<void> {
    try {
      await this.storage.deleteRequest(id);
      this.refresh();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error deleting request:', error);
      throw error;
    }
  }

  /**
   * Check if there are any requests
   */
  async hasRequests(): Promise<boolean> {
    try {
      const requests = await this.storage.getRequests();
      return requests.length > 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error checking for requests:', error);
      return false;
    }
  }
}
