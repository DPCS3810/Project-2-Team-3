import { prisma } from "../db/prisma";

async function main() {
  const user = await prisma.user.create({
    data: {
      email: "test@example.com",
      passwordHash: "seed-password-hash",
      name: "Test User",
    },
  });

  const document = await prisma.document.create({
    data: {
      title: "Seeded Document",
      description: "Seeded test document for local development",
      ownerId: user.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log("Created user:", user);
  // eslint-disable-next-line no-console
  console.log("Created document:", document);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Seeding failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
