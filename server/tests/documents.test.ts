import request from "supertest";
import { PermissionRole } from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/db/prisma";

const DOC_EMAIL_PREFIX = "test-doc-";

async function cleanDocumentsData() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: DOC_EMAIL_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { ownerId: { in: userIds } },
        { permissions: { some: { userId: { in: userIds } } } },
      ],
    },
    select: { id: true },
  });

  const documentIds = documents.map((d) => d.id);

  await prisma.permission.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.permission.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.version.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.opLog.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function registerUser(label: string) {
  const email = `${DOC_EMAIL_PREFIX}${label}-${Date.now()}@example.com`;
  const res = await request(app)
    .post("/auth/register")
    .send({ email, password: "password123", name: `User ${label}` })
    .expect(201);

  return {
    token: res.body.token as string,
    user: res.body.user as { id: string; email: string; name: string },
  };
}

describe("Documents routes", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanDocumentsData();
  });

  afterAll(async () => {
    await cleanDocumentsData();
    await prisma.$disconnect();
  });

  it("allows an authenticated user to create a document", async () => {
    const owner = await registerUser("owner-create");

    const res = await request(app)
      .post("/documents")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "My Document", description: "Test doc" })
      .expect(201);

    expect(res.body.document).toBeDefined();
    expect(res.body.document.ownerId).toBe(owner.user.id);
  });

  it("lists documents accessible to the user", async () => {
    const owner = await registerUser("owner-list");

    const createRes = await request(app)
      .post("/documents")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Listable Document" })
      .expect(201);

    const docId = createRes.body.document.id as string;
    expect(docId).toBeDefined();

    const listRes = await request(app)
      .get("/documents")
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    const found = (listRes.body.documents as Array<{ id: string }>).find(
      (doc) => doc.id === docId,
    );
    expect(found).toBeDefined();
  });

  it("enforces permissions for view vs edit and allows upgrade", async () => {
    const owner = await registerUser("owner-perm");
    const collaborator = await registerUser("collaborator");

    const createRes = await request(app)
      .post("/documents")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Shared Doc" })
      .expect(201);

    const docId = createRes.body.document.id as string;

    await request(app)
      .post(`/documents/${docId}/permissions`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: collaborator.user.id, role: PermissionRole.VIEW })
      .expect(200);

    await request(app)
      .get(`/documents/${docId}`)
      .set("Authorization", `Bearer ${collaborator.token}`)
      .expect(200);

    await request(app)
      .put(`/documents/${docId}`)
      .set("Authorization", `Bearer ${collaborator.token}`)
      .send({ title: "Attempted Update" })
      .expect(403);

    await request(app)
      .post(`/documents/${docId}/permissions`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: collaborator.user.id, role: PermissionRole.EDIT })
      .expect(200);

    const updateRes = await request(app)
      .put(`/documents/${docId}`)
      .set("Authorization", `Bearer ${collaborator.token}`)
      .send({ title: "Updated by collaborator" })
      .expect(200);

    expect(updateRes.body.document.title).toBe("Updated by collaborator");
  });
});
