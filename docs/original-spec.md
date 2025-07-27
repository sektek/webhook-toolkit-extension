# VS Code Webhook Toolkit Extension - Technical Specification

## 1. Project Overview

### 1.1 Purpose
A VS Code extension that provides webhook development capabilities by running an HTTP server within the editor, capturing incoming requests, and providing a user-friendly interface to view and manage webhook data.

### 1.2 Core Features
- HTTP server for receiving webhook requests
- Request logging with timestamp, headers, body, and origin tracking
- Native VS Code UI integration with syntax highlighting
- Configurable server settings and response handling
- Request management (view, delete, automatic cleanup)

## 2. Technical Requirements

### 2.1 Extension Metadata
- **Extension ID**: `webhook-toolkit-tool`
- **Display Name**: "Webhook Toolkit"
- **Target VS Code Version**: ^1.102 (minimum)
- **Engine**: Node.js compatible
- **Category**: Other/Development Tools

### 2.2 Dependencies
```json
{
  "dependencies": {
    "express": "^5.1.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.3",
    "@types/node": "^24.1.0",
    "@types/vscode": "^1.102.0"
  }
}
```

## 3. Architecture

### 3.1 Core Components

#### 3.1.1 Extension Entry Point (`extension.ts`)
- Extension activation/deactivation lifecycle
- Command registration
- Provider initialization
- Global state management

#### 3.1.2 Webhook Server (`webhookServer.ts`)
```typescript
interface WebhookServer {
  start(port: number, autoFindPort: boolean): Promise<void>;
  stop(): Promise<void>;
  running: boolean;
  port?: number;
}
```

#### 3.1.3 Request Storage (`requestStorage.ts`)
```typescript
interface RequestRecord {
  id: string;
  timestamp: Date;
  ip: string;
  method: 'POST' | 'PUT';
  path: string;
  headers: Record<string, string>;
  body: string;
  contentType?: string;
}

interface RequestStorage {
  saveRequest(request: RequestRecord): Promise<void>;
  getRequests(): Promise<RequestRecord[]>;
  deleteRequest(id: string): Promise<void>;
  clearAll(): Promise<void>;
  cleanup(): Promise<void>; // Enforce size limits
}
```

#### 3.1.4 UI Providers
- **Sidebar Provider** (`sidebarProvider.ts`): Main extension panel
- **Log View Provider** (`logViewProvider.ts`): Request log panel
- **Request Details Provider** (`requestDetailsProvider.ts`): Webview for detailed request view

### 3.2 Data Flow
1. HTTP request received by Express server
2. Request data extracted and sanitized
3. RequestRecord created with unique ID
4. Data saved to workspace storage via VS Code API
5. UI components refreshed to reflect new request
6. Automatic cleanup triggered if limit exceeded

## 4. Configuration Schema

### 4.1 VS Code Settings (`package.json` contribution)
```json
{
  "configuration": {
    "type": "object",
    "title": "Webhook Development Tool",
    "properties": {
      "webhookTool.server.port": {
        "type": "number",
        "default": 3000,
        "description": "Default port for webhook server",
        "minimum": 1024,
        "maximum": 65535
      },
      "webhookTool.server.autoFindPort": {
        "type": "boolean",
        "default": true,
        "description": "Automatically find available port if configured port is in use"
      },
      "webhookTool.server.responseCode": {
        "type": "number",
        "default": 201,
        "description": "HTTP status code to return for successful requests",
        "minimum": 200,
        "maximum": 299
      },
      "webhookTool.server.responseHeaders": {
        "type": "object",
        "default": {},
        "description": "Custom headers to include in responses"
      },
      "webhookTool.server.responseBody": {
        "type": "string",
        "default": "",
        "description": "Response body to return (empty by default)"
      },
      "webhookTool.storage.maxRequests": {
        "type": "number",
        "default": 100,
        "description": "Maximum number of requests to store",
        "minimum": 1,
        "maximum": 10000
      }
    }
  }
}
```

## 5. User Interface Specifications

### 5.1 Status Bar Integration
- **Item ID**: `webhookTool.serverStatus`
- **Text Format**: `🔗 Webhook: {status}` where status is "Running :3000" or "Stopped"
- **Command**: `webhookTool.toggleServer`
- **Tooltip**: "Click to start/stop webhook server"

### 5.2 Sidebar Panel
- **View Container**: Custom sidebar in Activity Bar
- **Icon**: Webhook/link icon
- **Content**:
  - Server status indicator
  - Start/Stop button
  - Current port display
  - Quick settings access
  - Link to open log panel

### 5.3 Log View Panel
- **Location**: Panel area (bottom of editor)
- **View Type**: TreeView with custom provider
- **Columns**: Timestamp, IP, Method, Path
- **Item Actions**:
  - Open details (Enter key)
  - Delete request (Delete key)
  - Context menu with copy options

### 5.4 Request Details Webview
- **Type**: Webview panel
- **Layout**: Split view (headers top, body bottom)
- **Headers Section**:
  - Table format with key-value pairs
  - Copy button for individual headers
- **Body Section**:
  - Tab 1: "Formatted" - syntax highlighted content
  - Tab 2: "Raw" - plain text as received
  - Copy button for body content

## 6. Content Type Support

### 6.1 Recognized Content Types
```typescript
const SUPPORTED_CONTENT_TYPES = {
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/x-www-form-urlencoded': 'properties',
  'text/plain': 'plaintext',
  'text/html': 'html',
  'application/yaml': 'yaml',
  'text/yaml': 'yaml'
};
```

### 6.2 Syntax Highlighting
- Use VS Code's `vscode.languages.setTextDocumentLanguage()` API
- Respect user's current theme settings
- Fallback to plain text for unrecognized types

## 7. Storage Implementation

### 7.1 Storage Location
- Use `vscode.workspace.storageUri` for workspace-specific storage
- Fallback to `vscode.ExtensionContext.storageUri` for user-global storage
- File format: JSON with request records array

### 7.2 Storage Schema
```typescript
interface StorageSchema {
  version: string;
  requests: RequestRecord[];
  metadata: {
    lastCleanup: string;
    totalRequests: number;
  };
}
```

### 7.3 Storage Operations
- Atomic writes with temporary file + rename
- Size limit enforcement via FIFO cleanup
- Graceful handling of corrupted storage files

## 8. Error Handling Strategy

### 8.1 Error Categories

#### 8.1.1 Server Errors
- **Port binding failures**: Show notification + output log
- **Server startup/shutdown errors**: Show notification + output log
- **Request processing errors**: Output log only

#### 8.1.2 Storage Errors
- **Read/write failures**: Show notification + output log
- **Quota exceeded**: Show notification with cleanup suggestion
- **Corrupted data**: Show notification + attempt recovery

#### 8.1.3 Malformed Requests
- **Invalid HTTP**: Log to output panel only
- **Unsupported methods**: Return 404, log to output panel
- **Parsing errors**: Include in log view with error indicator

### 8.2 Error Logging
```typescript
interface ErrorLogger {
  logToOutput(level: 'info' | 'warn' | 'error', message: string): void;
  showNotification(level: 'info' | 'warn' | 'error', message: string): void;
  logMalformedRequest(request: any, error: string): void;
}
```

## 9. Commands and Keybindings

### 9.1 Command Registration
```json
{
  "commands": [
    {
      "command": "webhookTool.startServer",
      "title": "Start Webhook Server",
      "category": "Webhook Tool"
    },
    {
      "command": "webhookTool.stopServer",
      "title": "Stop Webhook Server",
      "category": "Webhook Tool"
    },
    {
      "command": "webhookTool.toggleServer",
      "title": "Toggle Webhook Server",
      "category": "Webhook Tool"
    },
    {
      "command": "webhookTool.openLogPanel",
      "title": "Open Webhook Log",
      "category": "Webhook Tool"
    },
    {
      "command": "webhookTool.openSidebar",
      "title": "Open Webhook Sidebar",
      "category": "Webhook Tool"
    },
    {
      "command": "webhookTool.openRequestDetails",
      "title": "Open Request Details",
      "category": "Webhook Tool"
    },
    {
      "command": "webhookTool.deleteRequest",
      "title": "Delete Request",
      "category": "Webhook Tool"
    }
  ]
}
```

### 9.2 Default Keybindings
```json
{
  "keybindings": [
    {
      "command": "webhookTool.openRequestDetails",
      "key": "enter",
      "when": "view == webhookTool.logView && viewItem == requestItem"
    },
    {
      "command": "webhookTool.deleteRequest",
      "key": "delete",
      "when": "view == webhookTool.logView && viewItem == requestItem"
    }
  ]
}
```

## 10. Security Considerations

### 10.1 Network Security
- Bind only to localhost (127.0.0.1) by default
- No authentication required (development tool)
- Request size limits to prevent DoS

### 10.2 Data Security
- Sanitize file paths in storage operations
- Validate JSON parsing to prevent code injection
- Limit request body size (default: 10MB)

### 10.3 Input Validation
```typescript
const REQUEST_VALIDATION = {
  maxBodySize: 10 * 1024 * 1024, // 10MB
  maxHeaderSize: 8192, // 8KB
  allowedMethods: ['POST', 'PUT'],
  maxPathLength: 2048
};
```

## 11. Performance Requirements

### 11.1 Response Times
- Server startup: < 2 seconds
- Request processing: < 100ms
- UI refresh: < 500ms
- Storage operations: < 1 second

### 11.2 Resource Usage
- Memory usage: < 50MB for 100 stored requests
- CPU usage: Minimal when idle
- Storage space: ~1KB per average request

## 12. Testing Strategy

### 12.1 Unit Tests
```typescript
// Test suites to implement
describe('WebhookServer', () => {
  // Port binding and server lifecycle
  // Request handling and routing
  // Error conditions and recovery
});

describe('RequestStorage', () => {
  // CRUD operations
  // Size limit enforcement
  // Data persistence and recovery
});

describe('UIProviders', () => {
  // Tree view updates
  // Webview content generation
  // Command handling
});
```

### 12.2 Integration Tests
- Full request flow (HTTP → storage → UI)
- Configuration changes and server restart
- Error scenarios and user notifications
- Extension activation/deactivation

### 12.3 Manual Testing Checklist
- [ ] Server starts/stops correctly
- [ ] Status bar updates reflect server state
- [ ] Requests appear in log view immediately
- [ ] Request details display correctly formatted content
- [ ] Configuration changes take effect
- [ ] Cleanup maintains size limits
- [ ] Error handling shows appropriate messages
- [ ] Extension works across VS Code restart

### 12.4 Test Tools and Utilities
```bash
# HTTP testing
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Load testing
for i in {1..150}; do
  curl -X POST http://localhost:3000/test/$i \
    -d "Request $i" &
done
```

## 13. Development Phases

### 13.1 Phase 1: Core Infrastructure
- Basic extension setup and activation
- HTTP server implementation
- Basic request storage
- Status bar integration

### 13.2 Phase 2: UI Implementation
- Sidebar panel
- Log view provider
- Basic request details webview
- Command registration

### 13.3 Phase 3: Advanced Features
- Syntax highlighting integration
- Configuration management
- Error handling and logging
- Request management (delete, cleanup)

### 13.4 Phase 4: Polish and Testing
- Comprehensive testing
- Documentation
- Performance optimization
- Edge case handling

## 14. Deployment and Distribution

### 14.1 Packaging
- Use `vsce` for extension packaging
- Include all necessary dependencies
- Optimize bundle size

### 14.2 Installation
- VS Code Marketplace publication
- Manual installation via VSIX
- Development installation from source

This specification provides a complete blueprint for implementing the VS Code Webhook Extension. All major components, interfaces, and requirements are defined to enable immediate development start.
