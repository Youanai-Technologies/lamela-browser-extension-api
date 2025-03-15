import { WebSocketServer } from '@/services/WebSocketServer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const SESSION_TIMEOUT = process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) : 30000;

// Create and start the WebSocket server
const server = new WebSocketServer(PORT, SESSION_TIMEOUT);
server.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.stop();
  process.exit(0);
});
