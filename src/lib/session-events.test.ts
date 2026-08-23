import assert from "node:assert/strict";
import { test } from "node:test";

import { AUTH_PROVIDER_SESSION_SOURCE, sessionChangeCameFrom } from "./session-events.ts";

test("session changes can identify updates already applied by AuthProvider", () => {
  const localUpdate = {
    detail: { source: AUTH_PROVIDER_SESSION_SOURCE },
  } as CustomEvent<{ source: string }>;

  assert.equal(sessionChangeCameFrom(localUpdate, AUTH_PROVIDER_SESSION_SOURCE), true);
  assert.equal(
    sessionChangeCameFrom(new Event("srms-session-changed"), AUTH_PROVIDER_SESSION_SOURCE),
    false,
  );
});
