import * as vscode from 'vscode';
import { RequestRecord } from './request-record';
import { RequestStorage } from './request-storage';

/**
 * Tree data provider for the webhook request log view
 */
export class WebhookLogProvider
  implements vscode.TreeDataProvider<RequestRecord>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    RequestRecord | undefined | null | void
  > = new vscode.EventEmitter<RequestRecord | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    RequestRecord | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private requestStorage: RequestStorage) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation of a request record
   */
  getTreeItem(element: RequestRecord): vscode.TreeItem {
    const timestamp = this.formatTimestamp(element.timestamp);
    const label = `[${timestamp}] [${element.method}] ${element.path} (${element.ip})`;

    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
    );

    // Set context value for command targeting
    item.contextValue = 'requestItem';

    // Set icon based on method
    item.iconPath = new vscode.ThemeIcon(
      element.method === 'POST' ? 'mail' : 'pencil',
    );

    // Set tooltip with full request details
    item.tooltip = this.createTooltip(element);

    // Store the request ID for command handling
    item.id = element.id;

    return item;
  }

  /**
   * Get children of the tree (root level shows all requests)
   */
  async getChildren(element?: RequestRecord): Promise<RequestRecord[]> {
    if (!element) {
      // Root level - return all requests sorted by timestamp (newest first)
      try {
        const requests = await this.requestStorage.getRequests();
        return requests.sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
        );
      } catch (error) {
        // Show error in output channel but return empty array to avoid UI errors
        // eslint-disable-next-line no-console
        console.error('Failed to load webhook requests:', error);
        return [];
      }
    }

    // No children for individual request items
    return [];
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: Date): string {
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const seconds = String(timestamp.getSeconds()).padStart(2, '0');

    return `${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Create tooltip with full request details
   */
  private createTooltip(request: RequestRecord): string {
    const lines = [
      `Method: ${request.method}`,
      `Path: ${request.path}`,
      `IP: ${request.ip}`,
      `Timestamp: ${request.timestamp.toLocaleString()}`,
      `Body Size: ${request.bodySize} bytes`,
    ];

    if (request.contentType) {
      lines.push(`Content-Type: ${request.contentType}`);
    }

    // Add headers (limit to avoid extremely long tooltips)
    const headerCount = Object.keys(request.headers).length;
    if (headerCount > 0) {
      lines.push(`Headers: ${headerCount} header(s)`);
    }

    return lines.join('\n');
  }

  /**
   * Get a request by its ID (used by commands)
   */
  async getRequestById(id: string): Promise<RequestRecord | undefined> {
    try {
      return await this.requestStorage.getRequest(id);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to get request by ID:', error);
      return undefined;
    }
  }

  /**
   * Delete a request by its ID
   */
  async deleteRequest(id: string): Promise<void> {
    try {
      await this.requestStorage.deleteRequest(id);
      this.refresh();
    } catch (error) {
      throw new Error(
        `Failed to delete request: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Check if there are any requests (for context variable)
   */
  async hasRequests(): Promise<boolean> {
    try {
      const requests = await this.requestStorage.getRequests();
      return requests.length > 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to check if has requests:', error);
      return false;
    }
  }
}
