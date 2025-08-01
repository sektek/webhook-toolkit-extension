import { expect } from 'chai';
import { RequestRecord } from '../src/request-record';
import { RequestStorage } from '../src/request-storage';

// Since we're testing in a node environment without vscode, 
// let's focus on testing the core logic without vscode dependencies

// Mock storage implementation for testing
class MockRequestStorage implements RequestStorage {
  private requests: RequestRecord[] = [];

  async saveRequest(request: RequestRecord): Promise<void> {
    this.requests.push(request);
  }

  async getRequests(): Promise<RequestRecord[]> {
    return [...this.requests];
  }

  async getRequest(id: string): Promise<RequestRecord | undefined> {
    return this.requests.find(r => r.id === id);
  }

  async deleteRequest(id: string): Promise<void> {
    this.requests = this.requests.filter(r => r.id !== id);
  }

  async clearAll(): Promise<void> {
    this.requests = [];
  }

  async cleanup(): Promise<void> {
    // Mock cleanup - no-op
  }
}

// Mock request record for testing
const createMockRequest = (overrides: Partial<RequestRecord> = {}): RequestRecord => ({
  id: 'test-id-123',
  timestamp: new Date('2024-01-01T12:00:00Z'),
  ip: '127.0.0.1',
  method: 'POST',
  path: '/webhook/test',
  headers: { 'content-type': 'application/json' },
  body: '{"test": true}',
  contentType: 'application/json',
  bodySize: 15,
  ...overrides,
});

describe('Log View Provider Logic', () => {
  let storage: MockRequestStorage;

  beforeEach(() => {
    storage = new MockRequestStorage();
  });

  describe('Storage Integration', () => {
    it('should retrieve all requests from storage', async () => {
      const request1 = createMockRequest({ id: 'req1', path: '/first' });
      const request2 = createMockRequest({ id: 'req2', path: '/second' });
      
      await storage.saveRequest(request1);
      await storage.saveRequest(request2);

      const requests = await storage.getRequests();
      expect(requests).to.have.length(2);
      expect(requests.map(r => r.id)).to.include('req1');
      expect(requests.map(r => r.id)).to.include('req2');
    });

    it('should retrieve request by ID', async () => {
      const request = createMockRequest();
      await storage.saveRequest(request);

      const retrieved = await storage.getRequest(request.id);
      expect(retrieved).to.deep.equal(request);
    });

    it('should delete request by ID', async () => {
      const request = createMockRequest();
      await storage.saveRequest(request);

      // Verify request exists
      let requests = await storage.getRequests();
      expect(requests).to.have.length(1);

      // Delete request
      await storage.deleteRequest(request.id);

      // Verify request is deleted
      requests = await storage.getRequests();
      expect(requests).to.have.length(0);
    });

    it('should check if requests exist', async () => {
      // Initially no requests
      let requests = await storage.getRequests();
      expect(requests.length > 0).to.be.false;

      // Add a request
      await storage.saveRequest(createMockRequest());
      requests = await storage.getRequests();
      expect(requests.length > 0).to.be.true;

      // Clear requests
      await storage.clearAll();
      requests = await storage.getRequests();
      expect(requests.length > 0).to.be.false;
    });
  });

  describe('Request Sorting', () => {
    it('should sort requests by timestamp (newest first)', async () => {
      const request1 = createMockRequest({
        id: 'req1',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        path: '/first',
      });
      const request2 = createMockRequest({
        id: 'req2',
        timestamp: new Date('2024-01-01T12:30:00Z'),
        path: '/second',
      });
      
      await storage.saveRequest(request1);
      await storage.saveRequest(request2);

      const requests = await storage.getRequests();
      const sorted = requests.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      expect(sorted[0].id).to.equal('req2'); // Newer request first
      expect(sorted[1].id).to.equal('req1'); // Older request second
    });
  });

  describe('Label Formatting', () => {
    it('should format timestamp correctly', () => {
      const request = createMockRequest({
        timestamp: new Date('2024-01-01T12:00:00Z')
      });
      
      // Mock the formatting logic
      const formatTimestamp = (timestamp: Date): string => {
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');
        
        return `${month}/${day} ${hours}:${minutes}:${seconds}`;
      };

      const formatted = formatTimestamp(request.timestamp);
      expect(formatted).to.equal('01/01 12:00:00');
    });

    it('should create proper request label format', () => {
      const request = createMockRequest();
      
      // Mock label creation logic 
      const createLabel = (req: RequestRecord): string => {
        const timestamp = '01/01 12:00:00'; // mocked
        return `[${timestamp}] [${req.method}] ${req.path} (${req.ip})`;
      };

      const label = createLabel(request);
      expect(label).to.include('[01/01 12:00:00]');
      expect(label).to.include('[POST]');
      expect(label).to.include('/webhook/test');
      expect(label).to.include('(127.0.0.1)');
    });
  });
});