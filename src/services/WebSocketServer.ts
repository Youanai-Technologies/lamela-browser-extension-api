import { CommandHandler } from '@/services/CommandHandler';
import { PacketHandler } from '@/services/PacketHandler';
import { SessionManager } from '@/services/SessionManager';
import { AnyPacket } from '@/types/packets';
import { WebSocket, WebSocketServer as WSServer } from 'ws';

/**
 * WebSocketServer manages WebSocket connections and delegates packet handling
 */
export class WebSocketServer {
  private wss: WSServer;
  private sessionManager: SessionManager;
  private packetHandler: PacketHandler;
  private commandHandler: CommandHandler;
  private port: number;

  /**
   * Create a new WebSocketServer
   * @param port Port to listen on
   * @param sessionTimeout Timeout in milliseconds before marking a session as inactive
   */
  constructor(port: number = 8080, sessionTimeout: number = 30000) {
    this.port = port;
    this.sessionManager = SessionManager.getInstance(sessionTimeout);
    this.packetHandler = new PacketHandler(this.sessionManager);
    this.commandHandler = new CommandHandler(this.sessionManager);
    this.wss = new WSServer({ port });
  }

  /**
   * Start the WebSocket server
   */
  public start(): void {
    this.setupEventHandlers();
    console.log(`WebSocket server is running on ws://localhost:${this.port}`);
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');

      // Set up message handler
      ws.on('message', async (message: string) => {
        const messageStr = message.toString();

        // Handle text-based ping messages
        if (messageStr === 'ping') {
          ws.send('pong');
          return;
        }

        // Handle command messages from main app
        if (messageStr.startsWith('main:')) {
          const processed = await this.commandHandler.processMainAppCommand(messageStr);
          if (processed) {
            return;
          }
        }

        // Try to process as extension message (including ping/pong)
        const processedByExtension = await this.commandHandler.processExtensionMessage(ws, messageStr);
        if (processedByExtension) {
          return;
        }

        // Try to process as JSON packet
        try {
          const packet = JSON.parse(messageStr) as AnyPacket;
          await this.packetHandler.handlePacket(ws, packet);
        } catch (error) {
          console.error('Error processing message:', error);

          ws.send(JSON.stringify({
            type: 'ERROR',
            data: {
              accessCode: 'system',
              code: 'INVALID_FORMAT',
              message: `Error processing message: ${(error as Error).message}`
            }
          }));
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log('Client disconnected');
        // Session cleanup is handled by the SessionManager
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  /**
   * Stop the WebSocket server
   */
  public stop(): void {
    this.wss.close(() => {
      console.log('WebSocket server stopped');
    });
  }
} 
