#!/usr/bin/env node
// Fixes React 19 infinite-loop caused by inline arrow-function ref callbacks in @radix-ui/react-select.
// In React 19, ref callbacks that are new functions every render trigger cleanup + setup on every render,
// causing setState to fire in a loop exceeding React's 25-update limit.
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../node_modules/@radix-ui/react-select/dist/index.js");

if (!fs.existsSync(filePath)) {
  console.log("patch-radix-select: file not found, skipping");
  process.exit(0);
}

let src = fs.readFileSync(filePath, "utf8");
const before = src;

// Fix 1 & 2: Replace (node) => setContent(node) with stable setContent setter
src = src.split("(node) => setContent(node)").join("setContent");

// Fix 3: Replace (node) => setItemTextNode(node) with stable setItemTextNode setter
src = src.split("(node) => setItemTextNode(node)").join("setItemTextNode");

// Fix 4: Stabilize the itemTextRefCallback wrapper in SelectItemText using useCallback
const oldFragment = `    const composedRefs = (0, import_react_compose_refs.useComposedRefs)(
      forwardedRef,
      setItemTextNode,
      itemContext.onItemTextChange,
      (node) => contentContext.itemTextRefCallback?.(node, itemContext.value, itemContext.disabled)
    );`;

const newFragment = `    const itemTextCallbackRef = React.useCallback(
      (node) => contentContext.itemTextRefCallback?.(node, itemContext.value, itemContext.disabled),
      [contentContext.itemTextRefCallback, itemContext.value, itemContext.disabled]
    );
    const composedRefs = (0, import_react_compose_refs.useComposedRefs)(
      forwardedRef,
      setItemTextNode,
      itemContext.onItemTextChange,
      itemTextCallbackRef
    );`;

if (src.includes(oldFragment)) {
  src = src.replace(oldFragment, newFragment);
}

if (src === before) {
  console.log("patch-radix-select: already patched or patterns not found");
} else {
  fs.writeFileSync(filePath, src, "utf8");
  // Clear Vite dep cache so it rebuilds from patched source
  const cacheFiles = [
    path.join(__dirname, "../node_modules/.vite/deps/@radix-ui_react-select.js"),
    path.join(__dirname, "../node_modules/.vite/deps/@radix-ui_react-select.js.map"),
  ];
  cacheFiles.forEach((f) => {
    try { fs.unlinkSync(f); } catch (_) {}
  });
  console.log("patch-radix-select: applied React 19 ref-callback fixes to @radix-ui/react-select");
}
