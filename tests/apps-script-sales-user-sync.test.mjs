import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const code = fs.readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const headersMatch = code.match(/SALES_USER_HEADERS=(\[[^\]]+\])/);
const updateMatch = code.match(/function updateSalesUser\(input\)\{[^\r\n]+\}/);

assert.ok(headersMatch, "SALES_USER_HEADERS must exist");
assert.ok(updateMatch, "updateSalesUser must exist");

const headers = JSON.parse(headersMatch[1]);
const original = [
  "USER-1", "created", "updated", "person@example.com", "HASH-KEEP", "SALT-KEEP",
  "OldFirst", "OldLast", "OldNick", "0917785117", "@line", "qr", "avatar",
  "Sales", "Bangna", "sales", false
];

function execute(patch, row = original) {
  const source = [...row];
  let written;
  const context = {
    SALES_USER_HEADERS: headers,
    formatDateTime: () => "updated-next",
    findSalesUserById: () => ({ row: source, rowIndex: 2 }),
    getSalesUserSheet: () => ({
      getRange: () => ({ setValues: (values) => { written = values[0]; } })
    }),
    salesUserFromRow: (value) => value
  };
  vm.runInNewContext(`${updateMatch[0]};result=updateSalesUser(input);`, { ...context, input: { id: "USER-1", ...patch }, result: undefined });
  assert.ok(written, "updated row must be written");
  return written;
}

test("SalesUsers header mapping for canonical names is unchanged", () => {
  assert.equal(headers[6], "FirstName");
  assert.equal(headers[7], "LastName");
  assert.equal(headers[8], "Nickname");
  assert.equal(headers[9], "Phone");
});

test("FirstName, LastName and Nickname update only their own canonical columns", () => {
  const first = execute({ firstName: " NewFirst " });
  assert.equal(first[6], "NewFirst");
  assert.equal(first[7], original[7]);
  assert.equal(first[8], original[8]);

  const last = execute({ lastName: " NewLast " });
  assert.equal(last[6], original[6]);
  assert.equal(last[7], "NewLast");
  assert.equal(last[8], original[8]);

  const nick = execute({ nickname: " NewNick " });
  assert.equal(nick[6], original[6]);
  assert.equal(nick[7], original[7]);
  assert.equal(nick[8], "NewNick");
});

test("combined canonical-name update preserves protected and unrelated columns", () => {
  const row = execute({ firstName: "First", lastName: "Last", nickname: "Nick" });
  assert.deepEqual(Array.from(row.slice(6, 9)), ["First", "Last", "Nick"]);
  for (const index of [0, 1, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15, 16]) {
    assert.equal(row[index], original[index], `column ${headers[index]} must remain unchanged`);
  }
});

test("phone remains an exact string with its leading zero", () => {
  const unchanged = execute({ nickname: "Nick" });
  assert.equal(unchanged[9], "0917785117");
  const changed = execute({ phone: "0917785117" });
  assert.equal(changed[9], "0917785117");
  assert.equal(typeof changed[9], "string");
});

test("unknown fields cannot overwrite any SalesUsers business column", () => {
  const row = execute({ passwordHash: "BAD", salt: "BAD", email: "bad@example.com", unknown: "BAD" });
  for (let index = 0; index < original.length; index += 1) {
    if (index !== 2) assert.equal(row[index], original[index], `column ${headers[index]} must remain unchanged`);
  }
});

test("existing users with missing optional profile fields remain compatible", () => {
  const legacy = [...original];
  legacy[10] = "";
  legacy[11] = "";
  legacy[12] = "";
  const row = execute({ nickname: "Legacy" }, legacy);
  assert.equal(row[8], "Legacy");
  assert.equal(row[10], "");
  assert.equal(row[11], "");
  assert.equal(row[12], "");
});
