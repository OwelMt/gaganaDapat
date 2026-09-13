import {
  getRequestIndividuals,
  getRowIndividuals,
  getRequestEditBadgeLabel,
  getVisibleCenterCount,
  getVisibleRowTotals,
  getVisibleRows,
} from "./requestListUtils";

describe("requestListUtils", () => {
  test("ignores turned-off evacuation rows in visible center counts", () => {
    const request = {
      rows: [
        {
          evacuationCenterName: "Bank",
          isActiveRow: true,
          male: 20,
          female: 22,
          requestedFoodPacks: 60,
        },
        {
          evacuationCenterName: "OldChurch",
          isActiveRow: true,
          male: 68,
          female: 43,
          requestedFoodPacks: 60,
        },
        {
          evacuationCenterName: "trynotif",
          isActiveRow: false,
          male: 99,
          female: 101,
          requestedFoodPacks: 50,
        },
      ],
    };

    expect(getVisibleRows(request)).toEqual([
      {
        evacuationCenterName: "Bank",
        isActiveRow: true,
        male: 20,
        female: 22,
        requestedFoodPacks: 60,
      },
      {
        evacuationCenterName: "OldChurch",
        isActiveRow: true,
        male: 68,
        female: 43,
        requestedFoodPacks: 60,
      },
    ]);
    expect(getVisibleCenterCount(request)).toBe(2);
    expect(getVisibleRowTotals(request)).toEqual({
      households: 0,
      families: 0,
      male: 88,
      female: 65,
      lgbtq: 0,
      pwd: 0,
      pregnant: 0,
      senior: 0,
      individuals: 153,
      requestedFoodPacks: 120,
    });
  });

  test("counts individuals from male and female without double-counting subgroups", () => {
    const row = { male: "12", female: "18", lgbtq: 5, pwd: 4, pregnant: 3, senior: 7, individuals: 49 };
    expect(getRowIndividuals(row)).toBe(30);
    expect(getVisibleRowTotals({ rows: [row] }).individuals).toBe(30);
    expect(getRequestIndividuals({ rows: [row], totals: { male: 100, female: 100 } })).toBe(30);
  });

  test("uses male and female totals for legacy requests without rows", () => {
    const totals = { male: 4, female: 6, lgbtq: 2, pwd: 3, pregnant: 1, senior: 2, individuals: 18 };
    expect(getRequestIndividuals({ totals })).toBe(10);
    expect(getRequestIndividuals({ rows: [], totals })).toBe(10);
    expect(getRequestIndividuals({ rows: [{ isActiveRow: false, male: 4, female: 6 }], totals })).toBe(0);
    expect(getRequestIndividuals()).toBe(0);
  });

  test("labels rejected request follow-up as resubmitted instead of edited", () => {
    expect(
      getRequestEditBadgeLabel({
        isEditedAfterSubmit: true,
        lastEditAction: "resubmitted",
      })
    ).toBe("Resubmitted");

    expect(
      getRequestEditBadgeLabel({
        isEditedAfterSubmit: true,
        lastEditAction: "updated",
      })
    ).toBe("Edited");
  });
});
