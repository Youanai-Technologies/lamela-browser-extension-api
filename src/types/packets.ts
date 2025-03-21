/**
 * Packet type definitions for WebSocket communication
 */

/**
 * Enum of all possible packet types
 */
export enum PacketType {
  INIT = 'INIT',
  EXIT = 'EXIT',
  PING = 'PING',
  PONG = 'PONG',
  ERROR = 'ERROR',
  COMMAND = 'COMMAND',
  COMMAND_RESULT = 'COMMAND_RESULT',
}

/**
 * Enum of command types for web scraping
 */
export enum CommandType {
  // Navigation commands
  GOTO = 'goto',
  RELOAD = 'reload',
  BACK = 'back',
  FORWARD = 'forward',

  // Content interaction commands
  CLICK = 'click',
  TYPE = 'type',
  SELECT = 'select',
  HOVER = 'hover',
  FOCUS = 'focus',

  // Content extraction commands
  SCREENSHOT = 'screenshot',
  PDF = 'pdf',
  GET_TEXT = 'getText',
  GET_HTML = 'getHtml',
  GET_ATTRIBUTE = 'getAttribute',
  EVALUATE = 'evaluate',

  // Wait commands
  WAIT_FOR_SELECTOR = 'waitForSelector',
  WAIT_FOR_NAVIGATION = 'waitForNavigation',
  WAIT_FOR_TIMEOUT = 'waitForTimeout',

  // Browser control commands
  EXIT = 'exit',
}

/**
 * Base interface for all packets
 */
export interface Packet {
  type: PacketType;
  data: Record<string, any>;
}

/**
 * Initialization packet sent by browser extensions
 */
export interface InitPacket extends Packet {
  type: PacketType.INIT;
  data: {
    accessCode: string;
    userAgent: string;
  };
}

/**
 * Exit packet sent when browser extension is closing
 */
export interface ExitPacket extends Packet {
  type: PacketType.EXIT;
  data: {
    accessCode: string;
  };
}

/**
 * Ping packet for keeping connection alive
 */
export interface PingPacket extends Packet {
  type: PacketType.PING;
  data: {
    accessCode: string;
    timestamp: number;
  };
}

/**
 * Pong response to ping packets
 */
export interface PongPacket extends Packet {
  type: PacketType.PONG;
  data: {
    accessCode: string;
    timestamp: number;
    serverTime: number;
  };
}


/**
 * Command packet for web scraping operations
 */
export interface CommandPacket extends Packet {
  type: PacketType.COMMAND;
  data: {
    accessCode: string;
    commandId: string;
    command: CommandType;
    params: Record<string, any>;
    timestamp: number;
  };
}

/**
 * Command result packet with operation results
 */
export interface CommandResultPacket extends Packet {
  type: PacketType.COMMAND_RESULT;
  data: {
    accessCode: string;
    commandId: string;
    success: boolean;
    result?: any;
    error?: string;
    timestamp: number;
  };
}

/**
 * Error packet for communicating errors
 */
export interface ErrorPacket extends Packet {
  type: PacketType.ERROR;
  data: {
    accessCode: string;
    code: string;
    message: string;
  };
}

/**
 * Union type of all possible packets
 */
export type AnyPacket =
  | InitPacket
  | ExitPacket
  | PingPacket
  | PongPacket
  | CommandPacket
  | CommandResultPacket
  | ErrorPacket; 
