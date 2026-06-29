#!/usr/bin/env node
/**
 * Dev helper: activate analytics license in spacetime-db
 * Usage: node scripts/activate-analytics-license.js [licenseKey]
 */
require("dotenv").config();
const connectDB = require("../src/config/db");
const { activateLicense } = require("../src/plugins/analytics/services/licenseService");

async function main() {
  const licenseKey =
    process.argv[2]?.trim() ||
    process.env.ANALYTICS_LICENSE_KEY ||
    `ST-AN-DEV-${Date.now()}`;

  await connectDB();

  const license = await activateLicense(
    {
      licenseKey,
      organizationName: "SpaceTime Dev",
      organizationId: "default",
      plan: "enterprise",
      notes: "Activated via scripts/activate-analytics-license.js",
    },
    null,
  );

  console.log("Analytics license activated:");
  console.log(JSON.stringify(license, null, 2));
  console.log("\nAdd this to .env:");
  console.log(`ANALYTICS_ENABLED=true`);
  console.log(`ANALYTICS_LICENSE_KEY=${license.licenseKey}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
