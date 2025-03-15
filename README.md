# TypeScript WebSocket Example

A simple TypeScript WebSocket server and client implementation using the `ws` package.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Usage

1. Start the WebSocket server:

```bash
npm run start:server
```

2. In a separate terminal, start the client:

```bash
npm run start:client
```

## Development

To run the server with hot-reload during development:

```bash
npm run dev
```

## Build

To compile TypeScript to JavaScript:

```bash
npm run build
```

The compiled files will be available in the `dist` directory.

## Project Structure

- `src/server.ts` - WebSocket server implementation
- `src/client.ts` - WebSocket client implementation
- `dist/` - Compiled JavaScript files
