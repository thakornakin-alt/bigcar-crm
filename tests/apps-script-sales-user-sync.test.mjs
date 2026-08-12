import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const code = fs.readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const headersMatch = code.match(/SALES_USER_HEADERS=(\[[^\]]+\])/);
const registerMatch = code.match(/function registerSalesUser\(input\)\{[^\r\n]+\}/);
const updateMatch = code.match(/function updateSalesUser\(input\)\{[^\r\n]+\}/);
const phoneWriterMatch = code.match(/function writeSalesUserPhoneAsText\(sheet,rowIndex,phone\)\{[^\r\n]+\}/);

assert.ok(headersMatch, "SALES_USER_HEADERS must exist");
assert.ok(registerMatch, "registerSalesUser must exist");
assert.ok(updateMatch, "updateSalesUser must exist");
assert.ok(phoneWriterMatch, "writeSalesUserPhoneAsText must exist");

const headers = JSON.parse(headersMatch[1]);
const original = [
  "USER-1", "created", "updated", "person@example.com", "HASH-KEEP", "SALT-KEEP",
  "OldFirst", "OldLast", "OldNick", "0917785117", "@line", "qr", "avatar",
  "Sales", "Bangna", "sales", false
];

function sheetFixture(initialRow = original) {
  let row = [...initialRow];
  let phoneFormat = "AUTOMATIC";
  const coercePhone = (value) => phoneFormat === "@" ? String(value) : (/^\d+$/.test(String(value)) ? Number(value) : value);
  const sheet = {
    getLastRow: () => 2,
    appendRow: (values) => { row = [...values]; row[9] = coercePhone(row[9]); },
    getRange: (_rowIndex, column) => {
      if (column === 10) {
        return {
          setNumberFormat: (format) => { phoneFormat = format; return sheet.getRange(_rowIndex, column); },
          setValue: (value) => { row[9] = coercePhone(value); return sheet.getRange(_rowIndex, column); }
        };
      }
      return { setValues: (values) => { row = [...values[0]]; row[9] = coercePhone(row[9]); } };
    }
  };
  return { sheet, read: () => ({ row, phoneFormat }) };
}

function execute(patch, initialRow = original) {
  const source = [...initialRow];
  const fixture = sheetFixture(source);
  const context = {
    SALES_USER_HEADERS: headers,
    formatDateTime: () => "updated-next",
    findSalesUserById: () => ({ row: source, rowIndex: 2 }),
    getSalesUserSheet: () => fixture.sheet,
    salesUserFromRow: (value) => value
  };
  vm.runInNewContext(`${phoneWriterMatch[0]};${updateMatch[0]};result=updateSalesUser(input);`, { ...context, input: { id: "USER-1", ...patch }, result: undefined });
  return fixture.read().row;
}

function executeRegister(phone) {
  const fixture = sheetFixture([]);
  const context = {
    SALES_USER_HEADERS: headers,
    TIME_ZONE: "Asia/Bangkok",
    formatDateTime: () => "created-next",
    findSalesUserByEmail: () => null,
    getSalesUserSheet: () => fixture.sheet,
    cleanSalesUserInput: (input) => input,
    hashPassword: () => "HASH-KEEP",
    salesUserFromRow: (value) => value,
    Utilities: {
      formatDate: () => "20260812-090000",
      getUuid: () => "SALT-KEEP"
    },
    Math: { random: () => 0.1, floor: Math.floor }
  };
  const input = {
    email: "new@example.com", password: "secret", firstName: "First", lastName: "Last",
    nickname: "Nick", phone, lineId: "", lineQrUrl: "", avatarUrl: "", position: "Sales", branch: "Bangna"
  };
  vm.runInNewContext(`${phoneWriterMatch[0]};${registerMatch[0]};result=registerSalesUser(input);`, { ...context, input, result: undefined });
  return fixture.read();
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

test("update and registration persist Thai phone numbers as plain text", () => {
  for (const phone of ["0917785117", "0812345678", "0990000001"]) {
    const updated = execute({ phone });
    assert.equal(updated[9], phone);
    assert.equal(typeof updated[9], "string");

    const registered = executeRegister(phone);
    assert.equal(registered.row[9], phone);
    assert.equal(typeof registered.row[9], "string");
    assert.equal(registered.phoneFormat, "@");
  }
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
