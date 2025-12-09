import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma";
import { HttpError } from "../../utils/errors";
import { JwtUserPayload } from "./auth.types";

const JWT_SECRET = process.env.JWT_SECRET;

function ensureSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return JWT_SECRET;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new HttpError(401, "Invalid credentials");
  }

  return user;
}

export function generateToken(user: JwtUserPayload): string {
  const secret = ensureSecret();
  return jwt.sign({ id: user.id, email: user.email }, secret, {
    expiresIn: "7d",
  });
}
