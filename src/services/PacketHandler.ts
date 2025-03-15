import { prisma } from '@/lib/prisma';
import { SessionManager } from '@/services/SessionManager';
import {
  AnyPacket,
  ErrorPacket,
  ExitPacket,
  InitPacket,
  PacketType,
  PingPacket,
  PongPacket
} from '@/types/packets';
import { WebSocket } from 'ws';

/**
 * PacketHandler processes different types of packets
 */
export class PacketHandler {
  private sessionManager: SessionManager;

  /**
   * Create a new PacketHandler
   * @param sessionManager Session manager instance
   */
  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Handle an incoming packet
   * @param ws WebSocket connection
   * @param packet The packet to handle
   */
  public async handlePacket(ws: WebSocket, packet: AnyPacket): Promise<void> {
    console.log('Received packet:', packet);

    try {
      switch (packet.type) {
        case PacketType.INIT:
          await this.handleInitPacket(ws, packet as InitPacket);
          break;

        case PacketType.EXIT:
          await this.handleExitPacket(ws, packet as ExitPacket);
          break;

        case PacketType.PING:
          await this.handlePingPacket(ws, packet as PingPacket);
          break;

        default:
          this.sendErrorPacket(ws, {
            accessCode: packet.data.accessCode || 'unknown',
            code: 'UNKNOWN_PACKET_TYPE',
            message: `Unknown packet type: ${packet.type}`
          });
          break;
      }
    } catch (error) {
      console.error('Error handling packet:', error);
      this.sendErrorPacket(ws, {
        accessCode: packet.data.accessCode || 'unknown',
        code: 'INTERNAL_ERROR',
        message: (error as Error).message
      });
    }
  }

  /**
   * Handle initialization packet
   * @param ws WebSocket connection
   * @param packet Init packet
   */
  private async handleInitPacket(ws: WebSocket, packet: InitPacket): Promise<void> {
    console.log('Init packet received:', packet);

    const { accessCode, userAgent } = packet.data;

    try {
      // Register the session
      this.sessionManager.registerSession(accessCode, userAgent, ws);

      // Update or create browser record in database
      const browser = await prisma.browsers.findUnique({
        where: { accessCode },
      });

      if (browser) {
        console.log('Updating browser instance:', accessCode);

        await prisma.browsers.update({
          where: { accessCode },
          data: {
            isOnline: true,
            lastOnline: new Date(),
            userAgent,
          },
        });
      } else {
        console.log('Creating new browser instance:', accessCode);

        await prisma.browsers.create({
          data: {
            accessCode,
            userAgent,
            isOnline: true,
            lastOnline: new Date(),
          },
        });
      }

      // Send success response
      ws.send(JSON.stringify({
        type: PacketType.INIT,
        data: {
          success: true,
          accessCode,
          serverTime: Date.now(),
        },
      }));
    } catch (error) {
      console.error('Error handling init packet:', error);

      this.sendErrorPacket(ws, {
        accessCode,
        code: 'INIT_ERROR',
        message: (error as Error).message
      });
    }
  }

  /**
   * Handle exit packet
   * @param ws WebSocket connection
   * @param packet Exit packet
   */
  private async handleExitPacket(ws: WebSocket, packet: ExitPacket): Promise<void> {
    console.log('Exit packet received:', packet);

    const { accessCode } = packet.data;

    try {
      // Remove the session
      await this.sessionManager.removeSession(accessCode);

      // Send success response
      ws.send(JSON.stringify({
        type: PacketType.EXIT,
        data: {
          success: true,
          serverTime: Date.now()
        },
      }));
    } catch (error) {
      console.error('Error handling exit packet:', error);

      this.sendErrorPacket(ws, {
        accessCode,
        code: 'EXIT_ERROR',
        message: (error as Error).message
      });
    }
  }

  /**
   * Handle ping packet
   * @param ws WebSocket connection
   * @param packet Ping packet
   */
  private async handlePingPacket(ws: WebSocket, packet: PingPacket): Promise<void> {
    const { accessCode, timestamp } = packet.data;

    // Update the session's last ping time
    this.sessionManager.updateSessionPing(accessCode);

    // Send pong response
    const pongPacket: PongPacket = {
      type: PacketType.PONG,
      data: {
        accessCode,
        timestamp,
        serverTime: Date.now()
      }
    };

    ws.send(JSON.stringify(pongPacket));
  }

  /**
   * Send an error packet
   * @param ws WebSocket connection
   * @param errorData Error data
   */
  private sendErrorPacket(ws: WebSocket, errorData: { accessCode: string, code: string, message: string }): void {
    const errorPacket: ErrorPacket = {
      type: PacketType.ERROR,
      data: errorData
    };

    ws.send(JSON.stringify(errorPacket));
  }
} 
