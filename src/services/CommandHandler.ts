import { BrowserSession, SessionManager } from '@/services/SessionManager';
import { CommandPacket, CommandResultPacket, CommandType, PacketType } from '@/types/packets';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';

/**
 * CommandHandler processes web scraping commands and routes them to browser extensions
 */
export class CommandHandler {
  private sessionManager: SessionManager;
  private pendingCommands: Map<string, { accessCode: string, timestamp: number }>;
  private commandTimeoutMs: number;

  /**
   * Create a new CommandHandler
   * @param sessionManager Session manager instance
   * @param commandTimeoutMs Timeout for commands in milliseconds (default: 30000)
   */
  constructor(sessionManager: SessionManager, commandTimeoutMs: number = 30000) {
    this.sessionManager = sessionManager;
    this.pendingCommands = new Map();
    this.commandTimeoutMs = commandTimeoutMs;
  }

  /**
   * Process a message from a browser extension
   * @param ws WebSocket connection
   * @param message The raw message from the extension
   * @returns True if the message was processed, false otherwise
   */
  public async processExtensionMessage(ws: WebSocket, message: string): Promise<boolean> {
    // Handle ping messages efficiently
    if (message === 'ping') {
      ws.send('pong');
      return true;
    }

    try {
      // Try to parse as JSON
      const packet = JSON.parse(message);

      // Handle command results
      if (packet.type === PacketType.COMMAND_RESULT) {
        await this.handleCommandResult(ws, packet);
        return true;
      }

      // Other packet types can be handled here

      return false;
    } catch (error) {
      // Not JSON or other error
      return false;
    }
  }

  /**
   * Process a command from the main app
   * @param message The raw message from the main app
   * @returns True if the message was processed as a command, false otherwise
   */
  public async processMainAppCommand(message: string): Promise<boolean> {
    // Check if the message is a command from the main app
    if (!message.startsWith('main:')) {
      return false;
    }

    const commandString = message.substring(5); // Remove 'main:' prefix

    try {
      if (commandString === 'exit') {
        // Handle exit command
        console.log('Received exit command from main app');
        // Broadcast exit command to all connected extensions
        this.broadcastExitCommand();
        return true;
      }

      if (commandString === 'listBrowsers') {
        // Handle listBrowsers command
        console.log('Received listBrowsers command from main app');
        await this.sendBrowserList();
        return true;
      }

      // Parse the command
      const commandParts = commandString.split(' ');
      const command = commandParts[0];

      // Validate command
      if (!Object.values(CommandType).includes(command as CommandType)) {
        console.error(`Unknown command: ${command}`);
        return false;
      }

      // Parse parameters (format: key=value)
      const params: Record<string, any> = {};
      for (let i = 1; i < commandParts.length; i++) {
        const paramPart = commandParts[i];
        const [key, value] = paramPart.split('=');
        if (key && value) {
          // Try to parse as number or boolean if possible
          if (value === 'true') {
            params[key] = true;
          } else if (value === 'false') {
            params[key] = false;
          } else if (!isNaN(Number(value))) {
            params[key] = Number(value);
          } else {
            params[key] = value;
          }
        }
      }

      // Get target browser (if specified)
      const targetBrowser = params.browser;
      if (targetBrowser) {
        delete params.browser; // Remove from params
        await this.sendCommandToBrowser(targetBrowser, command as CommandType, params);
      } else {
        // Send to all browsers
        await this.broadcastCommand(command as CommandType, params);
      }

      return true;
    } catch (error) {
      console.error('Error processing main app command:', error);
      return false;
    }
  }

  /**
   * Send a command to a specific browser
   * @param accessCode Browser access code
   * @param command Command type
   * @param params Command parameters
   */
  private async sendCommandToBrowser(
    accessCode: string,
    command: CommandType,
    params: Record<string, any>
  ): Promise<void> {
    const session = this.sessionManager.getSession(accessCode);
    if (!session) {
      console.error(`Browser with access code ${accessCode} not found`);
      return;
    }

    const commandId = uuidv4();
    const timestamp = Date.now();

    // Create command packet
    const commandPacket: CommandPacket = {
      type: PacketType.COMMAND,
      data: {
        accessCode,
        commandId,
        command,
        params,
        timestamp
      }
    };

    // Store pending command
    this.pendingCommands.set(commandId, {
      accessCode,
      timestamp
    });

    // Set timeout for command
    setTimeout(() => {
      if (this.pendingCommands.has(commandId)) {
        console.error(`Command ${commandId} timed out`);
        this.pendingCommands.delete(commandId);
      }
    }, this.commandTimeoutMs);

    // Send command to browser
    session.ws.send(JSON.stringify(commandPacket));
    console.log(`Sent command ${command} to browser ${accessCode}`);
  }

  /**
   * Broadcast a command to all connected browsers
   * @param command Command type
   * @param params Command parameters
   */
  private async broadcastCommand(command: CommandType, params: Record<string, any>): Promise<void> {
    const sessions = this.sessionManager.getAllSessions();

    for (const [accessCode, session] of sessions.entries()) {
      await this.sendCommandToBrowser(accessCode, command, params);
    }
  }

  /**
   * Broadcast exit command to all connected browsers
   */
  private broadcastExitCommand(): void {
    const sessions = this.sessionManager.getAllSessions();

    for (const [accessCode, session] of sessions.entries()) {
      this.sendCommandToBrowser(accessCode, CommandType.EXIT, {});
    }
  }

  /**
   * Handle command result from a browser
   * @param ws WebSocket connection
   * @param packet Command result packet
   */
  public async handleCommandResult(ws: WebSocket, packet: CommandResultPacket): Promise<void> {
    const { commandId, accessCode, success, result, error } = packet.data;

    // Check if command is pending
    if (!this.pendingCommands.has(commandId)) {
      console.warn(`Received result for unknown command ${commandId}`);
      return;
    }

    // Remove from pending commands
    this.pendingCommands.delete(commandId);

    // Log result
    if (success) {
      console.log(`Command ${commandId} completed successfully:`, result);
    } else {
      console.error(`Command ${commandId} failed:`, error);
    }

    // Here you could forward the result to the main app or store it
  }

  /**
   * Send the list of connected browsers to the main app
   */
  private async sendBrowserList(): Promise<void> {
    const sessions = this.sessionManager.getAllSessions();
    const browsers = Array.from(sessions.entries()).map(([accessCode, session]: [string, BrowserSession]) => {
      return {
        accessCode,
        userAgent: session.userAgent,
        lastPing: session.lastPing
      };
    });

    // Send browser list to the main app
    const mainAppWs = this.getMainAppWebSocket();
    if (mainAppWs) {
      mainAppWs.send(JSON.stringify({
        type: 'BROWSER_LIST',
        data: {
          browsers,
          timestamp: Date.now()
        }
      }));
    }
  }

  /**
   * Get the WebSocket connection to the main app
   * @returns The WebSocket connection or null if not found
   */
  private getMainAppWebSocket(): WebSocket | null {
    // This is a simplified implementation
    // In a real application, you would track the main app's WebSocket connection
    // For now, we'll just use the first session's WebSocket
    const sessions = this.sessionManager.getAllSessions();
    if (sessions.size > 0) {
      const firstSession = sessions.values().next().value;
      return firstSession?.ws || null;
    }
    return null;
  }
} 
