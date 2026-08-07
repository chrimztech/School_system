import assert from "node:assert/strict";
import test from "node:test";

import { schoolPath } from "./api.ts";

test("school paths never use a locally stored school ID", () => {
  const requestedSchool = "11111111-1111-4111-8111-111111111111";
  const changedLocalSchool = "22222222-2222-4222-8222-222222222222";
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => changedLocalSchool },
  });

  try {
    assert.equal(
      schoolPath(requestedSchool, "/students"),
      `/api/schools/${requestedSchool}/students`,
    );
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("school paths reject non-UUID tenant identifiers", () => {
  assert.throws(() => schoolPath("lubu", "students"), /No valid school ID/);
});
