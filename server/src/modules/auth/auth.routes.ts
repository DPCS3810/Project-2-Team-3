import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { prisma } from "../../db/prisma";
import { HttpError } from "../../utils/errors";
import {
  generateToken,
  loginUser,
  registerUser,
} from "./auth.service";
import { JwtUserPayload, LoginRequestBody, RegisterRequestBody } from "./auth.types";

const authRouter = Router();

authRouter.post(
  "/register",
  async (req: Request<unknown, unknown, RegisterRequestBody>, res: Response) => {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password and name are required" });
    }

    try {
      const user = await registerUser(email, password, name);
      const token = generateToken({ id: user.id, email: user.email });
      return res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }
      // eslint-disable-next-line no-console
      console.error("Register error", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

authRouter.post(
  "/login",
  async (req: Request<unknown, unknown, LoginRequestBody>, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    try {
      const user = await loginUser(email, password);
      const token = generateToken({ id: user.id, email: user.email });
      return res.status(200).json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }
      // eslint-disable-next-line no-console
      console.error("Login error", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

authRouter.get("/me", authMiddleware, async (req, res) => {
  const currentUser = req.user as JwtUserPayload | undefined;
  if (!currentUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Me error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { authRouter };
