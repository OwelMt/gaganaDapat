const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const validation = require("./reliefRequestValidation");

// Exercise the controller calculations without opening database/network clients.
function controllerFunction(file, name, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../controllers", file), "utf8");
  const start = source.indexOf(`const ${name} =`);
  const end = source.indexOf("\n};", start) + 3;
  return vm.runInNewContext(`${source.slice(start, end)}; ${name}`, {
    toNumber: (value) => Number(value) || 0,
    getActiveRows: validation.getActiveReliefRows,
    getActiveReliefRows: validation.getActiveReliefRows,
    getAffectedPeopleCountForRow: validation.getAffectedPeopleCountForRow,
    getSupportTypesFromRequest: () => [],
    deriveLegacyRequestType: () => "foodpacks",
    getRequestedAppliances: () => [],
    ...dependencies,
  });
}

const row = { male: 40, female: 40, lgbtq: 60, pwd: 70, pregnant: 40, senior: 80 };
test("request responses derive Individuals for historical records without saving", () => {
  const input = { rows: [row], totals: row, prioritySnapshot: { totalAffected: 330 } };
  const result = controllerFunction("reliefRequestController.js", "shapeReliefRequestResponse")(input);
  assert.equal(result.rows[0].individuals, 80);
  assert.equal(result.totals.individuals, 80);
  assert.equal(result.prioritySnapshot.totalAffected, 80);
  assert.equal(input.prioritySnapshot.totalAffected, 330);
});
for (const [file, name, input] of [
  ["reliefRequestController.js", "computePrioritySnapshotFromRows", [row]],
  ["reliefTrackingController.js", "computePrioritySnapshotFromRows", [row]],
  ["drrmoController.js", "computePrioritySnapshot", { totals: row }],
  ["reliefReleaseController.js", "computePrioritySnapshotFromRequest", { totals: row }],
  ["reliefAnalyticsController.js", "getAffectedTotal", { totals: row }],
]) {
  test(`${file} counts only Male + Female`, () => {
    const result = controllerFunction(file, name)(input);
    assert.equal(typeof result === "number" ? result : result.totalAffected, 80);
  });
}

test("model derives row and active-row total Individuals on save", () => {
  const ReliefRequest = require("../models/ReliefRequest");
  const doc = new ReliefRequest({ rows: [
    { ...row, evacuationCenterName: "Active" },
    { male: 100, female: 100, evacuationCenterName: "Inactive", isActiveRow: false },
  ] });
  const hooks = ReliefRequest.schema.s.hooks._pres.get("save");
  hooks.find((hook) => hook.fn.toString().includes("this.totals =")).fn.call(doc);
  assert.equal(doc.rows[0].individuals, 80);
  assert.equal(doc.rows[1].individuals, 200);
  assert.equal(doc.totals.individuals, 80);
});

test("submit and update reject invalid raw rows before persistence", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../controllers/reliefRequestController.js"), "utf8");
  const sandbox = {
    module: { exports: {} }, __dirname, console,
    require: (name) => {
      if (name === "path") return path;
      if (name.endsWith("reliefSupportTypes")) return require("./reliefSupportTypes");
      if (name.endsWith("reliefRequestValidation")) return validation;
      if (name.endsWith("/Barangay")) return { findById: async () => ({ _id: "barangay" }) };
      if (name.endsWith("/ReliefRequest")) return { findOne: async () => ({ status: "pending", requestType: "foodpacks" }) };
      return {};
    },
  };
  vm.runInNewContext(source, sandbox);
  for (const handler of ["submitReliefRequest", "updateOwnReliefRequest"]) {
    for (const invalid of [{ senior: "bad" }, { pregnant: 0.5 }, { individuals: 89 }]) {
      const req = { session: { userId: "barangay" }, params: { id: "request" }, body: {
        disaster: "Flood", requestType: "foodpacks", rows: [{ ...row, ...invalid, evacuationCenterName: "Test" }],
      } };
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
      await sandbox.module.exports[handler](req, res);
      assert.equal(res.statusCode, 400, `${handler}: ${JSON.stringify(res.body)}`);
      assert.match(res.body.message, /whole|Individuals/);
    }
  }
});


test("DRRMO queue ignores cached population that double-counted subgroups", () => {
  const result = controllerFunction("drrmoController.js", "enrichRequestForQueue", {
    computePrioritySnapshot: controllerFunction("drrmoController.js", "computePrioritySnapshot"),
    normalizeString: (value) => String(value || ""),
    deriveStageFromStatus: () => "pending_review",
    normalizeRequestType: () => "foodpacks",
    buildDemandSummaryLabel: () => "Food packs",
    getPriorityLevel: () => "normal",
    buildPriorityBadges: () => [],
    buildOperationalStatusLabel: () => "Pending",
  })({ totals: row, prioritySnapshot: { priorityScore: 10, totalAffected: 330 } });
  assert.equal(result.prioritySnapshot.totalAffected, 80);
  assert.equal(result.totals.individuals, 80);
});


test("tracking corrects population without replacing the saved priority policy", () => {
  const result = controllerFunction("reliefTrackingController.js", "getCurrentPrioritySnapshot", {
    computePrioritySnapshotFromRows: controllerFunction("reliefTrackingController.js", "computePrioritySnapshotFromRows"),
  })({ rows: [row], prioritySnapshot: { priorityScore: 123, totalAffected: 330, waitingDays: 2 } });
  assert.equal(result.totalAffected, 80);
  assert.equal(result.priorityScore, 123);
  assert.equal(result.waitingDays, 2);
});
