import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep the same canvas mounted, including in embedded browsers without fullscreen permission. */
export function usePreviewFullscreen() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);

  const close = useCallback(() => {
    expandedRef.current = false;
    setExpanded(false);
    if (document.fullscreenElement === previewRef.current)
      void document.exitFullscreen().catch(() => {
        expandedRef.current = true;
        setExpanded(true);
      });
  }, []);

  const toggle = useCallback(async () => {
    if (expandedRef.current) return close();
    const preview = previewRef.current;
    if (!preview) return;
    expandedRef.current = true;
    setExpanded(true);
    if (document.fullscreenEnabled) {
      try {
        await preview.requestFullscreen();
        if (!expandedRef.current && document.fullscreenElement === preview)
          await document.exitFullscreen();
      } catch {
        // The fixed viewport still fills the app when its host denies native fullscreen.
      }
    }
  }, [close]);

  useEffect(() => {
    let ownedFullscreen = false;
    const sync = () => {
      const owned = document.fullscreenElement === previewRef.current;
      if (ownedFullscreen && !owned) {
        expandedRef.current = false;
        setExpanded(false);
      }
      ownedFullscreen = owned;
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    const preview = previewRef.current;
    if (!expanded || !preview) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const outside: [HTMLElement, boolean][] = [];
    // Hide every sibling branch from keyboard and assistive navigation.
    for (let branch: HTMLElement = preview; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          outside.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      if (branch.parentElement === document.body) break;
    }
    preview.querySelector<HTMLButtonElement>('.preview-fullscreen-toggle')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        preview.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), [tabindex="0"]',
        ),
      );
      const first = focusable[0],
        last = focusable.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !preview.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !preview.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      outside.forEach(([element, inert]) => {
        element.inert = inert;
      });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [expanded, close]);

  return { previewRef, expanded, toggle };
}
