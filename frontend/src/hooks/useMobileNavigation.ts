import { useEffect, useSyncExternalStore } from "react";
import type { RefObject } from "react";

const query = "(max-width: 960px)";
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
export function useMobileNavigation(
  open: boolean,
  setOpen: (value: boolean) => void,
  sidebar: RefObject<HTMLElement | null>,
) {
  const mobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const closeOnDesktop = () => {
      if (!media.matches) setOpen(false);
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [setOpen]);
  useEffect(() => {
    if (!mobile || !open || !sidebar.current) return;
    const element = sidebar.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const targets = () =>
      [
        ...element.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])",
        ),
      ].filter((target) => target.getClientRects().length > 0);
    targets()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const focusable = targets();
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === focusable.at(-1)
      ) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [mobile, open, setOpen, sidebar]);
  return mobile;
}
