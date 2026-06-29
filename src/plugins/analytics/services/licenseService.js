const crypto = require("crypto");
const AnalyticsLicense = require("../../../models/AnalyticsLicense");
const analyticsConfig = require("../config");

let cachedLicense = null;
let cacheExpiresAt = 0;

function generateLicenseKey() {
  return `ST-AN-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

async function getActiveLicense(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedLicense && cacheExpiresAt > now) {
    return cachedLicense;
  }

  const query = { enabled: true };
  if (analyticsConfig.licenseKey) {
    query.licenseKey = analyticsConfig.licenseKey;
  }

  const license = await AnalyticsLicense.findOne(query).sort({ activatedAt: -1 }).lean();
  if (!license) {
    cachedLicense = null;
    cacheExpiresAt = now + 30_000;
    return null;
  }

  if (license.expiresAt && new Date(license.expiresAt).getTime() < now) {
    cachedLicense = null;
    cacheExpiresAt = now + 30_000;
    return null;
  }

  cachedLicense = license;
  cacheExpiresAt = now + 30_000;
  return license;
}

async function isAnalyticsLicensed() {
  if (!analyticsConfig.enabled) return false;
  const license = await getActiveLicense();
  return Boolean(license);
}

async function hasAnalyticsFeature(feature) {
  const license = await getActiveLicense();
  if (!license) return false;
  return license.features.includes(feature);
}

async function getAnalyticsStatus() {
  const licensed = await isAnalyticsLicensed();
  const license = licensed ? await getActiveLicense() : null;

  return {
    plugin: analyticsConfig.pluginName,
    enabled: analyticsConfig.enabled,
    licensed,
    active: licensed,
    organizationName: license?.organizationName || null,
    organizationId: license?.organizationId || null,
    plan: license?.plan || null,
    features: license?.features || [],
    expiresAt: license?.expiresAt || null,
    maxEventsPerMonth: license?.maxEventsPerMonth || null,
  };
}

async function activateLicense(payload, activatedBy) {
  const licenseKey = payload.licenseKey?.trim() || generateLicenseKey();

  const license = await AnalyticsLicense.findOneAndUpdate(
    { licenseKey },
    {
      licenseKey,
      organizationName: payload.organizationName?.trim() || "SpaceTime",
      organizationId: payload.organizationId?.trim() || "default",
      enabled: true,
      plan: payload.plan || "pro",
      features: Array.isArray(payload.features) && payload.features.length
        ? payload.features
        : analyticsConfig.defaultFeatures,
      maxEventsPerMonth: payload.maxEventsPerMonth || 100000,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      notes: payload.notes?.trim() || "",
      activatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  cachedLicense = null;
  return license;
}

async function deactivateLicense(licenseKey) {
  await AnalyticsLicense.findOneAndUpdate(
    { licenseKey },
    { enabled: false },
  );
  cachedLicense = null;
}

module.exports = {
  generateLicenseKey,
  getActiveLicense,
  isAnalyticsLicensed,
  hasAnalyticsFeature,
  getAnalyticsStatus,
  activateLicense,
  deactivateLicense,
};
