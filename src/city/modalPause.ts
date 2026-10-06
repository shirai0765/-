/** Pause the map behind any native dialog, including dialogs owned by other panels. */
export function observeModalPause(onChange: (paused: boolean) => void): () => void {
  let previous: boolean | undefined;
  const refresh = () => {
    const paused = document.querySelector('dialog[open]') !== null;
    if (paused !== previous) { previous = paused; onChange(paused); }
  };
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
  refresh();
  return () => observer.disconnect();
}
