# Webhook Toolkit Extension for VS Code

## Overview

This document is the initial prompt used for developing this extension. The structure of the prompt is based on Harper Reed's [codegen workflow](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/).

## Initial Prompt

Ask me one question at a time so we can develop a thorough, step-by-step spec for this idea. Each question should build on my previous answers, and our end goal is to have a detailed specification I can hand off to a developer. Let’s do this iteratively and dig into every relevant detail. Remember, only one question at a time.

Here’s the idea:

I want to build a VS Code extension that can be used for developing software that sends to a Webhook. The extension should be able to receive an HTTP connection, record the Headers and Body of the inbound request along with a timestamp and the IP origin of the request. The extension should provide the user with a way of viewing both the headers and the body. Additionally, if the body is of a known content type such as `application/json` it should be able to format and display the body with appropriate syntax highlighting. Lastly, the user should be able to see a log of each received request that includes the timestamp and ip address of origin for each request. The user should be able to open the request details from this log view described above and should be able to delete the request from storage.

This extension's user interface should be as close to appearing native within VS Code.

### Exchange:

**Claude:** What port would you like the extension to listen on by default, and should users be able to configure this port? Also, do you want the extension to automatically find an available port if the default is in use, or should it show an error?

**Eddie:** It should default to port 3000, should be configurable and it should be configurable as to whether or not it should find an available port if the configured port is unavailable.

**Claude:** How do you want users to start and stop the webhook server? Should it automatically start when VS Code opens, require manual activation through a command palette action, or have a button in the extension's UI panel?

**Eddie:** The webhook server should be stopped when VS Code starts, requiring the user to specifically start the webhook server. Further it should shutdown cleanly when VS Code exits. An indicator should be present within the status bar as to whether or not it is running and clicking the indicator should toggle the state of the webhook server.

**Claude:** Where should the extension store the received webhook data? Should it use VS Code's built-in storage APIs (which would persist data across sessions), store data only in memory (lost when VS Code closes), or give users the option to choose between these approaches?

**Eddie:** It should be stored within the workspace's storageUri.

**Claude:** How many webhook requests should the extension retain in storage before automatically removing old ones? Should there be a configurable limit (like keeping the most recent 100 requests), or should it store all requests indefinitely until the user manually deletes them?

**Eddie:** Configurable but default to 100 requests.

**Claude:** What HTTP methods should the webhook server accept? Should it accept all methods (GET, POST, PUT, DELETE, PATCH, etc.) or only specific ones like POST and PUT that are commonly used for webhooks?

**Eddie:** POST and PUT only, with all others returning a 404 error

**Claude:** When the webhook server receives a request, what HTTP status code and response body should it return to the sender? Should this be configurable, or always return the same response (like 200 OK with an empty body or simple acknowledgment message)?

**Eddie:** Response code, headers and body should be configurable. By default it should return 201 with an empty body.

**Claude:** How should the extension's UI be organized within VS Code? Should it be a dedicated sidebar panel, a tab in the existing Explorer/Extensions sidebar, or would you prefer a different approach like using VS Code's webview system for a more custom interface?

**Eddie:** Include a dedicated side bar that includes the ability to start and stop the webhook server. The log view should be a panel and individual request details should utilize a webview.

**Claude:** What level of detail should be shown in the log view panel? Should it display just basic information like timestamp, IP, and HTTP method in a compact list, or include additional details like request size, content type, or a preview of the request body?

**Eddie:** Include timestamp, ip, http method and request path

**Claude:** For the request details webview, how do you want to organize the display of headers and body content? Should they be in separate tabs, collapsible sections, or a split view? Also, should the headers be displayed as a simple list or in a more structured table format?

**Eddie:** A split view, with headers on top and body on bottom. The body view should provide tabs which includes both the pretty formatted view with syntax highlighting as well as a raw view to show how the body was specifically delivered.

**Claude:** What syntax highlighting libraries or approach would you prefer for the formatted body view? Should the extension use VS Code's built-in syntax highlighting capabilities (which would match the user's current theme), or a separate syntax highlighting library like Prism.js or highlight.js?

**Eddie:** Use VS Code's built in syntax highlight capabilities.

**Claude:** What content types beyond `application/json` should the extension recognize and provide syntax highlighting for? Should it support common webhook formats like `application/xml`, `text/xml`, `application/x-www-form-urlencoded`, or others?

**Eddie:** Support common webhook formats.

**Claude:** For the configuration settings, should they be workspace-specific (stored in the current workspace's settings) or user-global settings that apply across all VS Code instances? Also, should users be able to access these settings through VS Code's standard Settings UI, or do you want a custom configuration interface within the extension?

**Eddie:** Workspace or user-global settings as with it defaulting to workspace specific. Yes, it should use VS Code's standard settings UI.

**Claude:** What should happen when the configured request limit is reached? Should the extension automatically delete the oldest requests when new ones arrive (FIFO queue), or should it stop accepting new requests until the user manually clears some space?

**Eddie:** Automatically delete older requests.

**Claude:** For error handling, how should the extension behave when it encounters issues like port binding failures, storage write errors, or malformed requests? Should errors be displayed in VS Code's notification system, logged to the Output panel, or both?

**Eddie:** Errors should be displayed in VS Code's notification system and logged to the output panel. Malformed requests should only be logged to the notification system and not raised to the user through a notification. Malformed requests should appear within the extensions panel log view as well.

**Claude:** Should the extension provide any search or filtering capabilities in the log view? For example, filtering by IP address, HTTP method, date range, or searching within request content?

**Eddie:** For now, let's go with no.

**Claude:** What keyboard shortcuts or command palette commands should the extension register? Should there be shortcuts for common actions like starting/stopping the server, clearing the request log, or opening the extension's sidebar?

**Eddie:** Starting and stopping the server (with no default keys set). Open log panel (no default key), Open Selected log entry (enter key by default), Delete Selected log entry (delete key by default), Open Sidebar (no default key)

**Claude:** Perfect! I think we have a comprehensive specification. Let me summarize what we've defined:

## VS Code Webhook Extension Specification

### Core Functionality

- HTTP server listening for webhook requests (POST and PUT only, others return 404)
- Default port 3000, user-configurable
- Option to auto-find available port if configured port is unavailable
- Records timestamp, headers, body, and IP origin for each request
- Stores data in workspace's storageUri
- Configurable request limit (default: 100, FIFO deletion)

### Server Management

- Server stopped by default on VS Code startup
- Clean shutdown on VS Code exit
- Status bar indicator showing server state
- Click status bar to toggle server on/off
- Configurable response: default 201 with empty body

### UI Organization

- Dedicated sidebar panel with start/stop controls
- Log view panel showing: timestamp, IP, HTTP method, request path
- Request details in webview with split view (headers top, body bottom)
- Body view has tabs: formatted (with VS Code syntax highlighting) + raw
- Supports common webhook content types (JSON, XML, form-urlencoded, etc.)

### Configuration & Error Handling

- Workspace-specific settings (with user-global fallback)
- Standard VS Code Settings UI
- Errors: notifications + output panel
- Malformed requests: output panel + log view only

### Commands

- Start/Stop Server, Open Log Panel, Open Sidebar (no default keys)
- Open Selected Entry (Enter), Delete Selected Entry (Delete)

**Claude:** Does this capture everything correctly, or should we refine any aspects before you hand this off to a developer?

That looks good. Now that we’ve wrapped up the brainstorming process, can you compile our findings into a comprehensive, developer-ready specification? Include all relevant requirements, architecture choices, data handling details, error handling strategies, and a testing plan so a developer can immediately begin implementation.
