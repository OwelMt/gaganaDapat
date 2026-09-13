const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getAffectedPeopleCountForRow,
  getReliefPopulationValidationError,
} = require("./reliefRequestValidation");

test("counts affected people from relief-request row demographics", () => {
  assert.equal(
    getAffectedPeopleCountForRow({
      male: 12,
      female: 8,
      lgbtq: 1,
      pwd: 2,
      pregnant: 1,
      senior: 3,
    }),
    20
  );
});

test("allows overlapping breakdowns without adding them to Individuals", () => {
  assert.equal(getReliefPopulationValidationError([{ male: 40, female: 40, lgbtq: 60, pwd: 70, senior: 80, pregnant: 40, individuals: 80 }]), null);
});

test("rejects supplied Individuals that differ from Male + Female", () => {
  assert.match(getReliefPopulationValidationError([{ male: 40, female: 40, individuals: 89 }]), /individuals.*80/i);
});

test("allows omitted or blank optional Individuals", () => {
  for (const individuals of [undefined, null, "", "   ", "80", 80]) {
    assert.equal(getReliefPopulationValidationError([{ male: "40", female: 40, individuals }]), null);
  }
});

test("rejects invalid demographic counts before coercion", () => {
  for (const field of ["male", "female", "lgbtq", "pwd", "pregnant", "senior", "households", "families", "requestedFoodPacks"]) {
    for (const value of [-1, 0.5, "bad", Infinity, NaN, true, [], {}, Number.MAX_SAFE_INTEGER + 1]) {
      assert.match(getReliefPopulationValidationError([{ male: 40, female: 40, [field]: value }]), /whole|integer/i, `${field}: ${String(value)}`);
    }
  }
});

test("rejects pregnancy and subgroup counts beyond their parent populations", () => {
  assert.match(getReliefPopulationValidationError([{ male: 40, female: 40, pregnant: 41 }]), /pregnant.*female/i);
  for (const field of ["lgbtq", "pwd", "senior"]) {
    assert.match(getReliefPopulationValidationError([{ male: 40, female: 40, [field]: 81 }]), new RegExp(`${field}.*individuals`, "i"));
  }
});

test("rejects unsafe combined Individuals and subgroup-only populations", () => {
  assert.match(getReliefPopulationValidationError([{ male: Number.MAX_SAFE_INTEGER, female: 1 }]), /safe|integer/i);
  assert.ok(getReliefPopulationValidationError([{ male: 0, female: 0, senior: 1 }]));
});

test("rejects active relief-request rows with zero affected people", () => {
  assert.equal(
    getReliefPopulationValidationError([
      {
        evacuationCenterName: "Test Center",
        male: 0,
        female: 0,
        lgbtq: 0,
        pwd: 0,
        pregnant: 0,
        senior: 0,
        isActiveRow: true,
      },
    ]),
    "Each active evacuation center row must include at least 1 affected person."
  );
});

test("allows inactive zero-population rows when another active row has people", () => {
  assert.equal(
    getReliefPopulationValidationError([
      {
        evacuationCenterName: "Inactive Center",
        male: 0,
        female: 0,
        lgbtq: 0,
        pwd: 0,
        pregnant: 0,
        senior: 0,
        isActiveRow: false,
      },
      {
        evacuationCenterName: "Active Center",
        male: 4,
        female: 5,
        lgbtq: 0,
        pwd: 1,
        pregnant: 0,
        senior: 0,
        isActiveRow: true,
      },
    ]),
    null
  );
});
