import assert from "node:assert/strict";
import test from "node:test";

import { schoolSlugFromHostname } from "./tenant-host.ts";

test("keeps the main domain in platform scope", () => {
  assert.equal(schoolSlugFromHostname("school.edu.zm"), null);
  assert.equal(schoolSlugFromHostname("LOCALHOST"), null);
});

test("extracts a single valid active-school candidate", () => {
  assert.equal(schoolSlugFromHostname("LUBU.school.edu.zm."), "lubu");
  assert.equal(schoolSlugFromHostname("lubu.localhost"), "lubu");
});

test("does not accept nested or lookalike domains", () => {
  assert.equal(schoolSlugFromHostname("other.lubu.school.edu.zm"), null);
  assert.equal(schoolSlugFromHostname("lubu.school.edu.zm.attacker.example"), null);
  assert.equal(schoolSlugFromHostname("-lubu.school.edu.zm"), null);
});
