// Preload script runs in an isolated context before the renderer.
// Keep it minimal — only expose APIs the renderer actually needs.
// For this app, getUserMedia works via the standard Web API so no
// Node.js bridging is required here.
