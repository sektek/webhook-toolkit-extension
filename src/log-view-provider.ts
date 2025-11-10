import * as vscode from 'vscode';
import { RequestRecord } from './request-record';
import { RequestStorage } from './request-storage';

/**
 * Tree data provider for displaying webhook request logs in the panel
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

  constructor(private storage: RequestStorage) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation of a request
   */
  getTreeItem(element: RequestRecord): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      this.formatLabel(element),
      vscode.TreeItemCollapsibleState.None,
    );

    // Set context value for command targeting
    treeItem.contextValue = 'requestItem';

    // Set icon based on HTTP method
    treeItem.iconPath = new vscode.ThemeIcon(
      element.method === 'POST' ? 'mail' : 'edit',
    );

    // Set tooltip with full request details
    treeItem.tooltip = this.formatTooltip(element);

    // Set description with additional metadata
    treeItem.description = this.formatDescription(element);

    // Store the request ID in the command argument
    treeItem.command = {
      command: 'webhookTool.openRequestDetails',
      title: 'Open Request Details',
      arguments: [element.id],
    };

    return treeItem;
  }

  /**
   * Get children elements (requests)
   */
  async getChildren(element?: RequestRecord): Promise<RequestRecord[]> {
    if (element) {
      // No nested children
      return [];
    }

    try {
      const requests = await this.storage.getRequests();
      // Sort by timestamp (newest first)
      return requests.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading requests:', error);
      return [];
    }
  }

  /**
   * Format the label for a request item
   * Format: "[TIMESTAMP] [METHOD] [PATH] ([IP])"
   */
  private formatLabel(request: RequestRecord): string {
    const timestamp = this.formatTimestamp(request.timestamp);
    const method = request.method.padEnd(4, ' ');
    const path = this.truncatePath(request.path, 40);
    const ip = request.ip;

    return `[${timestamp}] [${method}] ${path} (${ip})`;
  }

  /**
   * Format timestamp as "MM/dd HH:mm:ss"
   */
  private formatTimestamp(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Truncate long paths with ellipsis
   */
  private truncatePath(path: string, maxLength: number): string {
    if (path.length <= maxLength) {
      return path;
    }
    return `${path.substring(0, maxLength - 3)}...`;
  }

  /**
   * Format the description showing request size
   */
  private formatDescription(request: RequestRecord): string {
    const sizeKB = (request.bodySize / 1024).toFixed(2);
    return `${sizeKB} KB`;
  }

  /**
   * Format the tooltip with full request details
   */
  private formatTooltip(request: RequestRecord): string {
    const timestamp = request.timestamp.toLocaleString();
    const contentType = request.contentType || 'N/A';
    const headerCount = Object.keys(request.headers).length;

    return [
      `Timestamp: ${timestamp}`,
      `Method: ${request.method}`,
      `Path: ${request.path}`,
      `IP: ${request.ip}`,
      `Content-Type: ${contentType}`,
      `Body Size: ${request.bodySize} bytes`,
      `Headers: ${headerCount}`,
    ].join('\n');
  }
}
