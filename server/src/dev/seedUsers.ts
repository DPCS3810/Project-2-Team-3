import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";

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

async function main() {
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const upserted = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash },
      create: { name: user.name, email: user.email, passwordHash },
    });
    // eslint-disable-next-line no-console
    console.log(`Seeded user ${upserted.email}`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to seed users", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
