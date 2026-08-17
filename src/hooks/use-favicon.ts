import { useEffect } from "react";

const DEFAULT_FAVICON = "/favicon.svg";

// Swaps the browser tab icon. Falls back to the platform default so schools
// without a custom faviconUrl (or the bare platform domain) don't show a blank icon.
//
// Mutating .href on an existing <link> is NOT reliable across browsers — Chrome in
// particular can keep showing whichever icon it rendered first (especially with data:
// URIs, and especially switching between two different data: URIs) even after the href
// changes, because it doesn't treat the mutation as a reason to refetch/redraw the tab
// icon. Removing every existing icon link and appending a brand-new element forces a
// genuine re-fetch every time, which is the standard workaround for this.
export function useFavicon(url?: string | null) {
  useEffect(() => {
    document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = url || DEFAULT_FAVICON;
    document.head.appendChild(link);
  }, [url]);
}
