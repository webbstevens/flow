/**
 * Seed the regulation_agencies + certificate_catalog tables.
 *
 * One-shot seeder. Claude enumerates ~47 US federal agencies that touch
 * imports (CBP PGAs + adjacent regulators like OFAC, DDTC, FTC) and the
 * documents / certificates / filings each can require. Output is
 * constrained by a Zod schema and upserted into the DB.
 *
 * Run:
 *   npx tsx --env-file=.env scripts/seed-regulation-catalog.ts
 *
 * Idempotent. Re-running updates LLM rows in place; rows already marked
 * verified or manual_override are left alone (see upsert `update` block).
 *
 * The ~13 US entries currently living in src/lib/certificate-catalog.ts
 * are ported in first as source='manual' / status='verified' so they
 * shadow any Claude duplicates.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import { CERTIFICATE_CATALOG } from "../src/lib/certificate-catalog";

// ---------------------------------------------------------------------------
// Hand-curated seed: the ~13 US entries from the static TS catalog.
// These land as source='manual', status='verified'. Their `agencyCode`
// aliases the old ad-hoc agency strings into the new canonical codes.
// ---------------------------------------------------------------------------

const MANUAL_AGENCY_ALIASES: Record<string, string> = {
  FDA: "FDA",
  FWS: "FWS",
  EPA: "EPA",
  USDA_APHIS: "APHIS",
  CPSC: "CPSC",
  DOT: "NHTSA",
  BIS: "BIS",
  CBP: "CBP",
  NONE: "NONE", // commercial docs — represented as a pseudo-agency
};

// ---------------------------------------------------------------------------
// Zod schema for Claude output
// ---------------------------------------------------------------------------

const AgencySchema = z.object({
  code: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{1,23}$/)
    .describe(
      "Canonical uppercase code, e.g. 'FDA', 'APHIS', 'FWS', 'NHTSA', 'PHMSA', 'OFAC', 'DDTC'. Max 24 chars.",
    ),
  name: z.string().max(120),
  parent_department: z
    .string()
    .describe("Top-level department: HHS, USDA, DOI, DOT, Treasury, DHS, Commerce, State, DOJ, EPA, CPSC, FCC, NRC."),
  scope: z
    .string()
    .max(300)
    .describe("One-line description of the agency's import-touching jurisdiction."),
  pga_code: z
    .string()
    .nullable()
    .describe("CBP ACE PGA message set code if applicable (e.g. 'FD1', 'AP2'), else null."),
  url: z.string().url().nullable(),
  certificates: z
    .array(
      z.object({
        code: z
          .string()
          .regex(/^[A-Z][A-Z0-9_]{1,39}$/)
          .describe(
            "Prefixed with agency code, e.g. 'FDA_PN', 'FWS_3_177', 'EPA_3520_1'. Unique across all agencies.",
          ),
        title: z.string().max(200),
        form_number: z.string().nullable(),
        description: z
          .string()
          .max(400)
          .describe("1-3 sentences: what the document is and when it's required at US import."),
        triggering_hs_chapters: z
          .array(z.number().int().min(1).max(99))
          .describe(
            "HS2 chapters (1-99) this document typically applies to. Empty array = all.",
          ),
        default_severity: z.enum(["required", "conditional", "informational"]),
        type: z
          .enum(["C", "L", "U", "X", "N", "Y", "PGA"])
          .describe(
            "TARIC-style code: C=certificate, L=import licence, U=origin declaration, X=export licence, N=other doc, Y=negative declaration. For US PGA flags use 'PGA'.",
          ),
        url: z.string().url().nullable(),
      }),
    )
    .min(0)
    .max(12),
});

const CatalogSchema = z.object({
  agencies: z.array(AgencySchema).min(45).max(80),
});

type InferredCatalog = z.infer<typeof CatalogSchema>;

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are building an authoritative registry of US federal agencies whose rules can touch imported goods entering the United States. Enumerate 47 agencies spanning CBP Partner Government Agencies (PGAs), trade-controls agencies (OFAC, DDTC, BIS), and adjacent regulators whose requirements commonly appear on US entry summaries.

For each agency, list the documents, certificates, permits, declarations, or filings it can require at the US border. Use canonical code prefixes like FDA_, APHIS_, FWS_, EPA_, NHTSA_, PHMSA_, DDTC_, OFAC_, TTB_, FCC_, CPSC_, etc. Each code must be unique across the whole catalog.

Include the full slate of consequential US import regulators, for example: FDA, APHIS, FSIS, AMS, FGIS, FWS, NMFS (NOAA), EPA, CPSC, NHTSA, PHMSA, FAA, FCC, TTB, ATF, DEA, BIS, DDTC, OFAC, FinCEN, NRC, DOE, USCG, TSA, CBP, OTEXA, IRS, FMC, ITC, USTR, ITA, CDC, FTC, EPA-OTAQ, USDA FAS, FHWA, FRA, DOL-OSHA, DOI-BLM, DOI-BSEE, NIST, FMCSA, NOAA, and others that round out the list to 47.

Do not include: state agencies, non-US regulators, purely internal-use forms, general ACE message types.`;

const USER_PROMPT = `Produce the complete US import-regulator catalog now. Follow the schema exactly. Be comprehensive: a busy customs broker should recognise every agency and certificate on this list.`;

async function inferCatalog(): Promise<InferredCatalog> {
  const client = new Anthropic();
  const result = await client.messages.parse({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: USER_PROMPT }],
    output_config: { format: zodOutputFormat(CatalogSchema) },
  });
  if (!result.parsed_output) {
    throw new Error("Claude did not return a parseable catalog");
  }
  return result.parsed_output;
}

// ---------------------------------------------------------------------------
// Port the hand-curated entries
// ---------------------------------------------------------------------------

async function portStaticCatalog(): Promise<{
  agencyCodes: Set<string>;
  certCodes: Set<string>;
}> {
  const agencies = new Map<
    string,
    {
      code: string;
      name: string;
      parentDepartment: string;
      scope: string;
    }
  >();
  const certs: Array<{
    code: string;
    agencyCode: string;
    title: string;
    description: string;
    jurisdiction: string;
    type: string;
  }> = [];

  const hints: Record<string, { name: string; dept: string; scope: string }> = {
    FDA: {
      name: "Food and Drug Administration",
      dept: "HHS",
      scope: "Food, drugs, medical devices, cosmetics, tobacco at US import.",
    },
    FWS: {
      name: "US Fish and Wildlife Service",
      dept: "DOI",
      scope: "Wildlife products and CITES-listed species at US import.",
    },
    EPA: {
      name: "Environmental Protection Agency",
      dept: "EPA",
      scope: "Chemicals, pesticides, vehicles, refrigerants, hazardous waste.",
    },
    APHIS: {
      name: "Animal and Plant Health Inspection Service",
      dept: "USDA",
      scope: "Plants, seeds, animals, and animal products at US import.",
    },
    CPSC: {
      name: "Consumer Product Safety Commission",
      dept: "CPSC",
      scope: "Consumer product safety — toys, children's products, general conformance.",
    },
    NHTSA: {
      name: "National Highway Traffic Safety Administration",
      dept: "DOT",
      scope: "Motor vehicle equipment subject to FMVSS.",
    },
    BIS: {
      name: "Bureau of Industry and Security",
      dept: "Commerce",
      scope: "Dual-use exports and reexports under the EAR.",
    },
    CBP: {
      name: "US Customs and Border Protection",
      dept: "DHS",
      scope: "Primary entry filings, origin certifications, duty preferences.",
    },
    NONE: {
      name: "Commercial (no US regulator)",
      dept: "Commercial",
      scope: "Universal commercial docs required by carriers / banks, not a regulator.",
    },
  };

  for (const entry of Object.values(CERTIFICATE_CATALOG)) {
    if (entry.jurisdiction !== "US" && entry.jurisdiction !== "INTL") continue;
    const canonical = MANUAL_AGENCY_ALIASES[entry.agency];
    if (!canonical) continue;
    const hint = hints[canonical];
    if (hint && !agencies.has(canonical)) {
      agencies.set(canonical, {
        code: canonical,
        name: hint.name,
        parentDepartment: hint.dept,
        scope: hint.scope,
      });
    }
    certs.push({
      code: entry.code,
      agencyCode: canonical,
      title: entry.name,
      description: entry.description,
      jurisdiction: entry.jurisdiction,
      type: entry.type,
    });
  }

  for (const a of agencies.values()) {
    await prisma.regulationAgency.upsert({
      where: { code: a.code },
      create: {
        code: a.code,
        name: a.name,
        parentDepartment: a.parentDepartment,
        scope: a.scope,
        pgaCode: null,
        url: null,
        status: "verified",
        source: "manual",
        verifiedAt: new Date(),
      },
      // Never downgrade a verified row from a later LLM re-run.
      update: {},
    });
  }

  for (const c of certs) {
    await prisma.certificateCatalog.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        agencyCode: c.agencyCode,
        title: c.title,
        formNumber: null,
        description: c.description,
        jurisdiction: c.jurisdiction,
        type: c.type,
        triggeringHsChapters: [],
        defaultSeverity: "required",
        url: null,
        status: "verified",
        source: "manual",
        verifiedAt: new Date(),
      },
      // Always sync jurisdiction/type for verified static rows so the seeder
      // stays the single source of truth for these fields on manual entries.
      update: {
        jurisdiction: c.jurisdiction,
        type: c.type,
      },
    });
  }

  return {
    agencyCodes: new Set(agencies.keys()),
    certCodes: new Set(certs.map((c) => c.code)),
  };
}

// ---------------------------------------------------------------------------
// Merge LLM output into DB, skipping anything already verified
// ---------------------------------------------------------------------------

async function upsertInferred(catalog: InferredCatalog) {
  let agencyInserts = 0;
  let agencyUpdates = 0;
  let certInserts = 0;
  let certUpdates = 0;

  for (const ag of catalog.agencies) {
    const existing = await prisma.regulationAgency.findUnique({
      where: { code: ag.code },
    });
    if (existing && existing.status === "verified") {
      // Verified rows win.
    } else if (existing) {
      await prisma.regulationAgency.update({
        where: { code: ag.code },
        data: {
          name: ag.name,
          parentDepartment: ag.parent_department,
          scope: ag.scope,
          pgaCode: ag.pga_code,
          url: ag.url,
          status: "flow_validating",
          source: "llm",
        },
      });
      agencyUpdates++;
    } else {
      await prisma.regulationAgency.create({
        data: {
          code: ag.code,
          name: ag.name,
          parentDepartment: ag.parent_department,
          scope: ag.scope,
          pgaCode: ag.pga_code,
          url: ag.url,
          status: "flow_validating",
          source: "llm",
        },
      });
      agencyInserts++;
    }

    for (const cert of ag.certificates) {
      const existingCert = await prisma.certificateCatalog.findUnique({
        where: { code: cert.code },
      });
      if (existingCert && existingCert.status === "verified") continue;
      if (existingCert) {
        await prisma.certificateCatalog.update({
          where: { code: cert.code },
          data: {
            agencyCode: ag.code,
            title: cert.title,
            formNumber: cert.form_number,
            description: cert.description,
            jurisdiction: "US",
            type: cert.type,
            triggeringHsChapters: cert.triggering_hs_chapters,
            defaultSeverity: cert.default_severity,
            url: cert.url,
            status: "flow_validating",
            source: "llm",
          },
        });
        certUpdates++;
      } else {
        await prisma.certificateCatalog.create({
          data: {
            code: cert.code,
            agencyCode: ag.code,
            title: cert.title,
            formNumber: cert.form_number,
            description: cert.description,
            jurisdiction: "US",
            type: cert.type,
            triggeringHsChapters: cert.triggering_hs_chapters,
            defaultSeverity: cert.default_severity,
            url: cert.url,
            status: "flow_validating",
            source: "llm",
          },
        });
        certInserts++;
      }
    }
  }

  return { agencyInserts, agencyUpdates, certInserts, certUpdates };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  console.log("[seed] Porting static catalog → manual/verified rows…");
  const ported = await portStaticCatalog();
  console.log(
    `[seed]   ported ${ported.agencyCodes.size} agencies, ${ported.certCodes.size} certificates`,
  );

  console.log("[seed] Calling Claude for full 47-agency enumeration…");
  const inferred = await inferCatalog();
  console.log(`[seed]   Claude returned ${inferred.agencies.length} agencies`);

  console.log("[seed] Upserting inferred rows…");
  const stats = await upsertInferred(inferred);
  console.log(
    `[seed]   agencies: +${stats.agencyInserts} new, ~${stats.agencyUpdates} updated`,
  );
  console.log(
    `[seed]   certificates: +${stats.certInserts} new, ~${stats.certUpdates} updated`,
  );

  const agencyTotal = await prisma.regulationAgency.count();
  const certTotal = await prisma.certificateCatalog.count();
  console.log(
    `[seed] Done. DB totals — agencies: ${agencyTotal}, certificates: ${certTotal}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
