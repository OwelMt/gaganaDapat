import {
  deriveImportedSupportTypes,
  shouldShowConfirmReceivedAction,
} from "./reliefImportUtils";
import {
  SUPPORT_TYPE_APPLIANCE,
  SUPPORT_TYPE_FOODPACKS,
  SUPPORT_TYPE_MONETARY,
} from "./supportTypes";

describe("reliefImportUtils", () => {
  test("derives food packs plus appliance when imported rows include appliance data and food packs", () => {
    expect(
      deriveImportedSupportTypes({
        importedRequestType: "",
        derivedFoodPackTotal: 120,
        importedMonetaryAmount: 0,
        importedAppliances: [
          { itemName: "Electric Fan", category: "Cooling Appliances", quantityRequested: "10" },
        ],
        previousSupportTypes: [SUPPORT_TYPE_FOODPACKS],
      })
    ).toEqual([SUPPORT_TYPE_FOODPACKS, SUPPORT_TYPE_APPLIANCE]);
  });

  test("forces imported monetary plus appliance back to standalone monetary", () => {
    expect(
      deriveImportedSupportTypes({
        importedRequestType: "",
        derivedFoodPackTotal: 0,
        importedMonetaryAmount: 1000,
        importedAppliances: [
          { itemName: "Electric Fan", category: "Cooling Appliances", quantityRequested: "10" },
        ],
        previousSupportTypes: [SUPPORT_TYPE_MONETARY],
      })
    ).toEqual([SUPPORT_TYPE_MONETARY]);
  });

  test("forces imported all-support rows back to standalone monetary when cash is present", () => {
    expect(
      deriveImportedSupportTypes({
        importedRequestType: "",
        derivedFoodPackTotal: 110,
        importedMonetaryAmount: 1000,
        importedAppliances: [
          { itemName: "Electric Fan", category: "Cooling Appliances", quantityRequested: "10" },
        ],
        previousSupportTypes: [SUPPORT_TYPE_FOODPACKS, SUPPORT_TYPE_MONETARY],
      })
    ).toEqual([SUPPORT_TYPE_MONETARY]);
  });

  test("shows confirm received for waiting receipt journey even if canReceiveAnyRelease was not provided", () => {
    expect(
      shouldShowConfirmReceivedAction({
        canReceiveAnyRelease: false,
        stage: "released_waiting_receipt",
        requestStatus: "released",
        releaseRecords: [{ releaseStatus: "released" }],
      })
    ).toBe(true);
  });

  test("hides confirm received when there are no pending release records left", () => {
    expect(
      shouldShowConfirmReceivedAction({
        canReceiveAnyRelease: true,
        stage: "completed",
        requestStatus: "received",
        releaseRecords: [{ releaseStatus: "received" }],
        hasReceiptEvidence: true,
      })
    ).toBe(false);
  });

  test("keeps confirm received visible for step 4 requests that still have release history to confirm", () => {
    expect(
      shouldShowConfirmReceivedAction({
        canReceiveAnyRelease: false,
        stage: "released_waiting_receipt",
        requestStatus: "released",
        releaseRecords: [{ releaseStatus: "unknown", items: [{ itemName: "Rice" }] }],
        hasReceiptEvidence: false,
      })
    ).toBe(true);
  });

    test("hides confirm received once receipt evidence already exists", () => {
      expect(
        shouldShowConfirmReceivedAction({
          canReceiveAnyRelease: false,
          stage: "released_waiting_receipt",
          requestStatus: "released",
          releaseRecords: [{ releaseStatus: "received", items: [{ itemName: "Rice" }] }],
          hasReceiptEvidence: true,
        })
      ).toBe(false);
    });
  });


describe("spreadsheet population validation", () => {
  const { getReliefImportPopulationIssues } = require("./reliefImportUtils");
  test("reports original worksheet row and does not silently fix totals", () => {
    expect(getReliefImportPopulationIssues([{ "Evacuation Center": "Hall", Male: 40, Female: 40, "Total Individuals": 89 }])).toEqual([expect.stringMatching(/Row 2.*Individuals.*80/)]);
  });
  test("validates raw counts before coercion", () => {
    expect(getReliefImportPopulationIssues([{ "Evacuation Center": "Hall", Male: "bad", Female: 40 }])).toEqual([expect.stringMatching(/Row 2.*Male/)]);
  });
  test("accepts existing spreadsheets without Individuals and valid overlap", () => {
    expect(getReliefImportPopulationIssues([{ "Evacuation Center": "Hall", Male: 40, Female: 40, Senior: 80, PWD: 80 }])).toEqual([]);
  });
});


test("allows appliance-only continuation rows alongside a valid evacuation row", () => {
  const { getReliefImportPopulationIssues } = require("./reliefImportUtils");
  expect(getReliefImportPopulationIssues([
    { "Evacuation Center": "Hall", Male: 40, Female: 40 },
    { "Appliance Name": "Fan", "Appliance Category": "Cooling", "Appliance Quantity": 2 }
  ])).toEqual([]);
});


test("reads real XLSX headers and counts before validating the supplied total", () => {
  const XLSX = require("xlsx");
  const { getReliefImportPopulationIssues } = require("./reliefImportUtils");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { "Evacuation Center": "Hall", Male: 40, Female: 40, "Total Individuals": 89 },
    { "Evacuation Center": "School", Male: 30, Female: 45, "Total Individuals": 75, Pregnant: 10, Senior: 20 }
  ]), "Requests");
  const read = XLSX.read(XLSX.write(workbook, { type: "array", bookType: "xlsx" }), { type: "array" });
  const rows = XLSX.utils.sheet_to_json(read.Sheets.Requests, { defval: "", raw: false });
  expect(getReliefImportPopulationIssues(rows)).toEqual([expect.stringMatching(/Row 2.*Individuals.*80/)]);
});
