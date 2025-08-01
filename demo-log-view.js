#!/usr/bin/env node

/**
 * Demo script to showcase the log view data formatting
 */

const { FileRequestStorage } = require('./out/request-storage');

// Mock vscode context for demonstration
const mockContext = {
  storageUri: { fsPath: './manual-test-storage' },
  globalStorageUri: { fsPath: './manual-test-storage' },
};

async function demonstrateLogView() {
  console.log('🎯 Webhook Log View Data Demo\n');

  try {
    // Create storage instance
    const storage = new FileRequestStorage(mockContext, 100);

    // Get all requests
    const requests = await storage.getRequests();
    console.log(`📦 Total requests: ${requests.length}`);

    if (requests.length > 0) {
      // Sort by timestamp (newest first) - simulates what the tree view does
      const sortedRequests = requests.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      console.log(
        '\n📋 Request List (as would be shown in VS Code tree view):',
      );
      console.log(
        '──────────────────────────────────────────────────────────────',
      );

      for (const [index, request] of sortedRequests.entries()) {
        // Simulate tree item label formatting (from logViewProvider.ts)
        const timestamp = formatTimestamp(new Date(request.timestamp));
        const label = `[${timestamp}] [${request.method}] ${request.path} (${request.ip})`;
        console.log(`${index + 1}. ${label}`);

        // Show tooltip info (what would appear on hover)
        const tooltip = createTooltip(request);
        console.log(`   💡 Tooltip: ${tooltip.split('\n')[0]}...`); // First line only
      }

      console.log('\n🔍 Detailed view of first request:');
      const firstRequest = sortedRequests[0];
      console.log(JSON.stringify(firstRequest, null, 2));

      console.log('\n📊 Tree Item Properties:');
      console.log(
        `   • Label: [${formatTimestamp(new Date(firstRequest.timestamp))}] [${firstRequest.method}] ${firstRequest.path} (${firstRequest.ip})`,
      );
      console.log(`   • Context Value: "requestItem"`);
      console.log(
        `   • Icon: ${firstRequest.method === 'POST' ? 'mail' : 'pencil'}`,
      );
      console.log(`   • ID: ${firstRequest.id}`);
    } else {
      console.log(
        'ℹ️  No requests found. Run create-test-data.js first to create sample data.',
      );
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Format timestamp for display (matches logViewProvider.ts)
 */
function formatTimestamp(timestamp) {
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hours = String(timestamp.getHours()).padStart(2, '0');
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const seconds = String(timestamp.getSeconds()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Create tooltip with full request details (matches logViewProvider.ts)
 */
function createTooltip(request) {
  const lines = [
    `Method: ${request.method}`,
    `Path: ${request.path}`,
    `IP: ${request.ip}`,
    `Timestamp: ${new Date(request.timestamp).toLocaleString()}`,
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

// Run the demo
demonstrateLogView()
  .then(() => {
    console.log('\n✨ Demo completed!');
    console.log('\n📋 VS Code Integration Features:');
    console.log('   • Tree view in bottom panel (not sidebar)');
    console.log(
      '   • Context menu: Right-click → "Open Details" | "Delete Request"',
    );
    console.log('   • Keyboard shortcuts: Enter = details, Delete = remove');
    console.log('   • Real-time updates via periodic refresh');
    console.log('   • Context variable: webhookTool.hasRequests');
    console.log('   • Panel only shows when requests exist');

    console.log('\n🎯 Next: Manual testing in VS Code required');
  })
  .catch(console.error);
