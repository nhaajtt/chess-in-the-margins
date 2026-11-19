// Globals the checked scripts use. Ones defined in files outside the check are left loose.
declare var gsap: any;
declare var rough: any;
declare var Margins: any;
declare var Thinker: any;
declare var Paper: any;
declare var Look: any;
declare var Weather: any;
declare var Matchmaker: any;
declare var Pgn: any;
declare var Openings: any;
declare var Creatures: any;
declare var Themes: any;
declare var Sound: any;
declare var ChessEngine: any;
declare function importScripts(...urls: string[]): void;

interface Window {
  [key: string]: any;
}

// Cloudflare Workers pieces used by server/src/index.js
declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}
interface ResponseInit {
  webSocket?: WebSocket | null;
}
interface WebSocket {
  serializeAttachment(value: any): void;
  deserializeAttachment(): any;
}
