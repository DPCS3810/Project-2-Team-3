import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { JwtUserPayload } from "../modules/auth/auth.types";
import { requireDocumentAccess } from "../modules/documents/documents.service";
import { PermissionRole } from "@prisma/client";
import { loadDocumentState, applyUserOperations } from "./collab.service";
import { TextOperation } from "./ot";
import { HttpError } from "../utils/errors";

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

function authenticateSocket(token?: string): JwtUserPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  if (!token) {
    throw new Error("Unauthorized");
  }
  const decoded = jwt.verify(token, secret) as JwtUserPayload;
  if (!decoded?.id || !decoded?.email) {
    throw new Error("Unauthorized");
  }
  return decoded;
}

function roomName(documentId: string) {
  return `doc:${documentId}`;
}

export function registerCollabHandlers(io: SocketIOServer) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      const user = authenticateSocket(token);
      socket.data.user = user;
      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as JwtUserPayload | undefined;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.on("join_document", async (payload: { documentId: string }) => {
      const { documentId } = payload || {};
      if (!documentId) return;

      try {
        await requireDocumentAccess(user.id, documentId, PermissionRole.VIEW);
        const { content, version } = await loadDocumentState(documentId);
        const room = roomName(documentId);
        await socket.join(room);
        socket.emit("initial_state", { documentId, content, version });
        socket.to(room).emit("presence", {
          documentId,
          userId: user.id,
          email: user.email,
          status: "joined",
        });
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 500;
        socket.emit("error", { status, message: (error as Error).message });
      }
    });

    socket.on("leave_document", async (payload: { documentId: string }) => {
      const { documentId } = payload || {};
      if (!documentId) return;
      const room = roomName(documentId);
      await socket.leave(room);
      socket.to(room).emit("presence", {
        documentId,
        userId: user.id,
        email: user.email,
        status: "left",
      });
    });

    socket.on("cursor_update", (payload: { documentId: string; cursorPosition: number }) => {
      const { documentId, cursorPosition } = payload || {};
      if (!documentId) return;
      const room = roomName(documentId);
      socket.to(room).emit("cursor_update", {
        documentId,
        userId: user.id,
        email: user.email,
        cursorPosition,
        selectionStart: (payload as any).selectionStart,
        selectionEnd: (payload as any).selectionEnd,
      });
    });

    socket.on(
      "op",
      async (payload: { documentId: string; baseVersion: number; operations: TextOperation[] }) => {
        const { documentId, baseVersion, operations } = payload || {};
        if (!documentId || !Array.isArray(operations)) return;
        try {
          await requireDocumentAccess(user.id, documentId, PermissionRole.EDIT);
          const { operations: transformed, version } = await applyUserOperations({
            userId: user.id,
            documentId,
            baseVersion,
            operations,
          });
          const room = roomName(documentId);
          io.to(room).emit("op_applied", {
            documentId,
            userId: user.id,
            operations: transformed,
            version,
          });
        } catch (error) {
          const status = error instanceof HttpError ? error.status : 500;
          socket.emit("error", { status, message: (error as Error).message });
        }
      },
    );

    socket.on("disconnect", () => {
      socket.rooms.forEach((room) => {
        if (room.startsWith("doc:")) {
          socket.to(room).emit("presence", {
            documentId: room.split(":")[1],
            userId: user.id,
            email: user.email,
            status: "left",
          });
        }
      });
    });
  });
}

export const socketCorsOptions = {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
  },
};
