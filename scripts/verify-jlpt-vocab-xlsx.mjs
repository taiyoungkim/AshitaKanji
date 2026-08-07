#!/usr/bin/env node

import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const projectRoot = process.env.JLPT_PROJECT_ROOT;
if (!projectRoot) {
  throw new Error("JLPT_PROJECT_ROOT is required");
}

const workbookPath = path.join(
  projectRoot,
  "data",
  "pdf-vocab",
  "jlpt_vocab.xlsx",
);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));

const expected = {
  "App Vocabulary": { rows: 2700, columns: 19 },
  "Master Vocabulary": { rows: 2927, columns: 19 },
  "Source Entries": { rows: 3864, columns: 25 },
  README: { rows: 20, columns: 4 },
};
const actual = {};
for (const [sheetName, expectation] of Object.entries(expected)) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const values = sheet.getUsedRange(true).values;
  actual[sheetName] = { rows: values.length, columns: values[0]?.length ?? 0 };
  if (
    actual[sheetName].rows !== expectation.rows ||
    actual[sheetName].columns !== expectation.columns
  ) {
    throw new Error(
      `${sheetName}: actual=${JSON.stringify(actual[sheetName])}, expected=${JSON.stringify(expectation)}`,
    );
  }
}

const summary = workbook.worksheets.getItem("README").getRange("B4:B9").values.flat();
const expectedSummary = [7, 3863, 2926, 2699, 1983, 0];
if (summary.some((value, index) => Number(value) !== expectedSummary[index])) {
  throw new Error(
    `README summary mismatch: ${JSON.stringify(summary)} expected=${JSON.stringify(expectedSummary)}`,
  );
}

const formulaInspection = await workbook.inspect({
  kind: "formula",
  sheetId: "README",
  range: "B4:B9",
  maxChars: 3000,
  options: { maxResults: 20 },
});

console.log(JSON.stringify({ workbookPath, actual, summary }, null, 2));
console.log(formulaInspection.ndjson);
