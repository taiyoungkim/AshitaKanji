#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = process.env.JLPT_PROJECT_ROOT;
if (!projectRoot) {
  throw new Error("JLPT_PROJECT_ROOT is required");
}

const outputDir = path.join(projectRoot, "data", "pdf-vocab");
const previewDir = path.join(projectRoot, "tmp");

const readText = async (filename) =>
  (await fs.readFile(path.join(outputDir, filename), "utf8")).replace(/^\uFEFF/, "");

const [appCsv, masterCsv, sourceCsv, reportText] = await Promise.all([
  readText("jlpt_app_vocab.csv"),
  readText("jlpt_vocab_master.csv"),
  readText("jlpt_source_entries.csv"),
  readText("extraction_report.json"),
]);
const report = JSON.parse(reportText);

const [workbook, masterImport, sourceImport] = await Promise.all([
  Workbook.fromCSV(appCsv, { sheetName: "App Vocabulary" }),
  Workbook.fromCSV(masterCsv, { sheetName: "Master Vocabulary" }),
  Workbook.fromCSV(sourceCsv, { sheetName: "Source Entries" }),
]);

const masterSheet = workbook.worksheets.add("Master Vocabulary");
const masterValues = masterImport.worksheets
  .getItem("Master Vocabulary")
  .getUsedRange(true).values;
masterSheet
  .getRangeByIndexes(0, 0, masterValues.length, masterValues[0].length)
  .values = masterValues;

const sourceSheet = workbook.worksheets.add("Source Entries");
const sourceValues = sourceImport.worksheets
  .getItem("Source Entries")
  .getUsedRange(true).values;
sourceSheet
  .getRangeByIndexes(0, 0, sourceValues.length, sourceValues[0].length)
  .values = sourceValues;

const readme = workbook.worksheets.add("README");

const appRows = report.summary.app_entries;
const masterRows = report.summary.master_entries;
const sourceRows = report.summary.source_entries;

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function styleDataSheet(sheetName, rowCount, colCount, tableName, widths) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const lastColumn = columnName(colCount - 1);
  const fullRange = sheet.getRange(`A1:${lastColumn}${rowCount + 1}`);
  fullRange.format = {
    font: { name: "Aptos", size: 10, color: "#1F2937" },
    verticalAlignment: "top",
  };
  const header = sheet.getRange(`A1:${lastColumn}1`);
  header.format = {
    fill: "#0F766E",
    font: { name: "Aptos", size: 10, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    rowHeight: 30,
  };
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}1:${column}${rowCount + 1}`).format.columnWidth = width;
  }
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(sheetName === "Source Entries" ? 5 : 4);
  sheet.showGridLines = false;
  const table = sheet.tables.add(
    `A1:${lastColumn}${rowCount + 1}`,
    true,
    tableName,
  );
  table.style = "TableStyleMedium2";
  table.showFilterButton = true;
}

styleDataSheet("App Vocabulary", appRows, 19, "AppVocabularyTable", {
  A: 20,
  B: 12,
  C: 12,
  D: 18,
  E: 18,
  F: 18,
  G: 34,
  H: 38,
  I: 15,
  J: 13,
  K: 13,
  L: 20,
  M: 34,
  N: 12,
  O: 22,
  P: 20,
  Q: 13,
  R: 30,
  S: 44,
});

styleDataSheet("Master Vocabulary", masterRows, 19, "MasterVocabularyTable", {
  A: 20,
  B: 12,
  C: 12,
  D: 18,
  E: 18,
  F: 18,
  G: 34,
  H: 38,
  I: 15,
  J: 13,
  K: 13,
  L: 20,
  M: 34,
  N: 12,
  O: 22,
  P: 20,
  Q: 13,
  R: 30,
  S: 44,
});

styleDataSheet("Source Entries", sourceRows, 25, "SourceEntriesTable", {
  A: 24,
  B: 14,
  C: 34,
  D: 12,
  E: 9,
  F: 9,
  G: 12,
  H: 10,
  I: 15,
  J: 15,
  K: 28,
  L: 22,
  M: 38,
  N: 28,
  O: 22,
  P: 22,
  Q: 38,
  R: 13,
  S: 13,
  T: 22,
  U: 12,
  V: 14,
  W: 14,
  X: 13,
  Y: 44,
});

readme.showGridLines = false;
readme.getRange("A1:H1").merge();
readme.getRange("A1").values = [["JLPT PDF Vocabulary Export"]];
readme.getRange("A1:H1").format = {
  fill: "#0F766E",
  font: { name: "Aptos Display", size: 18, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "left",
  verticalAlignment: "center",
  rowHeight: 38,
};
readme.getRange("A3:B3").values = [["Dataset", "Count"]];
readme.getRange("A4:A9").values = [
  ["Source PDF files"],
  ["Source occurrences"],
  ["Deduplicated master"],
  ["App-ready vocabulary"],
  ["Existing app exact matches"],
  ["QA review remaining"],
];
readme.getRange("B4:B9").formulas = [
  ["=COUNTA(A14:A20)"],
  [`=COUNTA('Source Entries'!A2:A${sourceRows + 1})`],
  [`=COUNTA('Master Vocabulary'!A2:A${masterRows + 1})`],
  [`=COUNTA('App Vocabulary'!A2:A${appRows + 1})`],
  [`=COUNTIF('Source Entries'!V2:V${sourceRows + 1},\"exact\")`],
  [`=COUNTIF('Source Entries'!X2:X${sourceRows + 1},\"needs_review\")`],
];
readme.getRange("A3:B9").format = {
  font: { name: "Aptos", size: 11, color: "#1F2937" },
  borders: { color: "#D1D5DB", style: "continuous", weight: 1 },
};
readme.getRange("A3:B3").format = {
  fill: "#CCFBF1",
  font: { name: "Aptos", size: 11, bold: true, color: "#115E59" },
};
readme.getRange("B4:B9").format.numberFormat = "#,##0";

readme.getRange("D3:H3").merge();
readme.getRange("D3").values = [["How to use"]];
readme.getRange("D4:H9").merge();
readme.getRange("D4").values = [[
  "App Vocabulary: 표제어·읽기·한국어 뜻이 모두 있는 단어형 항목만 수록\n" +
    "Master Vocabulary: 표제어+읽기로 중복 통합한 전체 목록\n" +
    "Source Entries: PDF에 인쇄된 모든 출현 항목과 페이지·순서 보존\n" +
    "JSON/CSV와 동일한 필드명을 사용하므로 앱 데이터 변환에 바로 연결할 수 있습니다.",
]];
readme.getRange("D3:H3").format = {
  fill: "#CCFBF1",
  font: { name: "Aptos", size: 11, bold: true, color: "#115E59" },
};
readme.getRange("D4:H9").format = {
  fill: "#F0FDFA",
  font: { name: "Aptos", size: 11, color: "#134E4A" },
  verticalAlignment: "top",
  wrapText: true,
};

readme.getRange("A12:H12").merge();
readme.getRange("A12").values = [["Source PDFs"]];
readme.getRange("A12:H12").format = {
  fill: "#334155",
  font: { name: "Aptos", size: 11, bold: true, color: "#FFFFFF" },
};
readme.getRange("A13:D13").values = [["source_id", "level", "pages", "filename"]];
const sourceRowsMatrix = report.sources.map((source) => [
  source.source_id,
  source.source_id.split("_")[1].toUpperCase(),
  `${Math.min(...Object.keys(source.page_counts).map(Number))}-${Math.max(...Object.keys(source.page_counts).map(Number))}`,
  source.source_id.startsWith("mkt_")
    ? `MKT_JLPT_word-${source.source_id.split("_")[1].toUpperCase()}.pdf`
    : `일단합격JLPT완벽대비${source.source_id.split("_")[1].toUpperCase()}-단어장.pdf`,
]);
readme.getRange(`A14:D${13 + sourceRowsMatrix.length}`).values = sourceRowsMatrix;
readme.getRange(`A13:D${13 + sourceRowsMatrix.length}`).format = {
  font: { name: "Aptos", size: 10, color: "#1F2937" },
  borders: { color: "#E2E8F0", style: "continuous", weight: 1 },
};
readme.getRange("A13:D13").format = {
  fill: "#E2E8F0",
  font: { name: "Aptos", size: 10, bold: true, color: "#334155" },
};
readme.getRange("A1:A20").format.columnWidth = 24;
readme.getRange("B1:B20").format.columnWidth = 16;
readme.getRange("C1:C20").format.columnWidth = 12;
readme.getRange("D1:D20").format.columnWidth = 34;
for (const column of ["E", "F", "G", "H"]) {
  readme.getRange(`${column}1:${column}20`).format.columnWidth = 18;
}
readme.freezePanes.freezeRows(1);

await fs.mkdir(previewDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "README",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(previewDir, "jlpt-vocab-xlsx-preview.png"),
  new Uint8Array(await preview.arrayBuffer()),
);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "jlpt_vocab.xlsx"));

const inspection = await workbook.inspect({
  kind: "sheet,region,formula",
  sheetId: "README",
  range: "A1:H20",
  maxChars: 6000,
  options: { maxResults: 80 },
});
console.log(inspection.ndjson);
