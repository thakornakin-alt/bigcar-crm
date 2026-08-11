import assert from "node:assert/strict";
import test from "node:test";
import { calculatorProfileContract, normalizeProfilePhone, profileActivityName, profileDisplayName, validateProfileIdentity } from "../lib/user-profile.ts";
import type { SalesUser } from "../lib/types.ts";

function user(phone: string): SalesUser {
  return {
    id: "USER-1", createdAt: "", updatedAt: "", email: "big@example.com",
    firstName: "ฐากร", lastName: "กาญจนอังกูร", nickname: "บิ๊ก", phone,
    lineId: "@big", lineQrUrl: "qr", avatarUrl: "avatar", position: "Sales",
    branch: "บางนา", role: "sales", locked: false
  };
}

test("phone remains a string with its leading zero through profile and calculator contracts", () => {
  for (const phone of ["0917785117", "0812345678", "0990000001"]) {
    const persisted = validateProfileIdentity({ firstName: "ฐากร", lastName: "กาญจนอังกูร", nickname: "บิ๊ก", email: "BIG@example.com", phone });
    assert.equal(persisted.phone, phone);
    assert.equal(typeof persisted.phone, "string");
    assert.equal(calculatorProfileContract(user(persisted.phone)).phone, phone);
  }
});

test("phone normalization removes separators without numeric coercion", () => {
  assert.equal(normalizeProfilePhone("091-778 5117"), "0917785117");
  assert.throws(() => validateProfileIdentity({ firstName: "A", lastName: "B", nickname: "C", phone: "091ABC", email: "a@example.com" }));
});

test("canonical display and activity names use the approved fallback order", () => {
  const profile = user("0917785117");
  assert.equal(profileDisplayName(profile), "บิ๊ก");
  assert.equal(profileActivityName(profile), "ฐากร กาญจนอังกูร (บิ๊ก)");
  assert.equal(profileDisplayName({ nickname: "", firstName: "ฐากร", email: "x@example.com" }), "ฐากร");
  assert.equal(profileDisplayName({ nickname: "", firstName: "", email: "x@example.com" }), "x@example.com");
});

test("historical missing avatar and phone values are not guessed", () => {
  const historical = { ...user(""), avatarUrl: "" };
  const contract = calculatorProfileContract(historical);
  assert.equal(contract.phone, "");
  assert.equal(contract.avatarUrl, "");
});
