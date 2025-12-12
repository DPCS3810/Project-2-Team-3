import express, { Application, Request, Response } from "express";
import cors from "cors";
import { prisma } from "./db/prisma";
import { authRouter } from "./modules/auth/auth.routes";
import { documentsRouter } from "./modules/documents/documents.routes";
import { commentsRouter } from "./modules/comments/comments.routes";
import { authMiddleware } from "./middleware/authMiddleware";

const app: Application = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/debug/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to fetch users", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.use("/auth", authRouter);
app.use("/documents/:id/comments", commentsRouter);
app.use("/documents", authMiddleware, documentsRouter);

export { app };
