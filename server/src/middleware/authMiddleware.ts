import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JwtUserPayload } from "../modules/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!JWT_SECRET) {
    // eslint-disable-next-line no-console
    console.error("JWT_SECRET is not configured");
    return res.status(500).json({ error: "Internal server error" });
  }

  const token = authHeader.substring("Bearer ".length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtUserPayload;
    if (!decoded || !decoded.id || !decoded.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { id: decoded.id, email: decoded.email };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
