import "dotenv/config";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { app } from "./app";
import { registerCollabHandlers, socketCorsOptions } from "./collab/collab.gateway";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const server = http.createServer(app);
const io = new SocketIOServer(server, socketCorsOptions);

registerCollabHandlers(io);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});
