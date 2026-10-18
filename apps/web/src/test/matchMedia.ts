/**
 * Makes `window.matchMedia` answer min-width / max-width queries for a given viewport width, so components that
 * switch layout with `useMediaQuery` (MasterDataPage: panel from `md` up, drawer below) render the layout under test.
 * Returns a function that restores the previous implementation.
 */
export function mockViewportWidth(width: number): () => void {
  const previous = window.matchMedia;
  window.matchMedia = (query: string): MediaQueryList => {
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    const matches =
      (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true);
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
  return () => {
    window.matchMedia = previous;
  };
}
