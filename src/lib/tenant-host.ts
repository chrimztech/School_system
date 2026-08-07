export const PLATFORM_DOMAIN = "school.edu.zm";

const SCHOOL_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function schoolSlugFromHostname(
  hostname: string,
  platformDomain = PLATFORM_DOMAIN,
): string | null {
  const host = normalizeHostname(hostname);
  const platform = normalizeHostname(platformDomain);
  if (!host || host === platform || isUnscopedDevelopmentHost(host)) return null;

  const slug = singleSubdomain(host, platform) ?? singleSubdomain(host, "localhost");
  return slug && SCHOOL_SLUG.test(slug) ? slug : null;
}

function singleSubdomain(host: string, parent: string): string | null {
  const suffix = `.${parent}`;
  if (!host.endsWith(suffix)) return null;
  const candidate = host.slice(0, -suffix.length);
  return candidate.includes(".") ? null : candidate;
}

function isUnscopedDevelopmentHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}
