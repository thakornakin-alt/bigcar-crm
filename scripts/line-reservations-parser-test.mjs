import assert from "node:assert/strict";
import { parseLineReservationCommands, parseLineReservationText } from "../lib/line-reservation-parser.ts";

const single = parseLineReservationText("จองทะเบียน : 6กฎ 3843");
assert.deepEqual(single, {
  action: "reserve",
  plate: "6กฎ 3843",
  displayPlate: "6กฎ 3843",
  matchKey: "6กฎ3843"
});

const multiText = [
  "จองทะเบียน : 6กฎ 3843",
  "จองทะเบียน : 1ขฐ 3551",
  "จองทะเบียน : 3ฒญ 1500",
  "จองทะเบียน : 1นก 8210",
  "จองทะเบียน : 2ฒฒ 1950"
].join("\n");
const multi = parseLineReservationCommands(multiText);
assert.equal(multi.length, 5);
assert.deepEqual(
  multi.map((item) => item.matchKey),
  ["6กฎ3843", "1ขฐ3551", "3ฒญ1500", "1นก8210", "2ฒฒ1950"]
);
assert.deepEqual(
  multi.map((item) => item.displayPlate),
  ["6กฎ 3843", "1ขฐ 3551", "3ฒญ 1500", "1นก 8210", "2ฒฒ 1950"]
);

console.log("line-reservations parser tests passed");
