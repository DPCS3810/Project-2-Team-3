import { PermissionRole } from "@prisma/client";
import { prisma } from "../src/db/prisma";
import { applyUserOperations, loadDocumentState } from "../src/collab/collab.service";

const EMAIL_PREFIX = "collab-test-";

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
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

describe("Collab service", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("applies operations, updates content, logs ops, and increments version", async () => {
    const owner = await prisma.user.create({
      data: {
        email: `${EMAIL_PREFIX}owner-${Date.now()}@example.com`,
        passwordHash: "hash",
        name: "Owner",
      },
    });

    const doc = await prisma.document.create({
      data: {
        ownerId: owner.id,
        title: "Collab Doc",
      },
    });

    await prisma.document.update({
      where: { id: doc.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { content: "Hello", currentVersion: 0 } as any,
    });

    await prisma.permission.create({
      data: {
        userId: owner.id,
        documentId: doc.id,
        role: PermissionRole.EDIT,
      },
    });

    const result = await applyUserOperations({
      userId: owner.id,
      documentId: doc.id,
      baseVersion: 0,
      operations: [{ type: "insert", index: 5, text: " World" }],
    });

    expect(result.content).toBe("Hello World");
    expect(result.version).toBe(1);

    const updatedDoc = await loadDocumentState(doc.id);
    expect(updatedDoc.content).toBe("Hello World");
    expect(updatedDoc.version).toBe(1);

    const opLogCount = await prisma.opLog.count({ where: { documentId: doc.id } });
    expect(opLogCount).toBe(1);
  });
});
