import { expect } from 'chai';
import { InMemoryRequestStorage, WebhookRequest } from './request-storage';
import { WebhookConfig } from './config';

describe('Request Storage', () => {
  let requestStorage: InMemoryRequestStorage;
  let config: WebhookConfig;

  beforeEach(() => {
    config = {
      server: {
        port: 3000,
        autoFindPort: true,
        responseCode: 201,
        responseHeaders: {},
        responseBody: '',
      },
      storage: {
        maxRequests: 5,
      },
    };
    requestStorage = new InMemoryRequestStorage(config);
  });

  describe('Request Management', () => {
    it('should start with zero requests', () => {
      expect(requestStorage.getRequestCount()).to.equal(0);
      expect(requestStorage.getRequests()).to.deep.equal([]);
    });

    it('should add and retrieve requests', () => {
      const request: WebhookRequest = {
        id: '1',
        timestamp: new Date(),
        method: 'POST',
        path: '/webhook',
        headers: { 'content-type': 'application/json' },
        body: { test: 'data' },
        responseCode: 201,
      };

      requestStorage.addRequest(request);

      expect(requestStorage.getRequestCount()).to.equal(1);
      expect(requestStorage.getRequests()).to.have.length(1);
      expect(requestStorage.getRequests()[0]).to.deep.equal(request);
    });

    it('should maintain most recent first order', () => {
      const request1: WebhookRequest = {
        id: '1',
        timestamp: new Date(),
        method: 'POST',
        path: '/webhook1',
        headers: {},
        body: {},
        responseCode: 201,
      };

      const request2: WebhookRequest = {
        id: '2',
        timestamp: new Date(),
        method: 'POST',
        path: '/webhook2',
        headers: {},
        body: {},
        responseCode: 201,
      };

      requestStorage.addRequest(request1);
      requestStorage.addRequest(request2);

      const requests = requestStorage.getRequests();
      expect(requests[0].id).to.equal('2'); // Most recent first
      expect(requests[1].id).to.equal('1');
    });

    it('should enforce max requests limit', () => {
      // Add more requests than the limit
      for (let i = 0; i < 7; i++) {
        const request: WebhookRequest = {
          id: i.toString(),
          timestamp: new Date(),
          method: 'POST',
          path: `/webhook${i}`,
          headers: {},
          body: {},
          responseCode: 201,
        };
        requestStorage.addRequest(request);
      }

      expect(requestStorage.getRequestCount()).to.equal(5); // Should be limited to max
      const requests = requestStorage.getRequests();
      expect(requests[0].id).to.equal('6'); // Most recent
      expect(requests[4].id).to.equal('2'); // Oldest kept
    });

    it('should clear all requests', () => {
      const request: WebhookRequest = {
        id: '1',
        timestamp: new Date(),
        method: 'POST',
        path: '/webhook',
        headers: {},
        body: {},
        responseCode: 201,
      };

      requestStorage.addRequest(request);
      expect(requestStorage.getRequestCount()).to.equal(1);

      requestStorage.clearRequests();
      expect(requestStorage.getRequestCount()).to.equal(0);
      expect(requestStorage.getRequests()).to.deep.equal([]);
    });

    it('should update configuration and trim requests if needed', () => {
      // Add 5 requests (at the limit)
      for (let i = 0; i < 5; i++) {
        const request: WebhookRequest = {
          id: i.toString(),
          timestamp: new Date(),
          method: 'POST',
          path: `/webhook${i}`,
          headers: {},
          body: {},
          responseCode: 201,
        };
        requestStorage.addRequest(request);
      }

      expect(requestStorage.getRequestCount()).to.equal(5);

      // Update config to allow only 3 requests
      const newConfig = { ...config, storage: { maxRequests: 3 } };
      requestStorage.updateConfig(newConfig);

      expect(requestStorage.getRequestCount()).to.equal(3);
      const requests = requestStorage.getRequests();
      expect(requests[0].id).to.equal('4'); // Most recent should be kept
      expect(requests[2].id).to.equal('2');
    });
  });
});