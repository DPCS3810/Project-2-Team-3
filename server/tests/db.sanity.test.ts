import { prisma } from "../src/db/prisma";

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Prisma DB sanity", () => {
  it("can create and read a User", async () => {
    const email = `user-${Date.now()}@example.com`;

    const createdUser = await prisma.user.create({
      data: {
        email,
        passwordHash: "test-hash",
        name: "Test User",
      },
    });

    const fetchedUser = await prisma.user.findUnique({
      where: { id: createdUser.id },
    });

    expect(fetchedUser).not.toBeNull();
    expect(fetchedUser?.email).toBe(email);
  });

  it("can create a Document linked to a User", async () => {
    const email = `doc-owner-${Date.now()}@example.com`;

    const owner = await prisma.user.create({
      data: {
        email,
        passwordHash: "doc-owner-hash",
        name: "Doc Owner",
      },
    });

    const document = await prisma.document.create({
      data: {
        title: "Integration Test Document",
        description: "Document created during tests",
        ownerId: owner.id,
      },
    });

    const fetchedDocument = await prisma.document.findUnique({
      where: { id: document.id },
    });

    expect(fetchedDocument).not.toBeNull();
    expect(fetchedDocument?.ownerId).toBe(owner.id);
    expect(fetchedDocument?.title).toBe("Integration Test Document");
  });
});
