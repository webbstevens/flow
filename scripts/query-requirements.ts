import { prisma } from "../src/lib/prisma";

async function main() {
  const total = await prisma.classificationRequirement.count();
  const rows = await prisma.classificationRequirement.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(JSON.stringify({ total, rows }, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
