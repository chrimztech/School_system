import assert from "node:assert/strict";
import { test } from "node:test";

import { authRedirectFor } from "./auth-navigation.ts";

test("auth redirects wait until the client session is ready", () => {
  assert.equal(
    authRedirectFor({ clientReady: false, loadingSession: false, user: null, path: "/fees" }),
    null,
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: true, user: null, path: "/fees" }),
    null,
  );
});

test("signed-out users are sent to login without redirecting login to itself", () => {
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user: null, path: "/fees" }),
    "/login",
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user: null, path: "/login" }),
    null,
  );
});

test("signed-out visitors land on the public marketing page at the bare root, not login", () => {
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user: null, path: "/" }),
    "/welcome",
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user: null, path: "/welcome" }),
    null,
  );
  // Deep links to anything else still bounce straight to sign-in, same as before.
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user: null, path: "/students" }),
    "/login",
  );
});

test("authenticated users leave login through one app-shell redirect", () => {
  const user = { mustChangePassword: false, name: "Jane Doe", role: "parent" };
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/login" }),
    "/",
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/" }),
    null,
  );
  // An already-signed-in user revisiting the marketing page (e.g. an old bookmark) goes
  // straight to their dashboard, same treatment as revisiting /login.
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/welcome" }),
    "/",
  );
});

test("password-change redirects take precedence after login", () => {
  const user = { mustChangePassword: true, name: "Jane Doe", role: "parent" };
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/login" }),
    "/change-password",
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/" }),
    "/change-password",
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/change-password" }),
    null,
  );
});

test("missing name redirects to set-bio after password change", () => {
  // Password change must complete first — set-bio is only offered after mustChangePassword is cleared.
  const user = { mustChangePassword: true, name: "", role: "parent" };
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/" }),
    "/change-password",
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/change-password" }),
    null,
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/set-bio" }),
    "/change-password",
  );
});

test("bio completion redirect blocks dashboard access when name is missing", () => {
  const user = { mustChangePassword: false, name: "", role: "parent" };
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/" }),
    "/set-bio",
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/set-bio" }),
    null,
  );
  // Should not be redirected away from set-bio while on it.
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/dashboard" }),
    "/set-bio",
  );
});

test("bio completion redirect does not fire when name is present", () => {
  const user = { mustChangePassword: false, name: "Jane Doe", role: "parent" };
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/" }),
    null,
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/fees" }),
    null,
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/set-bio" }),
    "/",
  );
});

test("password-change redirect takes precedence over bio redirect", () => {
  const user = { mustChangePassword: true, name: "", role: "parent" };
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/" }),
    "/change-password",
  );
});

test("placeholder parent names require profile completion", () => {
  for (const name of ["Parent", "Guardian", "Not Provided", "Unknown", "-"]) {
    assert.equal(
      authRedirectFor({
        clientReady: true,
        loadingSession: false,
        user: { mustChangePassword: false, name, role: "parent" },
        path: "/fees",
      }),
      "/set-bio",
    );
  }
});

test("missing names do not block non-parent accounts", () => {
  assert.equal(
    authRedirectFor({
      clientReady: true,
      loadingSession: false,
      user: { mustChangePassword: false, name: "", role: "teacher" },
      path: "/",
    }),
    null,
  );
});
