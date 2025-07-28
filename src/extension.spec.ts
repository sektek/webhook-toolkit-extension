import * as fs from 'fs';
import * as path from 'path';

import { expect } from 'chai';

describe('Webhook Extension', function () {
  it('should have compiled extension.js with required exports', function () {
    const extensionPath = path.join(__dirname, '..', 'out', 'extension.js');

    // Verify the file exists
    expect(fs.existsSync(extensionPath)).to.be.true;

    // Read the content and verify it has the required exports
    const content = fs.readFileSync(extensionPath, 'utf8');
    expect(content).to.include('exports.activate');
    expect(content).to.include('exports.deactivate');
  });
});
