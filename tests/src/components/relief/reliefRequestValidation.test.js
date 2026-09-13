import {
  getAffectedPeopleCountForRow,
  getReliefPopulationValidationError,
} from "./reliefRequestValidation";

describe("reliefRequestValidation", () => {
  test("counts affected people from the evacuation-row population fields", () => {
    expect(
      getAffectedPeopleCountForRow({
        male: 10,
        female: 11,
        lgbtq: 1,
        pwd: 2,
        pregnant: 1,
        senior: 3,
      })
    ).toBe(21);
  });

  test("rejects active rows with zero affected people", () => {
    expect(
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
      ])
    ).toBe(
      "Each active evacuation center row must include at least 1 affected person."
    );
  });

  test("accepts active rows that include at least one affected person", () => {
    expect(
      getReliefPopulationValidationError([
        {
          evacuationCenterName: "Test Center",
          male: 4,
          female: 3,
          lgbtq: 0,
          pwd: 0,
          pregnant: 0,
          senior: 0,
          isActiveRow: true,
        },
      ])
    ).toBe("");
  });
});


describe("overlapping population validation", () => {
  test.each([
    [{ male: 40, female: 40, individuals: 89 }, /Individuals.*80/],
    [{ male: 40, female: 40, senior: 81 }, /Senior.*80/],
    [{ male: 40, female: 40, pregnant: 41 }, /Pregnant.*Female/],
    [{ male: -1, female: 40 }, /Male.*whole/],
    [{ male: "oops", female: 40 }, /Male.*whole/],
    [{ male: 1.5, female: 40 }, /Male.*whole/],
    [{ male: 40, female: 40, pwd: Infinity }, /PWD.*whole/],
  ])("rejects inconsistent population %j", (row, error) => {
    expect(getReliefPopulationValidationError([row])).toMatch(error);
  });
  test("allows overlapping subgroups and optional totals", () => {
    expect(getReliefPopulationValidationError([{ male: 30, female: 45, pregnant: 45, senior: 75, pwd: 75, lgbtq: 75 }])).toBe("");
  });
});


test.each([true, [], {}])("rejects nonnumeric count types %j", (male) => {
  expect(getReliefPopulationValidationError([{ male, female: 40 }])).toMatch(/Male.*whole/);
});
test("validates subgroup bounds on inactive rows without requiring population", () => {
  expect(getReliefPopulationValidationError([{ male: 1 }, { male: 0, female: 0, isActiveRow: false }])).toBe("");
  expect(getReliefPopulationValidationError([{ male: 1 }, { male: 0, senior: 2, isActiveRow: false }])).toMatch(/Senior/);
});
