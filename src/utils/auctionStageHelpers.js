const UPCOMING_DAYS = 10;

function nowIso() {
  return new Date().toISOString();
}

function parseAuctionDate(value) {
  if (!value || !String(value).trim()) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isPropertyLiveForMonitor(property) {
  if (!property || property.auctionStatus !== "Live") return false;

  const end = parseAuctionDate(property.auctionEndDateTime);
  if (end !== null && end <= Date.now()) return false;

  const start = parseAuctionDate(property.auctionStartDateTime);
  if (start !== null && start > Date.now()) return false;

  return true;
}

function isPropertyEndedForMonitor(property) {
  if (!property) return false;
  if (property.auctionStatus === "Ended") return true;
  if (property.auctionStatus !== "Live") return false;

  const end = parseAuctionDate(property.auctionEndDateTime);
  return end !== null && end <= Date.now();
}

function buildLiveStageFilter() {
  const now = nowIso();
  return {
    auctionStatus: "Live",
    $and: [
      {
        $or: [
          { auctionEndDateTime: { $gt: now } },
          { auctionEndDateTime: { $in: [null, ""] } },
        ],
      },
      {
        $or: [
          { auctionStartDateTime: { $lte: now } },
          { auctionStartDateTime: { $in: [null, ""] } },
        ],
      },
    ],
  };
}

function buildEndedStageFilter() {
  const now = nowIso();
  return {
    $or: [
      { auctionStatus: "Ended" },
      {
        auctionStatus: "Live",
        auctionEndDateTime: { $nin: [null, ""], $lte: now },
      },
    ],
  };
}

function buildUpcomingStageFilter() {
  const now = nowIso();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + UPCOMING_DAYS);

  return {
    auctionStartDateTime: {
      $gt: now,
      $lte: cutoff.toISOString(),
    },
    auctionStatus: { $nin: ["Live", "Ended", "Cancelled"] },
  };
}

function buildAuctionStageFilter(stage) {
  const normalized = String(stage ?? "").trim().toLowerCase();
  if (normalized === "live") return buildLiveStageFilter();
  if (normalized === "ended") return buildEndedStageFilter();
  if (normalized === "upcoming") return buildUpcomingStageFilter();
  return null;
}

function filterPropertiesForMonitorStage(properties, stage) {
  if (stage === "ended") {
    return properties.filter(isPropertyEndedForMonitor);
  }
  return properties.filter(isPropertyLiveForMonitor);
}

module.exports = {
  UPCOMING_DAYS,
  parseAuctionDate,
  isPropertyLiveForMonitor,
  isPropertyEndedForMonitor,
  buildLiveStageFilter,
  buildEndedStageFilter,
  buildUpcomingStageFilter,
  buildAuctionStageFilter,
  filterPropertiesForMonitorStage,
};
