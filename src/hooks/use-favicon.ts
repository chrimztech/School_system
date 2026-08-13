import { useEffect } from "react";

const DEFAULT_FAVICON = "/favicon.svg";

// Swaps the browser tab icon. Falls back to the platform default so schools
// without a custom faviconUrl (or the bare platform domain) don't show a blank icon.
export function useFavicon(url?: string | null) {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = url || DEFAULT_FAVICON;
  }, [url]);
}
