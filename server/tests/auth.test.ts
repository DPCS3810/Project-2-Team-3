import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/db/prisma";

const AUTH_EMAIL_PREFIX = "test-auth-";

async function cleanAuthUsers() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: AUTH_EMAIL_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const documents = await prisma.document.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const documentIds = documents.map((d) => d.id);

  await prisma.permission.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.version.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.opLog.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
  await prisma.permission.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe("Auth routes", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanAuthUsers();
  });

  afterAll(async () => {
    await cleanAuthUsers();
    await prisma.$disconnect();
  });

  it("registers a new user and returns a token", async () => {
    const email = `${AUTH_EMAIL_PREFIX}${Date.now()}@example.com`;
    const res = await request(app)
      .post("/auth/register")
      .send({ email, password: "password123", name: "Test User" })
      .expect(201);

    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);

    const userInDb = await prisma.user.findUnique({ where: { email } });
    expect(userInDb).not.toBeNull();
  });

  it("prevents registering with duplicate email", async () => {
    const email = `${AUTH_EMAIL_PREFIX}${Date.now()}@example.com`;

    await request(app)
      .post("/auth/register")
      .send({ email, password: "password123", name: "Test User" })
      .expect(201);

    const res = await request(app)
      .post("/auth/register")
      .send({ email, password: "password123", name: "Test User" })
      .expect(409);

    expect(res.body.error).toBeDefined();
  });

  it("logs in with correct credentials and returns a token", async () => {
    const email = `${AUTH_EMAIL_PREFIX}${Date.now()}@example.com`;
    const password = "password123";

    await request(app)
      .post("/auth/register")
      .send({ email, password, name: "Test User" })
      .expect(201);

    const res = await request(app)
      .post("/auth/login")
      .send({ email, password })
      .expect(200);

    expect(res.body.token).toBeDefined();
  });

  it("rejects login with wrong password", async () => {
    const email = `${AUTH_EMAIL_PREFIX}${Date.now()}@example.com`;
    const password = "password123";

    await request(app)
      .post("/auth/register")
      .send({ email, password, name: "Test User" })
      .expect(201);

    await request(app)
      .post("/auth/login")
      .send({ email, password: "wrongpassword" })
      .expect(401);
  });

  it("GET /auth/me returns current user when token is provided", async () => {
    const email = `${AUTH_EMAIL_PREFIX}${Date.now()}@example.com`;
    const password = "password123";

    const registerRes = await request(app)
      .post("/auth/register")
      .send({ email, password, name: "Test User" })
      .expect(201);

    const token = registerRes.body.token as string;

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.user.email).toBe(email);
  });
});
