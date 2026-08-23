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

test("authenticated users leave login through one app-shell redirect", () => {
  const user = { mustChangePassword: false };
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/login" }),
    "/",
  );
  assert.equal(
    authRedirectFor({ clientReady: true, loadingSession: false, user, path: "/" }),
    null,
  );
});

test("password-change redirects take precedence after login", () => {
  const user = { mustChangePassword: true };
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
