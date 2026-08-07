#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = process.env.VOCAB_PROJECT_ROOT;
const outputDir = process.env.VOCAB_OUTPUT_DIR;
if (!projectRoot || !outputDir) {
  throw new Error("VOCAB_PROJECT_ROOT and VOCAB_OUTPUT_DIR are required");
}

const inputPath = path.join(
  projectRoot,
  "data",
  "pdf-vocab",
  "replacement_candidates.json",
);
const report = JSON.parse(await fs.readFile(inputPath, "utf8"));
const candidates = report.candidates;

const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add("요약");
const candidateSheet = workbook.worksheets.add("제외 후보");
const variantSheet = workbook.worksheets.add("변형 그룹");
const scoreSheet = workbook.worksheets.add("점수 감사");
const rulesSheet = workbook.worksheets.add("선정 규칙");

const colors = {
  navy: "#0F172A",
  slate: "#334155",
  teal: "#0F766E",
  tealLight: "#CCFBF1",
  blueLight: "#DBEAFE",
  amberLight: "#FEF3C7",
  redLight: "#FEE2E2",
  greenLight: "#DCFCE7",
  grayLight: "#F1F5F9",
  border: "#CBD5E1",
  text: "#1F2937",
  white: "#FFFFFF",
};

function columnName(index) {
  let value = index + 1;
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

function styleTitle(sheet, range, title) {
  sheet.getRange(range).merge();
  const cell = sheet.getRange(range.split(":")[0]);
  cell.values = [[title]];
  sheet.getRange(range).format = {
    fill: colors.navy,
    font: {
      name: "Aptos Display",
      size: 18,
      bold: true,
      color: colors.white,
    },
    horizontalAlignment: "left",
    verticalAlignment: "center",
    rowHeight: 38,
  };
}

function styleTableSheet(sheet, rowCount, colCount, tableName, widths) {
  const lastColumn = columnName(colCount - 1);
  const used = sheet.getRange(`A1:${lastColumn}${rowCount + 1}`);
  used.format = {
    font: { name: "Aptos", size: 10, color: colors.text },
    verticalAlignment: "top",
  };
  const header = sheet.getRange(`A1:${lastColumn}1`);
  header.format = {
    fill: colors.teal,
    font: { name: "Aptos", size: 10, bold: true, color: colors.white },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    rowHeight: 32,
  };
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}1:${column}${rowCount + 1}`).format.columnWidth = width;
  }
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(7);
  sheet.showGridLines = false;
  const table = sheet.tables.add(`A1:${lastColumn}${rowCount + 1}`, true, tableName);
  table.style = "TableStyleMedium2";
  table.showFilterButton = true;
}

// Candidate list
const candidateHeaders = [
  "전체순위",
  "단계",
  "권장조치",
  "신뢰도",
  "급수",
  "급수내순위",
  "단어ID",
  "표기",
  "읽기",
  "한국어뜻",
  "품사",
  "Zipf빈도",
  "예문",
  "제거점수",
  "주요사유",
  "사유코드",
  "변형그룹",
  "변형관계",
  "대표단어ID",
  "대표표기",
  "대표읽기",
  "대표가최빈출",
  "JMdict일치",
  "JMdict우선태그",
  "JMdict우선점수",
  "JMdict표기우선태그",
  "JMdict표기우선점수",
  "JMdict정보",
  "기존뜻감사",
  "기존태그",
  "검토결정",
  "검토메모",
];
const candidateValues = candidates.map((row) => [
  row.selected_rank,
  row.candidate_stage,
  row.recommended_action,
  row.confidence,
  row.level,
  row.level_rank,
  row.word_id,
  row.surface,
  row.reading_kana,
  row.meaning_ko,
  row.part_of_speech,
  row.frequency,
  row.has_example ? "있음" : "없음",
  row.retire_score,
  row.reason_ko,
  row.reason_codes,
  row.variant_group_id,
  row.variant_relationship,
  row.canonical_word_id,
  row.canonical_surface,
  row.canonical_reading,
  row.canonical_is_core ? "예" : "아니오",
  row.jmdict_exact_match ? "예" : "아니오",
  row.jmdict_priority,
  row.jmdict_priority_score,
  row.jmdict_form_priority,
  row.jmdict_form_priority_score,
  row.jmdict_info,
  row.legacy_gloss_audit,
  row.legacy_tags,
  row.review_decision,
  row.review_note,
]);
candidateSheet
  .getRangeByIndexes(0, 0, candidateValues.length + 1, candidateHeaders.length)
  .values = [candidateHeaders, ...candidateValues];
styleTableSheet(
  candidateSheet,
  candidateValues.length,
  candidateHeaders.length,
  "ReplacementCandidatesTable",
  {
    A: 10,
    B: 17,
    C: 22,
    D: 10,
    E: 9,
    F: 12,
    G: 22,
    H: 18,
    I: 20,
    J: 34,
    K: 14,
    L: 11,
    M: 9,
    N: 11,
    O: 48,
    P: 42,
    Q: 13,
    R: 28,
    S: 22,
    T: 18,
    U: 18,
    V: 14,
    W: 13,
    X: 24,
    Y: 14,
    Z: 24,
    AA: 17,
    AB: 45,
    AC: 19,
    AD: 34,
    AE: 14,
    AF: 30,
  },
);
candidateSheet.getRange(`J2:J${candidateValues.length + 1}`).format.wrapText = true;
candidateSheet.getRange(`O2:P${candidateValues.length + 1}`).format.wrapText = true;
candidateSheet.getRange(`AB2:AF${candidateValues.length + 1}`).format.wrapText = true;
candidateSheet.getRange(`L2:L${candidateValues.length + 1}`).format.numberFormat = "0.00";
candidateSheet.getRange(`A2:A${candidateValues.length + 1}`).format.numberFormat = "#,##0";
candidateSheet.getRange(`F2:F${candidateValues.length + 1}`).format.numberFormat = "#,##0";
candidateSheet.getRange(`N2:N${candidateValues.length + 1}`).format.numberFormat = "0";
candidateSheet.getRange(`AE2:AE${candidateValues.length + 1}`).dataValidation = {
  rule: { type: "list", values: ["검토 필요", "제외 확정", "유지", "표기 교정"] },
};
candidateSheet
  .getRange(`B2:B${candidateValues.length + 1}`)
  .conditionalFormats.add("containsText", {
    text: "1차 제외 추천",
    format: { fill: colors.redLight, font: { color: "#991B1B", bold: true } },
  });
candidateSheet
  .getRange(`B2:B${candidateValues.length + 1}`)
  .conditionalFormats.add("containsText", {
    text: "1차 검토 후보",
    format: { fill: colors.amberLight, font: { color: "#92400E" } },
  });
candidateSheet
  .getRange(`B2:B${candidateValues.length + 1}`)
  .conditionalFormats.add("containsText", {
    text: "2차 보류",
    format: { fill: colors.grayLight, font: { color: colors.slate } },
  });

// Variant groups, one row per member.
const variantHeaders = [
  "그룹ID",
  "관계",
  "대표단어ID",
  "대표표기",
  "대표읽기",
  "대표가최빈출",
  "핵심멤버수",
  "그룹크기",
  "멤버단어ID",
  "멤버급수",
  "멤버표기",
  "멤버읽기",
  "멤버뜻",
  "Zipf빈도",
  "최빈출핵심",
  "대표여부",
];
const variantValues = report.variant_groups.flatMap((group) =>
  group.members.map((member) => [
    group.group_id,
    group.relationship,
    group.canonical_word_id,
    group.canonical_surface,
    group.canonical_reading,
    group.canonical_is_core ? "예" : "아니오",
    group.core_member_count,
    group.member_count,
    member.word_id,
    member.level,
    member.surface,
    member.reading_kana,
    member.meaning_ko,
    member.frequency,
    member.is_core ? "예" : "아니오",
    member.is_canonical ? "예" : "아니오",
  ]),
);
variantSheet
  .getRangeByIndexes(0, 0, variantValues.length + 1, variantHeaders.length)
  .values = [variantHeaders, ...variantValues];
styleTableSheet(variantSheet, variantValues.length, variantHeaders.length, "VariantGroupsTable", {
  A: 12,
  B: 32,
  C: 22,
  D: 18,
  E: 18,
  F: 14,
  G: 13,
  H: 12,
  I: 22,
  J: 10,
  K: 18,
  L: 18,
  M: 36,
  N: 11,
  O: 12,
  P: 12,
});
variantSheet.getRange(`M2:M${variantValues.length + 1}`).format.wrapText = true;
variantSheet.getRange(`N2:N${variantValues.length + 1}`).format.numberFormat = "0.00";

// Visible scoring weights.
styleTitle(rulesSheet, "A1:D1", "선정 규칙과 점수 가중치");
rulesSheet.getRange("A3:C3").values = [["신호", "점수", "설명"]];
const weightRows = [
  ["variant_duplicate", 60, "대표 표제어가 별도로 존재하는 변형"],
  ["jmdict_severe", 50, "희귀·검색 전용·비표준 표기"],
  ["jmdict_rare", 35, "희귀·구식 읽기/표기"],
  ["unmatched_kanji", 35, "한자 표기+읽기 조합이 JMdict에 없음"],
  ["frequency_missing", 40, "Zipf 빈도 없음 또는 0"],
  ["frequency_le_1_5", 32, "Zipf ≤ 1.5"],
  ["frequency_le_2_0", 26, "Zipf ≤ 2.0"],
  ["frequency_le_2_5", 20, "Zipf ≤ 2.5"],
  ["frequency_le_3_0", 12, "Zipf ≤ 3.0"],
  ["frequency_le_3_5", 6, "Zipf ≤ 3.5"],
  ["frequency_ge_4_5", -20, "Zipf ≥ 4.5 보호"],
  ["no_jmdict_priority", 12, "JMdict 우선 태그 없음"],
  ["top_jmdict_priority", -25, "JMdict 최상위 우선 태그 보호"],
  ["other_jmdict_priority", -12, "기타 JMdict 우선 태그 보호"],
  ["has_example", -25, "검증된 예문 보유 보호"],
  ["no_example", 6, "검증된 예문 없음"],
  ["legacy_freq_core", -30, "기존 freq-core 태그 보호"],
  ["weak_legacy_content", 5, "기존 콘텐츠 보강 필요"],
  ["legacy_gloss_audit", 10, "기존 한국어 뜻 품질 감사 대상"],
];
rulesSheet.getRange(`A4:C${3 + weightRows.length}`).values = weightRows;
rulesSheet.getRange(`A3:C${3 + weightRows.length}`).format = {
  font: { name: "Aptos", size: 10, color: colors.text },
  borders: { preset: "inside", style: "thin", color: colors.border },
};
rulesSheet.getRange("A3:C3").format = {
  fill: colors.teal,
  font: { name: "Aptos", size: 10, bold: true, color: colors.white },
};
rulesSheet.getRange("B4:B22").format.numberFormat = "0";
rulesSheet.getRange("A25:D25").merge();
rulesSheet.getRange("A25").values = [["운영 원칙"]];
rulesSheet.getRange("A25:D25").format = {
  fill: colors.slate,
  font: { name: "Aptos", size: 11, bold: true, color: colors.white },
};
const ruleText = report.rules.map((rule, index) => [`${index + 1}. ${rule}`]);
rulesSheet.getRange(`A26:D${25 + ruleText.length}`).merge(true);
rulesSheet.getRange(`A26:A${25 + ruleText.length}`).values = ruleText;
rulesSheet.getRange(`A26:D${25 + ruleText.length}`).format = {
  fill: colors.grayLight,
  font: { name: "Aptos", size: 10, color: colors.text },
  wrapText: true,
  rowHeight: 28,
};
rulesSheet.getRange("A1:A35").format.columnWidth = 28;
rulesSheet.getRange("B1:B35").format.columnWidth = 12;
rulesSheet.getRange("C1:C35").format.columnWidth = 48;
rulesSheet.getRange("D1:D35").format.columnWidth = 16;
rulesSheet.freezePanes.freezeRows(3);
rulesSheet.showGridLines = false;

// Formula-driven score reconstruction.
const scoreHeaders = [
  "단어ID",
  "변형",
  "JMdict표기",
  "JMdict불일치",
  "빈도",
  "우선태그",
  "예문",
  "freq-core",
  "기존콘텐츠",
  "뜻감사",
  "수식점수",
  "분석점수",
  "검증",
];
scoreSheet.getRange(`A1:M${candidateValues.length + 1}`).format = {
  font: { name: "Aptos", size: 10, color: colors.text },
};
scoreSheet.getRange("A1:M1").values = [scoreHeaders];
scoreSheet.getRange(`A2:A${candidateValues.length + 1}`).formulas = candidates.map(
  (_, index) => [`='제외 후보'!G${index + 2}`],
);
for (let index = 0; index < candidates.length; index += 1) {
  const row = index + 2;
  scoreSheet.getRange(`B${row}:M${row}`).formulas = [[
    `=IF('제외 후보'!Q${row}<>"",'선정 규칙'!$B$4,0)`,
    `=IF(ISNUMBER(SEARCH("jmdict_uncommon_or_irregular",'제외 후보'!P${row})),'선정 규칙'!$B$5,IF(ISNUMBER(SEARCH("jmdict_rare_or_dated",'제외 후보'!P${row})),'선정 규칙'!$B$6,0))`,
    `=IF(ISNUMBER(SEARCH("jmdict_exact_pair_not_found",'제외 후보'!P${row})),'선정 규칙'!$B$7,0)`,
    `=IF(OR('제외 후보'!L${row}="",'제외 후보'!L${row}<=0),'선정 규칙'!$B$8,IF('제외 후보'!L${row}<=1.5,'선정 규칙'!$B$9,IF('제외 후보'!L${row}<=2,'선정 규칙'!$B$10,IF('제외 후보'!L${row}<=2.5,'선정 규칙'!$B$11,IF('제외 후보'!L${row}<=3,'선정 규칙'!$B$12,IF('제외 후보'!L${row}<=3.5,'선정 규칙'!$B$13,IF('제외 후보'!L${row}>=4.5,'선정 규칙'!$B$14,0)))))))`,
    `=IF('제외 후보'!Y${row}=0,'선정 규칙'!$B$15,IF('제외 후보'!Y${row}>=100,'선정 규칙'!$B$16,'선정 규칙'!$B$17))`,
    `=IF('제외 후보'!M${row}="있음",'선정 규칙'!$B$18,'선정 규칙'!$B$19)`,
    `=IF(ISNUMBER(SEARCH("freq-core",'제외 후보'!AD${row})),'선정 규칙'!$B$20,0)`,
    `=IF(ISNUMBER(SEARCH("weak_legacy_content",'제외 후보'!P${row})),'선정 규칙'!$B$21,0)`,
    `=IF('제외 후보'!AC${row}<>"",'선정 규칙'!$B$22,0)`,
    `=SUM(B${row}:J${row})`,
    `='제외 후보'!N${row}`,
    `=IF(K${row}=L${row},"OK","MISMATCH")`,
  ]];
}
styleTableSheet(scoreSheet, candidateValues.length, scoreHeaders.length, "ScoreAuditTable", {
  A: 22,
  B: 11,
  C: 13,
  D: 15,
  E: 11,
  F: 13,
  G: 11,
  H: 12,
  I: 14,
  J: 12,
  K: 12,
  L: 12,
  M: 14,
});
scoreSheet.getRange(`B2:L${candidateValues.length + 1}`).format.numberFormat = "0";
scoreSheet
  .getRange(`M2:M${candidateValues.length + 1}`)
  .conditionalFormats.add("containsText", {
    text: "MISMATCH",
    format: { fill: colors.redLight, font: { color: "#991B1B", bold: true } },
  });

// Summary dashboard.
styleTitle(summarySheet, "A1:H1", "JLPT 단어장 교체 후보 — 1차 선별");
summarySheet.getRange("A3:B3").values = [["핵심 지표", "값"]];
summarySheet.getRange("A4:A11").values = [
  ["현재 활성 단어"],
  ["PDF 최빈출 핵심"],
  ["기존 핵심 일치"],
  ["신규 핵심 추가"],
  ["전체 교체 순위"],
  ["1차 제외 추천"],
  ["1차 검토 후보"],
  ["2차 보류"],
];
summarySheet.getRange("B4:B11").formulas = [
  [`=${report.summary.current_active}`],
  [`=${report.summary.pdf_core_total}`],
  [`=${report.summary.pdf_core_existing}`],
  ["=B5-B6"],
  [`=COUNTA('제외 후보'!A2:A${candidateValues.length + 1})`],
  [`=COUNTIF('제외 후보'!B2:B${candidateValues.length + 1},"1차 제외 추천")`],
  [`=COUNTIF('제외 후보'!B2:B${candidateValues.length + 1},"1차 검토 후보")`],
  [`=COUNTIF('제외 후보'!B2:B${candidateValues.length + 1},"2차 보류")`],
];
summarySheet.getRange("A3:B11").format = {
  font: { name: "Aptos", size: 11, color: colors.text },
  borders: { preset: "inside", style: "thin", color: colors.border },
};
summarySheet.getRange("A3:B3").format = {
  fill: colors.teal,
  font: { name: "Aptos", size: 11, bold: true, color: colors.white },
};
summarySheet.getRange("B4:B11").format.numberFormat = "#,##0";

summarySheet.getRange("D3:H3").merge();
summarySheet.getRange("D3").values = [["판정 안내"]];
summarySheet.getRange("D4:H11").merge();
summarySheet.getRange("D4").values = [[
  "1차 제외 추천: 대표 표기가 이미 있어 중복 제거 근거가 강한 행\n" +
    "1차 검토 후보: 저빈도·비표준 표기 등 근거는 있으나 의미 차이 확인 필요\n" +
    "2차 보류: 1,346개 수량을 맞춘 상대 순위이며 아직 삭제 확정이 아님\n\n" +
    "최빈출 2,699개는 후보에서 전부 보호했습니다. 급수별 수량을 억지로 유지하지 않아 고빈도 초급 단어가 과도하게 빠지는 것을 막았습니다.",
]];
summarySheet.getRange("D3:H3").format = {
  fill: colors.teal,
  font: { name: "Aptos", size: 11, bold: true, color: colors.white },
};
summarySheet.getRange("D4:H11").format = {
  fill: colors.tealLight,
  font: { name: "Aptos", size: 11, color: "#134E4A" },
  verticalAlignment: "top",
  wrapText: true,
};

summarySheet.getRange("A14:H14").values = [[
  "급수",
  "현재",
  "최종 핵심",
  "제외 순위",
  "기존 보충 유지",
  "교체 후",
  "증감",
  "총수 검증",
]];
const levelStart = 15;
const levels = ["N5", "N4", "N3", "N2", "N1"];
for (let index = 0; index < levels.length; index += 1) {
  const level = levels[index];
  const row = levelStart + index;
  const quota = report.quotas[level];
  summarySheet.getRange(`A${row}:C${row}`).values = [[
    level,
    quota.current,
    quota.core_final,
  ]];
  summarySheet.getRange(`D${row}:H${row}`).formulas = [[
    `=COUNTIF('제외 후보'!E$2:E$${candidateValues.length + 1},A${row})`,
    `=${quota.noncore_pool}-D${row}`,
    `=C${row}+E${row}`,
    `=F${row}-B${row}`,
    `=IF(F${row}>0,"OK","CHECK")`,
  ]];
}
summarySheet.getRange("A20:C20").values = [["합계", null, null]];
summarySheet.getRange("B20:H20").formulas = [[
  "=SUM(B15:B19)",
  "=SUM(C15:C19)",
  "=SUM(D15:D19)",
  "=SUM(E15:E19)",
  "=SUM(F15:F19)",
  "=SUM(G15:G19)",
  "=IF(AND(D20=B7,F20=B4),\"OK\",\"CHECK\")",
]];
summarySheet.getRange("A14:H20").format = {
  font: { name: "Aptos", size: 10, color: colors.text },
  borders: { preset: "inside", style: "thin", color: colors.border },
};
summarySheet.getRange("A14:H14").format = {
  fill: colors.slate,
  font: { name: "Aptos", size: 10, bold: true, color: colors.white },
  wrapText: true,
};
summarySheet.getRange("A20:H20").format = {
  fill: colors.blueLight,
  font: { name: "Aptos", size: 10, bold: true, color: colors.navy },
};
summarySheet.getRange("B15:G20").format.numberFormat = "#,##0";

summarySheet.getRange("A23:C23").values = [["권장 조치", "건수", "설명"]];
const actionRows = [
  ["중복 변형 제거 검토", "대표 표기가 이미 존재"],
  ["표기 교정·교체 검토", "희귀·비표준 표기"],
  ["저활용 제외 검토", "낮은 빈도·우선 태그 없음·예문 없음"],
  ["데이터 정규화 검토", "표기+읽기 조합 재확인 필요"],
  ["2차 보류", "수량 충족용 상대 하위 순위"],
];
for (let index = 0; index < actionRows.length; index += 1) {
  const row = 24 + index;
  summarySheet.getRange(`A${row}`).values = [[actionRows[index][0]]];
  summarySheet.getRange(`B${row}`).formulas = [[
    `=COUNTIF('제외 후보'!C$2:C$${candidateValues.length + 1},A${row})`,
  ]];
  summarySheet.getRange(`C${row}`).values = [[actionRows[index][1]]];
}
summarySheet.getRange("A23:C28").format = {
  font: { name: "Aptos", size: 10, color: colors.text },
  borders: { preset: "inside", style: "thin", color: colors.border },
};
summarySheet.getRange("A23:C23").format = {
  fill: colors.teal,
  font: { name: "Aptos", size: 10, bold: true, color: colors.white },
};
summarySheet.getRange("B24:B28").format.numberFormat = "#,##0";

summarySheet.getRange("A1:A30").format.columnWidth = 25;
summarySheet.getRange("B1:B30").format.columnWidth = 15;
summarySheet.getRange("C1:C30").format.columnWidth = 42;
for (const column of ["D", "E", "F", "G", "H"]) {
  summarySheet.getRange(`${column}1:${column}30`).format.columnWidth = 18;
}
summarySheet.freezePanes.freezeRows(1);
summarySheet.showGridLines = false;

await fs.mkdir(outputDir, { recursive: true });
const previewDir = path.join(outputDir, "previews");
await fs.mkdir(previewDir, { recursive: true });

const previewRanges = [
  ["요약", "A1:H28"],
  ["제외 후보", "A1:P18"],
  ["변형 그룹", "A1:P18"],
  ["점수 감사", "A1:M18"],
  ["선정 규칙", "A1:D32"],
];
for (const [sheetName, range] of previewRanges) {
  const preview = await workbook.render({
    sheetName,
    range,
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(previewDir, `${sheetName}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const inspection = await workbook.inspect({
  kind: "table",
  range: "요약!A1:H28",
  include: "values,formulas",
  tableMaxRows: 30,
  tableMaxCols: 10,
  maxChars: 10000,
});
console.log(inspection.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|MISMATCH|CHECK",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error and reconciliation scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "jlpt_replacement_candidates.xlsx"));
