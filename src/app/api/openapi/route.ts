import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

// Cache the parsed spec at module load
const specPath = join(process.cwd(), "openapi.yaml");
const specYaml = readFileSync(specPath, "utf8");
const spec = yaml.load(specYaml);

export async function GET() {
  return Response.json(spec);
}
