/**
 * Backfill jurisdiction + type on certificate_catalog for the manual-port
 * rows (the hand-curated static CERTIFICATE_CATALOG entries). No LLM call.
 *
 * Run once after applying scripts/add-catalog-jurisdiction-type.sql if
 * you don't want to re-run the full LLM seeder.
 *
 *   npx tsx --env-file=.env scripts/backfill-catalog-jurisdiction-type.ts
 */

import { prisma } from "../src/lib/prisma";
import {
  CERTIFICATE_CATALOG,
  AGENCY_NAMES,
} from "../src/lib/certificate-catalog";

// Only port rows whose agency already exists (or which we seed as UNIVERSAL).
// The manual seeder ports US + INTL only; EU/UK rows stay in TS-only land
// until their agencies land in regulation_agencies.
const AGENCY_ALIASES: Record<string, string> = {
  FDA: "FDA",
  FWS: "FWS",
  EPA: "EPA",
  USDA_APHIS: "APHIS",
  CPSC: "CPSC",
  DOT: "NHTSA",
  BIS: "BIS",
  CBP: "CBP",
  NONE: "NONE",
};

async function main() {
  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const entry of Object.values(CERTIFICATE_CATALOG)) {
    const agencyCode = AGENCY_ALIASES[entry.agency];
    if (!agencyCode) {
      skipped++;
      continue;
    }

    const agencyExists = await prisma.regulationAgency.findUnique({
      where: { code: agencyCode },
    });
    if (!agencyExists) {
      skipped++;
      continue;
    }

    const existing = await prisma.certificateCatalog.findUnique({
      where: { code: entry.code },
    });

    if (existing) {
      await prisma.certificateCatalog.update({
        where: { code: entry.code },
        data: { jurisdiction: entry.jurisdiction, type: entry.type },
      });
      updated++;
    } else {
      await prisma.certificateCatalog.create({
        data: {
          code: entry.code,
          agencyCode,
          title: entry.name,
          description: entry.description,
          jurisdiction: entry.jurisdiction,
          type: entry.type,
          triggeringHsChapters: [],
          defaultSeverity: "required",
          status: "verified",
          source: "manual",
          verifiedAt: new Date(),
        },
      });
      created++;
    }
  }

  console.log(
    `[backfill] updated ${updated}, created ${created}, skipped ${skipped} (agencies not in DB; likely EU/UK)`,
  );
  void AGENCY_NAMES; // keep import for side-effect clarity
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
