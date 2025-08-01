#!/usr/bin/env node

/**
 * Manual test script to populate webhook storage with sample requests
 * and verify the log view functionality works correctly.
 */

const fs = require('fs');
const path = require('path');

// Create sample request data
const sampleRequests = [
  {
    id: 'req-001',
    timestamp: new Date('2024-01-01T12:00:00Z').toISOString(),
    ip: '192.168.1.100',
    method: 'POST',
    path: '/webhook/payment',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'PaymentGateway/1.0',
      'x-signature': 'sha256=abc123',
    },
    body: '{"event": "payment.completed", "amount": 99.99, "currency": "USD"}',
    contentType: 'application/json',
    bodySize: 64,
  },
  {
    id: 'req-002',
    timestamp: new Date('2024-01-01T12:15:00Z').toISOString(),
    ip: '10.0.0.50',
    method: 'PUT',
    path: '/api/users/update',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer token123',
    },
    body: '{"userId": 456, "name": "John Doe", "email": "john@example.com"}',
    contentType: 'application/json',
    bodySize: 67,
  },
  {
    id: 'req-003',
    timestamp: new Date('2024-01-01T12:30:00Z').toISOString(),
    ip: '172.16.0.25',
    method: 'POST',
    path: '/webhook/github',
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'push',
      'x-github-delivery': 'abc-def-123',
    },
    body: '{"ref": "refs/heads/main", "commits": [{"id": "abc123", "message": "Fix bug"}]}',
    contentType: 'application/json',
    bodySize: 84,
  },
  {
    id: 'req-004',
    timestamp: new Date('2024-01-01T12:45:00Z').toISOString(),
    ip: '203.0.113.15',
    method: 'POST',
    path: '/webhook/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 'v1=xyz789',
    },
    body: '{"type": "invoice.payment_succeeded", "data": {"object": {"id": "in_123"}}}',
    contentType: 'application/json',
    bodySize: 78,
  },
];

// Storage schema structure
const storageSchema = {
  metadata: {
    version: '1.0.0',
    lastCleanup: new Date().toISOString(),
    totalRequestsReceived: sampleRequests.length,
  },
  requests: sampleRequests,
};

// Create test storage directory and file
const testStorageDir = path.join(__dirname, 'manual-test-storage');
const testStorageFile = path.join(testStorageDir, 'webhook-requests.json');

try {
  // Ensure directory exists
  if (!fs.existsSync(testStorageDir)) {
    fs.mkdirSync(testStorageDir, { recursive: true });
  }

  // Write sample data
  fs.writeFileSync(testStorageFile, JSON.stringify(storageSchema, null, 2));

  console.log('✅ Sample webhook requests created successfully!');
  console.log(`📁 Storage file: ${testStorageFile}`);
  console.log(`📊 Created ${sampleRequests.length} sample requests:`);

  sampleRequests.forEach((req, index) => {
    const timestamp = new Date(req.timestamp).toLocaleString();
    console.log(
      `   ${index + 1}. [${timestamp}] ${req.method} ${req.path} (${req.ip})`,
    );
  });

  console.log('\n📋 Manual Testing Checklist:');
  console.log('1. Open VS Code with this extension');
  console.log('2. Run "Webhook Tool: Start Server" command');
  console.log('3. Check if "Webhook Tool" panel appears in bottom area');
  console.log('4. Verify log view shows sample requests');
  console.log('5. Test right-click context menu (Open Details, Delete)');
  console.log('6. Test keyboard shortcuts (Enter, Delete)');
  console.log('7. Send a real webhook request to verify real-time updates');
  console.log(
    '8. Verify panel only shows when webhookTool.hasRequests is true',
  );

  console.log('\n🧪 To test real-time updates, send a POST request:');
  console.log(
    'curl -X POST http://localhost:3000/test -H "Content-Type: application/json" -d \'{"test": true}\'',
  );
} catch (error) {
  console.error('❌ Error creating test data:', error);
  process.exit(1);
}
