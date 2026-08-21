import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";

import { roleAllowedForPath, routeAccessForPath } from "./route-access.ts";

test("every application page has an explicit access policy", () => {
  const routeFiles = readdirSync(new URL("../routes", import.meta.url))
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => !["__root.tsx", "login.tsx", "change-password.tsx"].includes(name));

  const unmapped = routeFiles.filter((name) => {
    const routeName =
      name === "index.tsx" ? "" : name.replace(/\.tsx$/, "").replace(/\.\$[^.]+$/, "/example");
    return routeAccessForPath(`/${routeName}`).module === "__unmapped_route__";
  });

  assert.deepEqual(unmapped, []);
});

test("result approvals and guardian records have role restrictions", () => {
  assert.deepEqual(routeAccessForPath("/results-approvals").allowedRoles, [
    "super_admin",
    "school_admin",
    "principal",
    "deputy_head",
    "hod",
    "career_guidance",
  ]);
  assert.equal(routeAccessForPath("/parents").allowedRoles?.includes("parent"), false);
  assert.equal(routeAccessForPath("/assessments").allowedRoles?.includes("parent"), false);
  assert.equal(routeAccessForPath("/assessments").allowedRoles?.includes("teacher"), true);
  assert.equal(roleAllowedForPath("/parents", "teacher"), false);
  assert.equal(roleAllowedForPath("/parents", "school_admin"), true);
});
