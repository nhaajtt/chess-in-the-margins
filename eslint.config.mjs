// Lint rules for every hand-written script. Run: npm run lint
// No plugin and no installed package is needed: the rules are the ones ESLint ships with.
const browser = ["window", "document", "navigator", "location", "history", "localStorage", "sessionStorage", "console", "fetch", "performance",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "queueMicrotask",
  "matchMedia", "getComputedStyle", "innerWidth", "innerHeight", "devicePixelRatio", "addEventListener", "removeEventListener", "dispatchEvent",
  "URL", "URLSearchParams", "Blob", "File", "FileReader", "Image", "Audio", "AudioContext", "OffscreenCanvas", "Path2D", "DOMParser", "XMLSerializer",
  "WebSocket", "Worker", "AbortController", "ResizeObserver", "IntersectionObserver", "MutationObserver", "CustomEvent", "Event", "KeyboardEvent",
  "HTMLElement", "Element", "Node", "SVGElement", "createImageBitmap", "structuredClone", "crypto", "TextEncoder", "TextDecoder", "caches", "self",
  "Response", "Request", "Headers", "atob", "btoa", "alert", "confirm", "screen", "visualViewport", "CSS", "DOMMatrix", "ImageData", "speechSynthesis", "scrollX", "scrollY"];
const page = ["gsap", "rough", "ChessEngine", "Creatures", "Themes", "Sound", "Torch", "Sling", "Weather", "Paper", "Margins", "Thinker", "Look",
  "Matchmaker", "Pgn", "Review", "Openings", "Adventure", "School", "CHESS_PUZZLES"];
const node = ["process", "Buffer", "console", "URL", "URLSearchParams", "fetch", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "WebSocket",
  "AbortController", "AbortSignal", "performance", "structuredClone", "crypto", "TextEncoder", "TextDecoder", "Response", "Request", "Headers", "globalThis",
  "queueMicrotask", "setImmediate", "WebSocketPair", "caches", "Blob", "ReadableStream", "DOMException", "module"];
const names = (list, mode = "readonly") => Object.fromEntries(list.map((n) => [n, mode]));

const rules = {
  "no-undef": "error",
  "no-unused-vars": ["error", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
  "no-dupe-keys": "error", "no-dupe-args": "error", "no-dupe-else-if": "error", "no-duplicate-case": "error", "no-dupe-class-members": "error",
  "no-unreachable": "error", "no-unsafe-finally": "error", "no-unsafe-negation": "error", "no-unsafe-optional-chaining": "error",
  "no-const-assign": "error", "no-func-assign": "error", "no-import-assign": "error", "no-class-assign": "error", "no-ex-assign": "error",
  "no-self-assign": "error", "no-self-compare": "error", "no-compare-neg-zero": "error", "use-isnan": "error", "valid-typeof": "error",
  "no-cond-assign": "error", "no-constant-binary-expression": "error", "no-loss-of-precision": "error", "no-sparse-arrays": "error",
  "no-invalid-regexp": "error", "no-empty-character-class": "error",
  "no-fallthrough": "error", "no-redeclare": "error", "no-shadow-restricted-names": "error", "no-delete-var": "error", "no-debugger": "error",
  "getter-return": "error", "no-setter-return": "error", "no-async-promise-executor": "error", "require-yield": "error", "for-direction": "error",
  "no-eval": "error", "no-implied-eval": "error", "no-new-func": "error", "no-var": "error", "prefer-const": "error", "eqeqeq": ["error", "always", { null: "ignore" }],
};

export default [
  { ignores: ["vendor/**", "server/node_modules/**", "server/.wrangler/**", "graphify-out/**", "shots/**", "media/**", "assets/**"] },
  { files: ["*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...names(browser), ...names(page), importScripts: "readonly" } }, rules },
  { files: ["api/**/*.js", "server/**/*.js", "**/*.mjs"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: names(node) }, rules },
];
