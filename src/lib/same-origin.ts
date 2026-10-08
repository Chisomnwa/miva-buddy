export function isSameOriginRequest(request: Pick<Request, "headers" | "url">): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  try {
    const requestUrl = new URL(request.url);
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
    const protocol = forwardedProtocol || requestUrl.protocol.slice(0, -1);
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}
