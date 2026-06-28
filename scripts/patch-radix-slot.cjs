#!/usr/bin/env node
// Fixes React 19 infinite-loop caused by SlotClone creating a new composeRefs function
// on every render. When SlotClone re-renders, `composeRefs(forwardedRef, childrenRef)`
// produces a new arrow function. React 19 sees the ref identity changed, calls the old
// ref with null (cleanup), which fires setState inside TooltipTrigger/SelectTrigger, which
// triggers another re-render, creating another new ref — infinite loop.
//
// Fix: inject a WeakMap-based cache (`__stableComposeRefs`) so that when forwardedRef and
// childrenRef are the same objects as the previous render, we return the SAME composed ref
// function. React 19 sees no change → no cleanup → no infinite loop.
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../node_modules/@radix-ui/react-slot/dist/index.js");

if (!fs.existsSync(filePath)) {
  console.log("patch-radix-slot: file not found, skipping");
  process.exit(0);
}

let src = fs.readFileSync(filePath, "utf8");
const before = src;

// 1. Inject the stable compose-refs cache helper right before createSlotClone
const cacheHelper = `// React 19 fix: cache composed refs by (forwardedRef, childrenRef) identity
// so SlotClone returns the same function between renders when both refs are stable.
var __slotComposedRefCache = typeof WeakMap !== "undefined" ? new WeakMap() : null;
function __stableComposeRefs(ref1, ref2) {
  if (!ref1) return ref2 != null ? ref2 : null;
  if (!ref2) return ref1;
  if (!__slotComposedRefCache) return (0, import_react_compose_refs.composeRefs)(ref1, ref2);
  var inner = __slotComposedRefCache.get(ref1);
  if (!inner) { inner = new WeakMap(); __slotComposedRefCache.set(ref1, inner); }
  var cached = inner.get(ref2);
  if (!cached) { cached = (0, import_react_compose_refs.composeRefs)(ref1, ref2); inner.set(ref2, cached); }
  return cached;
}
`;

// 2. Replace the inline composeRefs call with our stable version
const oldRef = `props2.ref = forwardedRef ? (0, import_react_compose_refs.composeRefs)(forwardedRef, childrenRef) : childrenRef;`;
const newRef = `props2.ref = __stableComposeRefs(forwardedRef, childrenRef);`;

if (!src.includes(oldRef)) {
  console.log("patch-radix-slot: composeRefs pattern not found — already patched or version mismatch");
  process.exit(0);
}

if (!src.includes("function createSlotClone")) {
  console.log("patch-radix-slot: createSlotClone not found — skipping");
  process.exit(0);
}

// Inject cache helper before createSlotClone
src = src.replace("function createSlotClone(", cacheHelper + "function createSlotClone(");
// Replace the inline call
src = src.replace(oldRef, newRef);

if (src === before) {
  console.log("patch-radix-slot: already patched or patterns not found");
} else {
  fs.writeFileSync(filePath, src, "utf8");
  // Clear Vite dep cache so it rebuilds from patched source
  const cacheFiles = [
    path.join(__dirname, "../node_modules/.vite/deps/@radix-ui_react-slot.js"),
    path.join(__dirname, "../node_modules/.vite/deps/@radix-ui_react-slot.js.map"),
  ];
  cacheFiles.forEach((f) => {
    try { fs.unlinkSync(f); } catch (_) {}
  });
  console.log("patch-radix-slot: applied React 19 stable-ref fix to @radix-ui/react-slot");
}
