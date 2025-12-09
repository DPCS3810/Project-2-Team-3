import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import { PermissionRole } from "@prisma/client";

const users = [
  {
    name: "Marty McFly",
    email: "martymcfly@ashoka.com",
    password: "dmcdelorean",
  },
  {
    name: "Doc Brown",
    email: "docbrown@ashoka.com",
    password: "fluxcapacitor",
  },
];

async function upsertUsers() {
  const results: Record<string, string> = {};
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const upserted = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash },
      create: { name: user.name, email: user.email, passwordHash },
    });
    results[user.email] = upserted.id;
  }
  return results;
}

async function upsertDocument(ownerId: string, docBrownId: string) {
  let doc = await prisma.document.findFirst({
    where: { title: "Time Travel Test Doc", ownerId },
  });

  if (!doc) {
    doc = await prisma.document.create({
      data: {
        title: "Time Travel Test Doc",
        ownerId,
        content: "Temporal synchronization test content.",
      },
    });
  } else {
    doc = await prisma.document.update({
      where: { id: doc.id },
      data: { content: "Temporal synchronization test content." },
    });
  }

  await prisma.permission.upsert({
    where: { userId_documentId: { userId: ownerId, documentId: doc.id } },
    update: { role: PermissionRole.EDIT },
    create: { userId: ownerId, documentId: doc.id, role: PermissionRole.EDIT },
  });

  await prisma.permission.upsert({
    where: { userId_documentId: { userId: docBrownId, documentId: doc.id } },
    update: { role: PermissionRole.EDIT },
    create: { userId: docBrownId, documentId: doc.id, role: PermissionRole.EDIT },
  });

  return doc;
}

async function main() {
  const userIds = await upsertUsers();
  const doc = await upsertDocument(
    userIds["martymcfly@ashoka.com"],
    userIds["docbrown@ashoka.com"],
  );
  // eslint-disable-next-line no-console
  console.log("Seeded dev doc:", { id: doc.id, title: doc.title });
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
