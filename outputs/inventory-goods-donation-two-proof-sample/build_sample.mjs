import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs/inventory-goods-donation-two-proof-sample");
const fontFamily = "Arial";

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Goods Donations");
sheet.showGridLines = false;

const headers = [
  "Item Name",
  "Category",
  "Quantity",
  "Unit",
  "Expiration Date",
  "Source Type",
  "Source Name",
  "Description",
];

const rows = [
  [
    "Rice",
    "food",
    40,
    "sacks",
    new Date(2028, 5, 30),
    "Donated",
    "Sample Community Donor A",
    "Proof files: row-2-rice-document.pdf and row-2-rice-image.png",
  ],
  [
    "Bottled Water",
    "water",
    24,
    "cases",
    new Date(2027, 8, 30),
    "Donated",
    "Sample Community Donor B",
    "Proof files: row-3-water-document.pdf and row-3-water-image.png",
  ],
];

sheet.getRange("A1:H1").values = [headers];
sheet.getRange("A2:H3").values = rows;

sheet.getRange("A1:H3").format.font = { name: fontFamily, size: 10, color: "#12351f" };
sheet.getRange("A1:H1").format = {
  fill: "#1f7a37",
  font: { name: fontFamily, bold: true, color: "#ffffff", size: 10 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A1:H3").format.borders = { preset: "all", style: "thin", color: "#c8ddca" };
sheet.getRange("A2:H3").format.verticalAlignment = "center";
sheet.getRange("A2:B3").format.horizontalAlignment = "left";
sheet.getRange("F2:H3").format.horizontalAlignment = "left";
sheet.getRange("C2:C3").format.numberFormat = "#,##0";
sheet.getRange("E2:E3").format.numberFormat = "yyyy-mm-dd";

sheet.getRange("A:A").format.columnWidth = 18;
sheet.getRange("B:B").format.columnWidth = 14;
sheet.getRange("C:C").format.columnWidth = 11;
sheet.getRange("D:D").format.columnWidth = 12;
sheet.getRange("E:E").format.columnWidth = 16;
sheet.getRange("F:F").format.columnWidth = 14;
sheet.getRange("G:G").format.columnWidth = 26;
sheet.getRange("H:H").format.columnWidth = 62;
sheet.getRange("H2:H3").format.wrapText = true;
sheet.getRange("1:1").format.rowHeight = 24;
sheet.getRange("2:3").format.rowHeight = 42;

sheet.freezePanes.freezeRows(1);

workbook.recalculate();

const preview = await workbook.render({
  sheetName: "Goods Donations",
  range: "A1:H3",
  scale: 2,
  format: "png",
});
await fs.writeFile(path.join(outputDir, "inventory-goods-donation-two-sample-preview.png"), new Uint8Array(await preview.arrayBuffer()));

const inspected = await workbook.inspect({
  kind: "table",
  sheetId: "Goods Donations",
  range: "A1:H3",
  include: "values,formulas",
  tableMaxRows: 4,
  tableMaxCols: 8,
});
await fs.writeFile(path.join(outputDir, "workbook-inspection.ndjson"), inspected.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
await fs.writeFile(path.join(outputDir, "formula-error-scan.ndjson"), errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "inventory-goods-donation-two-sample.xlsx"));

