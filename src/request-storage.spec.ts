import * as fs from 'fs/promises';
import * as path from 'path';

import { FileRequestStorage } from './request-storage';
import { RequestRecord } from './request-record';
import { expect } from 'chai';

// Mock vscode ExtensionContext for testing
interface MockExtensionContext {
  storageUri?: { fsPath: string };
  globalStorageUri: { fsPath: string };
}

describe('Request Storage Module', function () {
  let storage: FileRequestStorage;
  let mockContext: MockExtensionContext;
  let tempStorageDir: string;

  beforeEach(async function () {
    // Create a temporary storage directory for testing
    tempStorageDir = path.join(
      __dirname,
      '..',
      'test-storage',
      `test-${Date.now()}`,
    );

    // Mock VS Code extension context
    mockContext = {
      storageUri: { fsPath: tempStorageDir },
      globalStorageUri: { fsPath: tempStorageDir },
    };

    // Create storage instance with small max requests for testing
    storage = new FileRequestStorage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockContext as any,
      3,
    );
  });

  afterEach(async function () {
    // Clean up test storage directory
    try {
      await fs.rm(tempStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Basic Storage Operations', function () {
    it('should save and retrieve a request', async function () {
      const testRequest: RequestRecord = {
        id: 'test-id-1',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        ip: '192.168.1.1',
        method: 'POST',
        path: '/webhook',
        headers: { 'content-type': 'application/json' },
        body: '{"test": "data"}',
        contentType: 'application/json',
        bodySize: 16,
      };

      await storage.saveRequest(testRequest);
      const retrievedRequest = await storage.getRequest('test-id-1');

      expect(retrievedRequest).to.not.be.undefined;
      expect(retrievedRequest!.id).to.equal(testRequest.id);
      expect(retrievedRequest!.ip).to.equal(testRequest.ip);
      expect(retrievedRequest!.method).to.equal(testRequest.method);
      expect(retrievedRequest!.path).to.equal(testRequest.path);
      expect(retrievedRequest!.body).to.equal(testRequest.body);
      expect(retrievedRequest!.bodySize).to.equal(testRequest.bodySize);
    });

    it('should retrieve all requests', async function () {
      const request1: RequestRecord = {
        id: 'test-id-1',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        ip: '192.168.1.1',
        method: 'POST',
        path: '/webhook1',
        headers: {},
        body: 'data1',
        bodySize: 5,
      };

      const request2: RequestRecord = {
        id: 'test-id-2',
        timestamp: new Date('2023-01-01T11:00:00Z'),
        ip: '192.168.1.2',
        method: 'PUT',
        path: '/webhook2',
        headers: {},
        body: 'data2',
        bodySize: 5,
      };

      await storage.saveRequest(request1);
      await storage.saveRequest(request2);

      const allRequests = await storage.getRequests();
      expect(allRequests).to.have.length(2);
      expect(allRequests[0].id).to.equal('test-id-1');
      expect(allRequests[1].id).to.equal('test-id-2');
    });

    it('should return undefined for non-existent request', async function () {
      const result = await storage.getRequest('non-existent-id');
      expect(result).to.be.undefined;
    });

    it('should delete a specific request', async function () {
      const testRequest: RequestRecord = {
        id: 'test-id-to-delete',
        timestamp: new Date(),
        ip: '192.168.1.1',
        method: 'POST',
        path: '/webhook',
        headers: {},
        body: 'test data',
        bodySize: 9,
      };

      await storage.saveRequest(testRequest);

      // Verify it exists
      let retrievedRequest = await storage.getRequest('test-id-to-delete');
      expect(retrievedRequest).to.not.be.undefined;

      // Delete it
      await storage.deleteRequest('test-id-to-delete');

      // Verify it's gone
      retrievedRequest = await storage.getRequest('test-id-to-delete');
      expect(retrievedRequest).to.be.undefined;
    });

    it('should clear all requests', async function () {
      // Add some requests
      for (let i = 0; i < 3; i++) {
        const request: RequestRecord = {
          id: `test-id-${i}`,
          timestamp: new Date(),
          ip: '192.168.1.1',
          method: 'POST',
          path: `/webhook${i}`,
          headers: {},
          body: `data${i}`,
          bodySize: 5,
        };
        await storage.saveRequest(request);
      }

      // Verify requests exist
      let allRequests = await storage.getRequests();
      expect(allRequests).to.have.length(3);

      // Clear all
      await storage.clearAll();

      // Verify all are gone
      allRequests = await storage.getRequests();
      expect(allRequests).to.have.length(0);
    });
  });

  describe('FIFO Cleanup Logic', function () {
    it('should remove oldest requests when exceeding maxRequests limit', async function () {
      // Add requests up to the limit (3)
      for (let i = 0; i < 3; i++) {
        const request: RequestRecord = {
          id: `test-id-${i}`,
          timestamp: new Date(Date.now() + i * 1000), // Ensure different timestamps
          ip: '192.168.1.1',
          method: 'POST',
          path: `/webhook${i}`,
          headers: {},
          body: `data${i}`,
          bodySize: 5,
        };
        await storage.saveRequest(request);
      }

      // Verify we have 3 requests
      let allRequests = await storage.getRequests();
      expect(allRequests).to.have.length(3);
      expect(allRequests[0].id).to.equal('test-id-0');

      // Add one more request, which should trigger cleanup
      const newRequest: RequestRecord = {
        id: 'test-id-3',
        timestamp: new Date(Date.now() + 4000),
        ip: '192.168.1.1',
        method: 'POST',
        path: '/webhook3',
        headers: {},
        body: 'data3',
        bodySize: 5,
      };
      await storage.saveRequest(newRequest);

      // Should still have 3 requests, but the oldest should be gone
      allRequests = await storage.getRequests();
      expect(allRequests).to.have.length(3);
      expect(allRequests.find(r => r.id === 'test-id-0')).to.be.undefined; // Oldest removed
      expect(allRequests.find(r => r.id === 'test-id-3')).to.not.be.undefined; // Newest added
    });

    it('should cleanup requests when manually calling cleanup()', async function () {
      // Add more requests than the limit
      for (let i = 0; i < 5; i++) {
        const request: RequestRecord = {
          id: `test-id-${i}`,
          timestamp: new Date(Date.now() + i * 1000),
          ip: '192.168.1.1',
          method: 'POST',
          path: `/webhook${i}`,
          headers: {},
          body: `data${i}`,
          bodySize: 5,
        };
        await storage.saveRequest(request);
      }

      // Since we add them one by one, automatic cleanup should keep it at 3
      let allRequests = await storage.getRequests();
      expect(allRequests).to.have.length(3);

      // Manual cleanup should not remove anything since we're already at the limit
      await storage.cleanup();
      allRequests = await storage.getRequests();
      expect(allRequests).to.have.length(3);
    });
  });

  describe('File Operations and Error Handling', function () {
    it('should create storage directory if it does not exist', async function () {
      // Storage directory should be created during first operation
      const testRequest: RequestRecord = {
        id: 'test-id',
        timestamp: new Date(),
        ip: '192.168.1.1',
        method: 'POST',
        path: '/webhook',
        headers: {},
        body: 'test',
        bodySize: 4,
      };

      await storage.saveRequest(testRequest);

      // Check that directory was created
      const stats = await fs.stat(tempStorageDir);
      expect(stats.isDirectory()).to.be.true;
    });

    it('should handle Date serialization and deserialization correctly', async function () {
      const testDate = new Date('2023-06-15T14:30:00.123Z');
      const testRequest: RequestRecord = {
        id: 'test-date-id',
        timestamp: testDate,
        ip: '192.168.1.1',
        method: 'POST',
        path: '/webhook',
        headers: {},
        body: 'test',
        bodySize: 4,
      };

      await storage.saveRequest(testRequest);
      const retrievedRequest = await storage.getRequest('test-date-id');

      expect(retrievedRequest).to.not.be.undefined;
      expect(retrievedRequest!.timestamp).to.be.instanceOf(Date);
      expect(retrievedRequest!.timestamp.getTime()).to.equal(
        testDate.getTime(),
      );
    });

    it('should handle empty storage file correctly', async function () {
      // First operation should work even with no existing file
      const allRequests = await storage.getRequests();
      expect(allRequests).to.be.an('array');
      expect(allRequests).to.have.length(0);
    });

    it('should handle delete operation gracefully when request does not exist', async function () {
      // Should not throw error when deleting non-existent request
      await storage.deleteRequest('non-existent-id');

      // Should still work normally
      const allRequests = await storage.getRequests();
      expect(allRequests).to.have.length(0);
    });
  });

  describe('Storage Metadata', function () {
    it('should track total requests received', async function () {
      // Add some requests
      for (let i = 0; i < 2; i++) {
        const request: RequestRecord = {
          id: `test-id-${i}`,
          timestamp: new Date(),
          ip: '192.168.1.1',
          method: 'POST',
          path: `/webhook${i}`,
          headers: {},
          body: `data${i}`,
          bodySize: 5,
        };
        await storage.saveRequest(request);
      }

      // Access the storage file directly to check metadata
      const storageFilePath = path.join(
        tempStorageDir,
        'webhook-requests.json',
      );
      const fileContent = await fs.readFile(storageFilePath, 'utf8');
      const data = JSON.parse(fileContent);

      expect(data.metadata).to.be.an('object');
      expect(data.metadata.totalRequestsReceived).to.equal(2);
      expect(data.metadata.version).to.be.a('string');
      expect(data.metadata.lastCleanup).to.be.a('string');
    });

    it('should preserve total count when clearing requests', async function () {
      // Add some requests
      for (let i = 0; i < 2; i++) {
        const request: RequestRecord = {
          id: `test-id-${i}`,
          timestamp: new Date(),
          ip: '192.168.1.1',
          method: 'POST',
          path: `/webhook${i}`,
          headers: {},
          body: `data${i}`,
          bodySize: 5,
        };
        await storage.saveRequest(request);
      }

      // Clear all requests
      await storage.clearAll();

      // Check that total count is preserved
      const storageFilePath = path.join(
        tempStorageDir,
        'webhook-requests.json',
      );
      const fileContent = await fs.readFile(storageFilePath, 'utf8');
      const data = JSON.parse(fileContent);

      expect(data.requests).to.have.length(0);
      expect(data.metadata.totalRequestsReceived).to.equal(2); // Should be preserved
    });
  });
});
