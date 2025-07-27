import { describe, it } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

describe('Webhook Extension', () => {
  it('should have compiled extension.js with required exports', () => {
    const extensionPath = path.join(__dirname, '..', 'out', 'extension.js');
    
    // Verify the file exists
    expect(fs.existsSync(extensionPath)).to.be.true;
    
    // Read the content and verify it has the required exports
    const content = fs.readFileSync(extensionPath, 'utf8');
    expect(content).to.include('exports.activate');
    expect(content).to.include('exports.deactivate');
  });
});