/**
 * Full page load of a same-origin path, replacing the current history entry. Used where the gateway, not this
 * router, must decide which app serves the path (a legacy page, or a page flipped only for pilot users).
 */
export function loadPage(path: string): void {
  window.location.replace(path);
}
