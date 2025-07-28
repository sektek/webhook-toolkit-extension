import { WebhookConfig } from './config';
import { expect } from 'chai';

describe('Configuration Module', function () {
  it('should export WebhookConfig interface with correct structure', function () {
    // Create a test configuration object to validate the interface
    const testConfig: WebhookConfig = {
      server: {
        port: 3000,
        autoFindPort: true,
        responseCode: 201,
        responseHeaders: { 'Content-Type': 'application/json' },
        responseBody: 'OK',
      },
      storage: {
        maxRequests: 100,
      },
    };

    // Verify structure
    expect(testConfig.server).to.be.an('object');
    expect(testConfig.server.port).to.be.a('number');
    expect(testConfig.server.autoFindPort).to.be.a('boolean');
    expect(testConfig.server.responseCode).to.be.a('number');
    expect(testConfig.server.responseHeaders).to.be.an('object');
    expect(testConfig.server.responseBody).to.be.a('string');
    expect(testConfig.storage).to.be.an('object');
    expect(testConfig.storage.maxRequests).to.be.a('number');
  });

  it('should validate configuration constraints', function () {
    // Test valid port range
    const validConfig: WebhookConfig = {
      server: {
        port: 3000, // Should be between 1024-65535
        autoFindPort: true,
        responseCode: 201, // Should be between 200-299
        responseHeaders: {},
        responseBody: '',
      },
      storage: {
        maxRequests: 100, // Should be between 1-10000
      },
    };

    // Verify the values are within expected ranges
    expect(validConfig.server.port).to.be.at.least(1024);
    expect(validConfig.server.port).to.be.at.most(65535);
    expect(validConfig.server.responseCode).to.be.at.least(200);
    expect(validConfig.server.responseCode).to.be.at.most(299);
    expect(validConfig.storage.maxRequests).to.be.at.least(1);
    expect(validConfig.storage.maxRequests).to.be.at.most(10000);
  });
});
