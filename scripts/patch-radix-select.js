#!/usr/bin/env node
// Fixes React 19 infinite-loop caused by inline arrow-function ref callbacks in Radix UI packages.
// In React 19, ref callbacks that are new functions every render trigger cleanup + setup on every render,
// causing setState to fire in a loop exceeding React's 25-update limit.
// Pattern: (node) => setXxx(node) — the wrapper is redundant since setXxx is already a stable setter.
const fs = require("fs");
const path = require("path");

const radixDir = path.join(__dirname, "../node_modules/@radix-ui");
if (!fs.existsSync(radixDir)) {
  console.log("patch-radix-select: @radix-ui not found, skipping");
  process.exit(0);
}

let totalFixed = 0;
const pkgs = fs.readdirSync(radixDir);

for (const pkg of pkgs) {
  for (const ext of [".mjs", ".js"]) {
    const filePath = path.join(radixDir, pkg, "dist", "index" + ext);
    if (!fs.existsSync(filePath)) continue;

    let src = fs.readFileSync(filePath, "utf8");
    const before = src;

    // Fix: (node) => setXxx(node) → setXxx (inline arrow is redundant and causes React 19 loops)
    src = src.replace(/\(node\) => (set[A-Z][a-zA-Z]+)\(node\)/g, "$1");

    // Extra fix for react-select's itemTextRefCallback wrapper (needs useCallback stabilization)
    if (pkg === "react-select" && ext === ".mjs") {
      const oldFrag = `const composedRefs = useComposedRefs(\n      forwardedRef,\n      setItemTextNode,\n      itemContext.onItemTextChange,\n      (node) => contentContext.itemTextRefCallback?.(node, itemContext.value, itemContext.disabled)\n    );`;
      const newFrag = `const itemTextCallbackRef = React.useCallback(\n      (node) => contentContext.itemTextRefCallback?.(node, itemContext.value, itemContext.disabled),\n      [contentContext.itemTextRefCallback, itemContext.value, itemContext.disabled]\n    );\n    const composedRefs = useComposedRefs(\n      forwardedRef,\n      setItemTextNode,\n      itemContext.onItemTextChange,\n      itemTextCallbackRef\n    );`;
      if (src.includes(oldFrag)) src = src.replace(oldFrag, newFrag);
    }

    if (src !== before) {
      const count = (before.match(/\(node\) => set[A-Z][a-zA-Z]+\(node\)/g) || []).length;
      fs.writeFileSync(filePath, src, "utf8");
      totalFixed += count;
    }
  }
}

// Clear Vite dep cache so it rebuilds from patched sources
const cacheDir = path.join(__dirname, "../node_modules/.vite/deps");
if (fs.existsSync(cacheDir)) {
  try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch (_) {}
}

if (totalFixed === 0) {
  console.log("patch-radix-select: already patched");
} else {
  console.log(`patch-radix-select: fixed ${totalFixed} React 19 ref-callback pattern(s) across Radix UI packages`);
}
