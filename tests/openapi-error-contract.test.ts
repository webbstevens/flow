import { describe, it, expect } from "vitest";
import { generateOpenApiSpec } from "@/lib/openapi-spec";

/**
 * Guard the VISION.md §4.8 contract at the spec level. If someone adds a
 * new route and documents a 4xx/5xx with a custom schema, this test fails
 * and forces them to reference ErrorResponse (or override intentionally).
 */

type JsonObject = Record<string, unknown>;

function findErrorResponses(spec: JsonObject) {
  const hits: { path: string; method: string; status: string; schema: unknown }[] = [];
  const paths = spec.paths as JsonObject;
  for (const [path, pathItem] of Object.entries(paths ?? {})) {
    for (const [method, op] of Object.entries(pathItem as JsonObject)) {
      const responses = (op as JsonObject).responses as JsonObject | undefined;
      if (!responses) continue;
      for (const [status, response] of Object.entries(responses)) {
        if (!/^(4|5)\d\d$/.test(status)) continue;
        const content = (response as JsonObject).content as JsonObject | undefined;
        const schema = content?.["application/json"] as JsonObject | undefined;
        hits.push({ path, method, status, schema: schema?.schema });
      }
    }
  }
  return hits;
}

describe("OpenAPI spec — every 4xx/5xx references ErrorResponse", () => {
  const spec = generateOpenApiSpec() as unknown as JsonObject;

  it("has at least one documented error response (sanity)", () => {
    expect(findErrorResponses(spec).length).toBeGreaterThan(0);
  });

  it("every 4xx/5xx schema resolves to ErrorResponse", () => {
    const hits = findErrorResponses(spec);
    const offenders: string[] = [];
    for (const hit of hits) {
      const schema = hit.schema as JsonObject | undefined;
      const ref = schema?.$ref as string | undefined;
      const id = schema?.id as string | undefined;
      const resolvesToErrorResponse =
        ref?.endsWith("/ErrorResponse") || id === "ErrorResponse";
      if (!resolvesToErrorResponse) {
        offenders.push(
          `${hit.method.toUpperCase()} ${hit.path} → ${hit.status}: ${JSON.stringify(schema)}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ErrorResponse schema in components matches the §4.8 contract", () => {
    const components = spec.components as JsonObject;
    const schemas = components.schemas as JsonObject;
    const err = schemas.ErrorResponse as JsonObject;
    expect(err).toBeDefined();
    const props = err.properties as JsonObject;
    expect(Object.keys(props).sort()).toEqual(
      ["code", "docs_url", "message", "request_id"].sort(),
    );
  });
});
