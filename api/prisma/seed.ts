import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const providerUser = await prisma.user.upsert({
    where: { email: "dr-smith@example.com" },
    update: {},
    create: {
      email: "dr-smith@example.com",
      password: "placeholder",
      role: "PROVIDER",
    },
  });

  await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      password: "placeholder",
      role: "CUSTOMER",
    },
  });

  const provider = await prisma.provider.upsert({
    where: { slug: "dr-smith" },
    update: { displayName: "Dr. Smith", timezone: "America/New_York" },
    create: {
      userId: providerUser.id,
      displayName: "Dr. Smith",
      slug: "dr-smith",
      timezone: "America/New_York",
    },
  });

  await prisma.service.deleteMany({ where: { providerId: provider.id } });
  await prisma.availabilityRule.deleteMany({
    where: { providerId: provider.id },
  });

  await prisma.service.createMany({
    data: [
      {
        providerId: provider.id,
        name: "Consultation",
        durationMinutes: 30,
        priceCents: 5000,
        depositCents: 1000,
      },
      {
        providerId: provider.id,
        name: "Follow-up",
        durationMinutes: 60,
        priceCents: 9000,
        depositCents: 2000,
      },
    ],
  });


  await prisma.availabilityRule.createMany({
    data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      providerId: provider.id,
      dayOfWeek,
      startMinute: 540,
      endMinute: 1020,
    })),
  });

  console.log("✅ Seed complete — provider:", provider.slug);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
