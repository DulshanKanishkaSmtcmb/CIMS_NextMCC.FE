/**
 * Texts of the Rate card page (docs/19 section 11). The legacy page (AppJs/RateCardEntry.js) let rates be typed but had
 * no save (docs/18 B.1, R3), so the redesign shows the rates read-only (docs/19 section 14.2) and says so.
 */
export const RATE_CARD_MESSAGES = {
  readOnly:
    'Read only: these are the stored rates. This page has never saved changes (business question Q1).',
  /** Legacy alert "Error Loading.... Rate Card Data". */
  loadFailedTitle: 'The rates could not be loaded',
  noClearance: 'No export clearance rates are stored.',
  noFreight: 'No export freight rates are stored.',
  noCfs: 'No CFS charges are stored.',
  noFreightMatch: (text: string) => `No freight rates match “${text}”`,
  /** A stored NULL unit calculation (legacy showed "Individual", the first choice of its select). */
  notSet: 'Not set',
  withRate: (n: number) => `Only ports with a rate (${n})`,
} as const;
