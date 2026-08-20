import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const uiPath = new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url);
const routePath = new URL("../app/api/documents-v2/generate/route.ts", import.meta.url);

test("Documents V2 automatically resolves, loads override, and generates the latest report/template", async () => {
  const ui = await readFile(uiPath, "utf8");
  assert.match(ui, /Promise\.all\(\[/);
  assert.match(ui, /fetchResolvedData\(selectedReport, requestTemplateId, controller\.signal\)/);
  assert.match(ui, /documents-v2\/override\?templateId=/);
  assert.match(ui, /pendingReportGenerationRef\.current = \{ token, data: effectiveData, sourceKey \}/);
  assert.match(ui, /refreshDocumentPreviews\(true, pending\.data, pending\.token, pending\.sourceKey\)/);
  assert.match(ui, /pending\.token !== reportRequestSeqRef\.current/);
  assert.match(ui, /requestReportId !== selectedReportId \|\| requestTemplateId !== templateId/);
});

test("ready state is published only after current Preview generation succeeds", async () => {
  const ui = await readFile(uiPath, "utf8");
  const generating = ui.indexOf('reportLoadState !== "generating"');
  const refresh = ui.indexOf("refreshDocumentPreviews(true, pending.data", generating);
  const ready = ui.indexOf('setReportLoadState("ready")', refresh);
  assert.ok(generating >= 0 && refresh > generating && ready > refresh);
  assert.match(ui, /กำลังโหลดข้อมูลรายงานขาย\.\.\./);
  assert.match(ui, /กำลังสร้างตัวอย่างเอกสาร\.\.\./);
  assert.match(ui, /ข้อมูลพร้อมแล้ว/);
});

test("normal generation reuses resolved data and avoids a second live stock resolution", async () => {
  const ui = await readFile(uiPath, "utf8");
  const route = await readFile(routePath, "utf8");
  assert.match(ui, /dataResolved: true/);
  assert.match(route, /body\.dataResolved === true/);
  assert.match(route, /await resolveDocumentV2Data\(report, override\)/);
  assert.match(route, /\? override as unknown as DocumentV2Data/);
});

test("normal mode does not fetch or autosave developer mapping during page hydration", async () => {
  const ui = await readFile(uiPath, "utf8");
  const loadFields = ui.slice(ui.indexOf("async function loadFields"), ui.indexOf("async function loadReports"));
  assert.doesNotMatch(loadFields, /documents-v2\/mapping/);
  assert.match(ui, /if \(!settingsMode \|\| Object\.keys\(mapping\)\.length\) return;/);
});

test("normal action hierarchy keeps automatic Preview and manual refresh as retry", async () => {
  const ui = await readFile(uiPath, "utf8");
  assert.match(ui, /ระบบอัปเดต Preview ให้อัตโนมัติ/);
  assert.match(ui, /Download PDF ตาม Preview นี้/);
  assert.match(ui, /แชร์\/บันทึกรูป/);
  assert.doesNotMatch(ui, />DocumentGeneratorV2</);
  assert.doesNotMatch(ui, /<label[^>]*>Template<\/label>/);
});

