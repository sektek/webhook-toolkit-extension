import {
  RequestRecord,
  StorageMetadata,
  StorageSchema,
} from './request-record';
import { expect } from 'chai';

describe('Request Record Module', function () {
  describe('RequestRecord Interface', function () {
    it('should validate RequestRecord structure', function () {
      const testRecord: RequestRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        timestamp: new Date(),
        ip: '192.168.1.1',
        method: 'POST',
        path: '/webhook',
        headers: { 'content-type': 'application/json', 'user-agent': 'test' },
        body: '{"test": "data"}',
        contentType: 'application/json',
        bodySize: 16,
      };

      // Verify all required properties exist and have correct types
      expect(testRecord.id).to.be.a('string');
      expect(testRecord.timestamp).to.be.instanceOf(Date);
      expect(testRecord.ip).to.be.a('string');
      expect(testRecord.method).to.be.oneOf(['POST', 'PUT']);
      expect(testRecord.path).to.be.a('string');
      expect(testRecord.headers).to.be.an('object');
      expect(testRecord.body).to.be.a('string');
      expect(testRecord.contentType).to.be.a('string');
      expect(testRecord.bodySize).to.be.a('number');
    });

    it('should allow contentType to be optional', function () {
      const testRecord: RequestRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        timestamp: new Date(),
        ip: '192.168.1.1',
        method: 'PUT',
        path: '/webhook',
        headers: {},
        body: '',
        bodySize: 0,
      };

      expect(testRecord.contentType).to.be.undefined;
    });
  });

  describe('StorageMetadata Interface', function () {
    it('should validate StorageMetadata structure', function () {
      const testMetadata: StorageMetadata = {
        version: '1.0.0',
        lastCleanup: new Date(),
        totalRequestsReceived: 42,
      };

      expect(testMetadata.version).to.be.a('string');
      expect(testMetadata.lastCleanup).to.be.instanceOf(Date);
      expect(testMetadata.totalRequestsReceived).to.be.a('number');
    });
  });

  describe('StorageSchema Interface', function () {
    it('should validate StorageSchema structure', function () {
      const testSchema: StorageSchema = {
        metadata: {
          version: '1.0.0',
          lastCleanup: new Date(),
          totalRequestsReceived: 1,
        },
        requests: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            timestamp: new Date(),
            ip: '192.168.1.1',
            method: 'POST',
            path: '/webhook',
            headers: { 'content-type': 'application/json' },
            body: '{"test": "data"}',
            contentType: 'application/json',
            bodySize: 16,
          },
        ],
      };

      expect(testSchema.metadata).to.be.an('object');
      expect(testSchema.requests).to.be.an('array');
      expect(testSchema.requests).to.have.length(1);
      expect(testSchema.requests[0]).to.be.an('object');
    });

    it('should allow empty requests array', function () {
      const testSchema: StorageSchema = {
        metadata: {
          version: '1.0.0',
          lastCleanup: new Date(),
          totalRequestsReceived: 0,
        },
        requests: [],
      };

      expect(testSchema.requests).to.be.an('array');
      expect(testSchema.requests).to.have.length(0);
    });
  });
});
