# Webhook Toolkit Extension

This is a Visual Studio Code extension for developing with webhooks. It provides tools and features to streamline the process of working with webhooks in your projects.

## Features

### Webhook Log Panel
- View captured webhook requests in VS Code's bottom panel area
- Real-time updates when new requests arrive
- Sort by timestamp (newest first)
- Context menu actions: Open Details, Delete Request
- Keybindings: Enter to view details, Delete to remove
- Different icons for POST vs PUT requests

## Development

### Building the Extension

```bash
npm install
npm run build
```

### Testing the Extension

```bash
npm test
```

### Running the Extension

1. Open this project in VS Code
2. Press `F5` or use Run > Start Debugging
3. This will open a new Extension Development Host window
4. In the new window, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
5. Type "Test Webhook Extension" and run the command
6. You should see a message "Webhook Extension is working!"

## Development Note

This project is being done specifically to experiment with agentic coding. It may turn out horrible, but hopefully it'll be fun.

