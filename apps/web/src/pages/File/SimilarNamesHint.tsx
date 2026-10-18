import { Box, InlineHint, Stack, Typography } from '@cims/ui';

export interface SimilarName {
  key: string;
  /** "INDIA" */
  name: string;
  /** "IND · Both" */
  detail?: string;
}

export interface SimilarNamesHintProps {
  /** The records whose name matches what was typed (legacy "Pre-Entered … Listing"). Hidden when null. */
  names: readonly SimilarName[] | null;
  /** "countries", "ports" */
  plural: string;
  /** At most this many are listed; the rest are counted. */
  limit?: number;
  id?: string;
}

/**
 * Inline "similar names" hint under the name field of a new record: the existing records whose name starts like the
 * typed one, so a duplicate is noticed before saving. Replaces the legacy "Pre-Entered … Listing" box (`#PData`), with
 * the same lookup behind it (docs/19 section 3.1, "Legacy mapping").
 */
export function SimilarNamesHint({ names, plural, limit = 6, id }: SimilarNamesHintProps) {
  if (names === null) return null;
  if (names.length === 0) {
    return (
      <InlineHint tone="success" id={id} data-testid="similar-names">
        {`No existing ${plural} with a similar name.`}
      </InlineHint>
    );
  }
  const shown = names.slice(0, limit);
  const more = names.length - shown.length;
  return (
    <InlineHint tone="warning" boxed id={id} data-testid="similar-names">
      <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
        {`Similar names already in use (${names.length}). Check this is not a duplicate.`}
      </Typography>
      <Stack component="ul" spacing={0.25} sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
        {shown.map((n) => (
          <li key={n.key}>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {n.name}
            </Box>
            {n.detail ? ` · ${n.detail}` : null}
          </li>
        ))}
        {more > 0 ? <li>{`and ${more} more`}</li> : null}
      </Stack>
    </InlineHint>
  );
}
