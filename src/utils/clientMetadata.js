const geoip = require("geoip-lite");
const UAParser = require("ua-parser-js");

function normalizeIp(ip) {
  if (!ip) return "";
  let value = String(ip).trim();
  if (value.startsWith("::ffff:")) {
    value = value.slice(7);
  }
  if (value === "::1") return "127.0.0.1";
  return value.slice(0, 45);
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = String(forwarded).split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) return normalizeIp(realIp);

  return normalizeIp(req.socket?.remoteAddress || req.ip || "");
}

function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser: "",
      os: "",
      deviceType: "unknown",
    };
  }

  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const browserLabel = [browser.name, browser.version?.split(".")?.[0]]
    .filter(Boolean)
    .join(" ");

  const osLabel = [os.name, os.version].filter(Boolean).join(" ");

  let deviceType = device.type || "desktop";
  if (deviceType === "mobile" || deviceType === "tablet") {
    deviceType = device.type;
  } else if (!device.type) {
    deviceType = "desktop";
  }

  return {
    browser: browserLabel.slice(0, 80),
    os: osLabel.slice(0, 80),
    deviceType: String(deviceType).slice(0, 32),
  };
}

function getGeoFromIp(ipAddress) {
  const ip = normalizeIp(ipAddress);
  if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return {
      country: "Local",
      region: "",
      city: "Local Network",
      timezone: "",
    };
  }

  const lookup = geoip.lookup(ip);
  if (!lookup) {
    return {
      country: "",
      region: "",
      city: "",
      timezone: "",
    };
  }

  return {
    country: lookup.country || "",
    region: Array.isArray(lookup.region) ? lookup.region.join(", ") : "",
    city: lookup.city || "",
    timezone: lookup.timezone || "",
  };
}

function buildClientMetadata(req, clientContext = {}) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";
  const parsedUa = parseUserAgent(userAgent);
  const geo = getGeoFromIp(ipAddress);

  const acceptLanguage = req.headers["accept-language"];
  const language =
    clientContext.language ||
    (acceptLanguage ? String(acceptLanguage).split(",")[0]?.trim() : "");

  return {
    ipAddress,
    userAgent: String(userAgent).slice(0, 512),
    browser: parsedUa.browser,
    os: parsedUa.os,
    deviceType: parsedUa.deviceType,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    timezone:
      clientContext.timezone ||
      geo.timezone ||
      "",
    language: String(language).slice(0, 32),
    referrer: String(
      clientContext.referrer || req.headers.referer || req.headers.referrer || "",
    ).slice(0, 512),
    screenWidth:
      Number.isFinite(Number(clientContext.screenWidth)) &&
      Number(clientContext.screenWidth) > 0
        ? Number(clientContext.screenWidth)
        : undefined,
    screenHeight:
      Number.isFinite(Number(clientContext.screenHeight)) &&
      Number(clientContext.screenHeight) > 0
        ? Number(clientContext.screenHeight)
        : undefined,
  };
}

function mapClientFields(row) {
  return {
    ipAddress: row.ipAddress ?? "",
    browser: row.browser ?? "",
    os: row.os ?? "",
    deviceType: row.deviceType ?? "",
    country: row.country ?? "",
    region: row.region ?? "",
    city: row.city ?? "",
    timezone: row.timezone ?? "",
    language: row.language ?? "",
    referrer: row.referrer ?? "",
    screenWidth: row.screenWidth ?? null,
    screenHeight: row.screenHeight ?? null,
    userAgent: row.userAgent ?? "",
  };
}

function formatLocation(parts) {
  return [parts.city, parts.region, parts.country].filter(Boolean).join(", ");
}

module.exports = {
  buildClientMetadata,
  getClientIp,
  parseUserAgent,
  getGeoFromIp,
  mapClientFields,
  formatLocation,
};
