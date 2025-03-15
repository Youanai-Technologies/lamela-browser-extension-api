# Browser Extension WebSocket API

- A simple TypeScript WebSocket server and client implementation using the `ws` package.

* A WebSocket server that acts as a gateway between a main application and browser extensions, enabling real-time communication and web scraping capabilities.

## Overview

This project provides a robust WebSocket server that:

1. Manages connections from browser extensions
2. Tracks extension online/offline status
3. Processes commands from the main application
4. Routes web scraping commands to connected extensions
5. Handles results from extension operations

The server is built with TypeScript, WebSockets (ws), Prisma ORM, and follows a modular architecture for maintainability.

## Features

### Connection Management

- Automatic tracking of connected browser extensions
- Session timeout detection (marks extensions as offline after 30 seconds of inactivity)
- Graceful handling of disconnections
- Extension will be marked as offline if it doesn't send a PING packet for 30 seconds

### Database Integration

- Stores browser extension information in PostgreSQL database
- Tracks online/offline status of extensions
- Records user agent and last seen timestamps

### Command Processing

- Processes commands from the main application with "main:" prefix
- Routes commands to specific or all connected extensions
- Supports Puppeteer-like syntax for web scraping operations
- Command timeout handling

### Web Scraping Capabilities

- Navigation: goto, reload, back, forward
- Content interaction: click, type, select, hover, focus
- Content extraction: screenshot, PDF, getText, getHTML, getAttribute, evaluate
- Wait operations: waitForSelector, waitForNavigation, waitForTimeout
- Browser control: exit

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

- PostgreSQL database

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

```
npx prisma generate
```

## Environment Variables

Create a `.env` file with:

```
DATABASE_URL="postgresql://username:password@localhost:5432/database"
PORT=8080
SESSION_TIMEOUT=30000
```

## Usage

1. Start the WebSocket server:

```bash
npm run start:server
```

2. For development with hot-reload:

```bash
npm run dev
```

## Project Structure

```bash
src/
├── lib/
│ └── prisma.ts # Prisma client setup
├── services/
│ ├── CommandHandler.ts # Handles web scraping commands
│ ├── PacketHandler.ts # Processes different packet types
│ ├── SessionManager.ts # Manages browser extension sessions
│ └── WebSocketServer.ts # Main WebSocket server
├── types/
│ └── packets.ts # Packet type definitions
└── server.ts # Entry point

```

# Packet Types

The server uses a structured packet system for communication:

- **INIT**: Sent by extensions when connecting
- **EXIT**: Sent by extensions when disconnecting
- **PING/PONG**: For connection health checks
- **COMMAND**: Web scraping commands sent to extensions
- **COMMAND_RESULT**: Results from web scraping operations
- **ERROR**: Error messages

## Command Format

Commands from the main application follow this format:

```
main:<command> <param1>=<value1> <param2>=<value2>
```

Example:

```
main:goto url=https://example.com
main:click selector=#submit-button
main:getText selector=.article-content

```

To target a specific browser:

```
main:goto browser=abc123 url=https://example.com
main:click selector=#submit-button
main:getText selector=.article-content
```

To target a specific browser:

```
main:goto browser=abc123 url=https://example.com
```

## Database Schema

- The server uses the `Browsers` table to track extension instances:

```prisma
model Browsers {
  id Int @id @default(autoincrement())
  accessCode String @unique @db.VarChar(255)
  userAgent String
  createdat DateTime @default(now()) @db.Timestamp(6)
  isOnline Boolean @default(false)
  lastOnline DateTime @default(now()) @db.Timestamp(6)
}
```

## Build

```bash
npm run build
```

The compiled files will be available in the `dist` directory.

## Project Structure

- - `src/server.ts` - WebSocket server implementation
- - `src/client.ts` - WebSocket client implementation
- - `dist/` - Compiled JavaScript files

## Extension Integration

Browser extensions should:

1. Connect to the WebSocket server
2. Send an INIT packet with accessCode and userAgent
3. Process COMMAND packets and execute web scraping operations
4. Send COMMAND_RESULT packets with operation results
5. Send PING packets periodically to maintain connection
6. Send EXIT packet when closing

## Main Application Integration

The main application should:

1. Send commands with "main:" prefix
2. Format commands using Puppeteer-like syntax
3. Include parameters as key=value pairs
4. Specify target browser with `browser=accessCode` parameter (optional)
