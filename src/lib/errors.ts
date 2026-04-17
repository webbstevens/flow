import { DOCS_BASE_URL, type ErrorCode } from "./error-codes";
import { generateRequestId } from "./request-logger";

export interface ErrorResponseInput {
  code: ErrorCode;
  message: string;
  status: number;
  requestId?: string;
  docsUrl?: string;
}

export function errorResponse({
  code,
  message,
  status,
  requestId,
  docsUrl,
}: ErrorResponseInput): Response {
  const rid = requestId ?? generateRequestId();
  const body = {
    code,
    message,
    request_id: rid,
    docs_url: docsUrl ?? `${DOCS_BASE_URL}/${code}`,
  };
  const res = Response.json(body, { status });
  res.headers.set("X-Request-Id", rid);
  return res;
}
