import { Request } from 'express';
import { createRequestRecord } from './request-factory';
import { expect } from 'chai';

describe('Request Factory Module', function () {
  describe('createRequestRecord', function () {
    it('should create a valid RequestRecord from Express Request', function () {
      // Mock Express Request object
      const mockRequest = {
        method: 'POST',
        path: '/webhook/test',
        url: '/webhook/test',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0',
          'x-custom-header': 'test-value',
        },
        body: { test: 'data', nested: { value: 123 } },
      } as unknown as Request;

      const ip = '192.168.1.100';
      const record = createRequestRecord(mockRequest, ip);

      // Verify structure
      expect(record.id).to.be.a('string');
      expect(record.id).to.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ); // UUID v4 format
      expect(record.timestamp).to.be.instanceOf(Date);
      expect(record.ip).to.equal(ip);
      expect(record.method).to.equal('POST');
      expect(record.path).to.equal('/webhook/test');
      expect(record.headers).to.be.an('object');
      expect(record.body).to.be.a('string');
      expect(record.contentType).to.equal('application/json');
      expect(record.bodySize).to.be.a('number');
    });

    it('should handle PUT method', function () {
      const mockRequest = {
        method: 'PUT',
        path: '/api/update',
        headers: {},
        body: 'plain text body',
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.method).to.equal('PUT');
    });

    it('should throw error for unsupported HTTP methods', function () {
      const mockRequest = {
        method: 'GET',
        path: '/test',
        headers: {},
        body: '',
      } as unknown as Request;

      expect(() => createRequestRecord(mockRequest, '127.0.0.1')).to.throw(
        'Unsupported HTTP method: GET',
      );
    });

    it('should handle string body correctly', function () {
      const bodyContent = 'This is a plain text body';
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: { 'content-type': 'text/plain' },
        body: bodyContent,
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.body).to.equal(bodyContent);
      expect(record.bodySize).to.equal(Buffer.byteLength(bodyContent, 'utf8'));
    });

    it('should handle Buffer body correctly', function () {
      const bodyContent = 'Binary data content';
      const buffer = Buffer.from(bodyContent, 'utf8');
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: { 'content-type': 'application/octet-stream' },
        body: buffer,
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.body).to.equal(bodyContent);
      expect(record.bodySize).to.equal(Buffer.byteLength(bodyContent, 'utf8'));
    });

    it('should handle object body by stringifying it', function () {
      const bodyObject = { message: 'hello', count: 42, active: true };
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: { 'content-type': 'application/json' },
        body: bodyObject,
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      const expectedBody = JSON.stringify(bodyObject);
      expect(record.body).to.equal(expectedBody);
      expect(record.bodySize).to.equal(Buffer.byteLength(expectedBody, 'utf8'));
    });

    it('should handle empty or null body', function () {
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {},
        body: null,
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.body).to.equal('');
      expect(record.bodySize).to.equal(0);
    });

    it('should handle undefined body', function () {
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {},
        body: undefined,
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.body).to.equal('');
      expect(record.bodySize).to.equal(0);
    });

    it('should normalize header keys to lowercase', function () {
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'test-agent',
          'X-Custom-Header': 'value',
        },
        body: '',
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.headers).to.deep.equal({
        'content-type': 'application/json',
        'user-agent': 'test-agent',
        'x-custom-header': 'value',
      });
    });

    it('should handle multi-value headers', function () {
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {
          accept: ['application/json', 'text/plain'],
          'content-type': 'application/json',
        },
        body: '',
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.headers['accept']).to.equal('application/json, text/plain');
      expect(record.headers['content-type']).to.equal('application/json');
    });

    it('should use path from url if path is not available', function () {
      const mockRequest = {
        method: 'POST',
        url: '/webhook/from-url',
        headers: {},
        body: '',
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.path).to.equal('/webhook/from-url');
    });

    it('should default to "/" if neither path nor url is available', function () {
      const mockRequest = {
        method: 'POST',
        headers: {},
        body: '',
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.path).to.equal('/');
    });

    it('should handle non-string header values', function () {
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {
          'content-length': 123,
          'x-custom': undefined,
        },
        body: '',
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.headers['content-length']).to.equal('123');
      expect(record.headers['x-custom']).to.be.undefined;
    });

    it('should extract contentType from headers', function () {
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {
          'content-type': 'application/xml; charset=utf-8',
        },
        body: '<xml>test</xml>',
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.contentType).to.equal('application/xml; charset=utf-8');
    });

    it('should handle missing contentType', function () {
      const mockRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {},
        body: 'some data',
      } as unknown as Request;

      const record = createRequestRecord(mockRequest, '127.0.0.1');
      expect(record.contentType).to.be.undefined;
    });
  });
});
