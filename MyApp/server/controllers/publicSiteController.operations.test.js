const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const Incident = {
  countDocuments: async () => 2,
};
const Donation = {
  countDocuments: async () => 3,
};
const InventoryItem = {
  distinct: async () => ["food", "water", "medicine"],
};
const ReliefDistributionRecord = {
  countDocuments: async () => 4,
  find: () => ({
    sort: () => ({
      limit: () => ({
        lean: async () => [
          {
            _id: "distribution-1",
            barangayName: "Lambakin",
            distributionStatus: "completed",
            remarks: "Door-to-door distribution completed.",
            distributionDate: new Date("2026-09-30T04:15:00.000Z"),
            updatedAt: new Date("2026-09-30T04:15:00.000Z"),
          },
        ],
      }),
    }),
  }),
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "mongoose") {
    return { Types: { ObjectId: { isValid: () => false } } };
  }
  if (request === "../models/Incident") return Incident;
  if (request === "../models/Donation") return Donation;
  if (request === "../models/InventoryItem") return InventoryItem;
  if (request === "../models/ReliefDistributionRecord") return ReliefDistributionRecord;
  if (request === "../models/PublicSite") return {};
  if (request === "../models/Notification") return {};
  if (request === "../config/cloudinary") return { uploader: { upload_stream() {}, destroy: async () => {} } };
  if (request === "../utils/createNotification") return async () => {};
  return originalLoad.call(this, request, parent, isMain);
};

const { getPublicOperations } = require("./publicSiteController");

test("returns public-safe operations metrics and completed relief activity", async () => {
  let statusCode = 200;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  await getPublicOperations({}, res);

  assert.equal(statusCode, 200);
  assert.deepEqual(responseBody.summary, {
    activePublicIncidents: 2,
    resolvedLast30Days: 2,
    familiesServed: 4,
    donationRecordsLast30Days: 3,
    readyResourceCategories: 3,
  });
  assert.equal(responseBody.activities.length, 1);
  assert.deepEqual(responseBody.activities[0], {
    id: "distribution-1",
    category: "Relief Distribution",
    status: "Completed",
    title: "Relief assistance completed in Lambakin",
    summary: "1 family record served.",
    location: "Lambakin",
    updatedAt: "2026-09-30T04:15:00.000Z",
  });
  assert.match(responseBody.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

