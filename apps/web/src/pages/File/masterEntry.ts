/**
 * The one helper left from the legacy-style master pages (the Option select, AllowChange flags and toast texts went with
 * the redesign, docs/19 section 14): the list filtering the legacy DataTables did, kept as it was.
 */

/** DataTables "smart" search on one column: every word must occur in the text, case-insensitively. */
export function smartMatches(text: string, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return words.every((w) => haystack.includes(w));
}
