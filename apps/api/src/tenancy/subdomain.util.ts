const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED = new Set([
  "www",
  "api",
  "app",
  "admin",
  "platform",
  "billing",
  "login",
  "static",
  "assets",
]);

export function normalizeSubdomain(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export function isValidSubdomain(value: string): boolean {
  const normalized = normalizeSubdomain(value);
  if (!normalized || normalized.length < 3 || normalized.length > 63) {
    return false;
  }
  if (RESERVED.has(normalized)) {
    return false;
  }
  return SUBDOMAIN_PATTERN.test(normalized);
}

export function extractSubdomainFromHost(
  host: string,
  baseDomain?: string,
): string | null {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    const parts = hostname.split(".");
    if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
      return parts[0] || null;
    }
    return null;
  }
  const root = (baseDomain ?? process.env.BASE_DOMAIN ?? "").toLowerCase();
  if (!root || !hostname.endsWith(root)) {
    return null;
  }
  const prefix = hostname.slice(0, -(root.length + 1));
  if (!prefix || prefix.includes(".")) {
    return null;
  }
  return prefix;
}
