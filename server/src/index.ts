import "dotenv/config";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { app } from "./app";
import { registerCollabHandlers, socketCorsOptions } from "./collab/collab.gateway";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const server = http.createServer(app);
const io = new SocketIOServer(server, socketCorsOptions);

registerCollabHandlers(io);

const wss = new WebSocketServer({ server, path: "/yjs" });
wss.on("connection", (conn, req) => {
  const url = req.url || "";
  const docName = url.replace("/yjs", "").replace(/^\/+/, "") || "default";
  setupWSConnection(conn, req, { docName });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});
