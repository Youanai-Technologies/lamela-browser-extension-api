import { prisma } from '@/lib/prisma';
import { WebSocket } from 'ws';

/**
 * Interface representing a browser session
 */
export interface BrowserSession {
  accessCode: string;
  userAgent: string;
  lastPing: number;
  ws: WebSocket;
  timeoutId: NodeJS.Timeout;
}

/**
 * SessionManager handles tracking and managing browser extension sessions
 */
export class SessionManager {
  private static instance: SessionManager;
  private activeSessions: Map<string, BrowserSession>;
  private readonly sessionTimeout: number;

  /**
   * Private constructor to enforce singleton pattern
   * @param sessionTimeout Timeout in milliseconds before marking a session as inactive
   */
  private constructor(sessionTimeout: number = 30000) {
    this.activeSessions = new Map<string, BrowserSession>();
    this.sessionTimeout = sessionTimeout;
    this.startPeriodicCheck();
  }

  /**
   * Get the singleton instance of SessionManager
   */
  public static getInstance(sessionTimeout?: number): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager(sessionTimeout);
    }
    return SessionManager.instance;
  }

  /**
   * Register or update a browser session
   * @param accessCode Unique identifier for the browser
   * @param userAgent Browser user agent string
   * @param ws WebSocket connection
   * @returns The created or updated session
   */
  public registerSession(accessCode: string, userAgent: string, ws: WebSocket): BrowserSession {
    // Clear any existing timeout for this session
    if (this.activeSessions.has(accessCode)) {
      clearTimeout(this.activeSessions.get(accessCode)!.timeoutId);
    }

    // Set up a new timeout
    const timeoutId = setTimeout(async () => {
      await this.markSessionOffline(accessCode);
    }, this.sessionTimeout);

    // Set up message handler for efficient ping/pong
    ws.on('message', (message: string) => {
      // Handle ping messages efficiently
      if (message === 'ping') {
        ws.send('pong');
        this.updateSessionPing(accessCode);
        return;
      }

      // Other message handling continues normally
    });

    // Set up ping handler for WebSocket protocol pings
    ws.on('ping', () => {
      // Update the last ping time when we receive a protocol-level ping
      this.updateSessionPing(accessCode);
    });

    // Create the session object
    const session: BrowserSession = {
      accessCode,
      userAgent,
      lastPing: Date.now(),
      ws,
      timeoutId
    };

    // Store the session
    this.activeSessions.set(accessCode, session);

    return session;
  }

  /**
   * Update the last ping time for a session
   * @param accessCode Unique identifier for the browser
   * @returns True if session was found and updated, false otherwise
   */
  public updateSessionPing(accessCode: string): boolean {
    const session = this.activeSessions.get(accessCode);
    if (!session) {
      return false;
    }

    // Update the last ping time
    session.lastPing = Date.now();

    // Reset the timeout
    clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(async () => {
      await this.markSessionOffline(accessCode);
    }, this.sessionTimeout);

    return true;
  }

  /**
   * Remove a session and mark the browser as offline
   * @param accessCode Unique identifier for the browser
   */
  public async removeSession(accessCode: string): Promise<void> {
    const session = this.activeSessions.get(accessCode);
    if (session) {
      clearTimeout(session.timeoutId);
      this.activeSessions.delete(accessCode);
    }

    await this.markSessionOffline(accessCode);
  }

  /**
   * Get a session by access code
   * @param accessCode Unique identifier for the browser
   * @returns The session or undefined if not found
   */
  public getSession(accessCode: string): BrowserSession | undefined {
    return this.activeSessions.get(accessCode);
  }

  /**
   * Check if a session exists
   * @param accessCode Unique identifier for the browser
   * @returns True if session exists, false otherwise
   */
  public hasSession(accessCode: string): boolean {
    return this.activeSessions.has(accessCode);
  }

  /**
   * Get all active sessions
   * @returns Map of all active sessions
   */
  public getAllSessions(): Map<string, BrowserSession> {
    return this.activeSessions;
  }

  /**
   * Mark a browser as offline
   * @param accessCode Unique identifier for the browser
   */
  private async markSessionOffline(accessCode: string): Promise<void> {
    console.log(`Marking browser ${accessCode} as offline`);

    try {
      await prisma.browsers.update({
        where: { accessCode },
        data: {
          isOnline: false,
          lastOnline: new Date(),
        },
      });
    } catch (error) {
      console.error(`Failed to mark browser ${accessCode} as offline:`, error);
    }

    // Remove from active sessions
    this.activeSessions.delete(accessCode);
  }

  /**
   * Start periodic check for stale sessions
   */
  private startPeriodicCheck(): void {
    setInterval(async () => {
      const now = Date.now();

      for (const [accessCode, session] of this.activeSessions.entries()) {
        // If last ping was more than sessionTimeout ago, mark as offline
        if (now - session.lastPing > this.sessionTimeout) {
          clearTimeout(session.timeoutId);
          await this.markSessionOffline(accessCode);
        } else if (session.ws.readyState === WebSocket.OPEN) {
          // Send a protocol-level ping to keep the connection alive
          try {
            session.ws.ping();
          } catch (error) {
            console.error(`Error pinging session ${accessCode}:`, error);
          }
        }
      }
    }, this.sessionTimeout);
  }
} 
