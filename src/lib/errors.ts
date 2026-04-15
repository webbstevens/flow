export function errorResponse(message: string, code: number) {
  return Response.json({ error: true, message, code }, { status: code });
}
