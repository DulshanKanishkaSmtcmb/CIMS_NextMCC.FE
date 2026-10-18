import { useRef, useState, type Ref } from 'react';
import { LookupDialog, LookupField, type LookupColumn } from '@cims/ui';
import {
  useLazyGetCountriesQuery,
  useLazyGetCountryQuery,
  type Country,
} from '../../services/masterDataApi';

/** Columns of the country lookup inside a form (the legacy "Countries Listing" showed every SQL column). */
const COUNTRY_LOOKUP_COLUMNS: readonly LookupColumn[] = [
  { field: 'countryCode', headerName: 'Country code', width: 140 },
  { field: 'countryName', headerName: 'Country name', width: 240 },
  { field: 'cargoMovement', headerName: 'Cargo movement', width: 150 },
];

const COUNTRY_LOOKUP_TEXT = {
  /** Legacy: an unknown code left the previous name on screen; now it says so. */
  notFound: (code: string) => `No country with code ${code}. Pick one with the search button.`,
  /** Legacy alert "Unable to process Ajax Request". */
  listFailed: 'The country list could not be loaded. Try the search button again.',
  /** Legacy alert "No data found to list out". */
  listEmpty: 'There are no countries to choose from.',
  searchLabel: 'Search countries',
} as const;

export interface CountryLookupFieldProps {
  /** The country code in the form. */
  code: string;
  /** The country's name, shown under the field (not saved). */
  countryName: string;
  /** A new code (typed and left, or picked) and, once looked up, its name ('' while unknown). */
  onChange: (code: string, countryName: string) => void;
  readOnly?: boolean;
  label?: string;
  /** Shown under an empty field, e.g. "Optional". */
  emptyHelp?: string;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Country of a port or DC: code field + search button + "Countries" list dialog, the one lookup of another entity
 * the redesigned master pages keep (docs/19 section 14.1 step 4). Same calls as legacy: the list when the search
 * button is pressed, the country by code after a code is typed (blur or Enter) or picked, to show its name. Enter
 * only commits the code (legacy `findCountryCode` was undefined: Enter did nothing more).
 */
export function CountryLookupField({
  code,
  countryName,
  onChange,
  readOnly = false,
  label = 'Country',
  emptyHelp,
  inputRef,
}: CountryLookupFieldProps) {
  const [loadCountries] = useLazyGetCountriesQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [rows, setRows] = useState<Country[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef(0);

  /** Legacy `CountryCode.subscribe` -> `LoadCountryData`: a non-empty code loads the name. */
  const commit = (next: string) => {
    const request = ++latest.current;
    setProblem(null);
    onChange(next, '');
    if (next.length === 0) return;
    void loadCountry(next).then((result) => {
      if (request !== latest.current) return;
      if (result.data) onChange(next, result.data.countryName);
      else setProblem(COUNTRY_LOOKUP_TEXT.notFound(next));
    });
  };

  /** Legacy `btnCountryList`: the list dialog; Select fills the code (and loads the name). */
  const openList = async () => {
    setProblem(null);
    const result = await loadCountries();
    if (!result.data) setProblem(COUNTRY_LOOKUP_TEXT.listFailed);
    else if (result.data.length === 0) setProblem(COUNTRY_LOOKUP_TEXT.listEmpty);
    else setRows(result.data);
  };

  return (
    <>
      <LookupField
        label={label}
        value={code}
        inputRef={inputRef}
        readOnly={readOnly}
        hideSearch={readOnly}
        searchLabel={COUNTRY_LOOKUP_TEXT.searchLabel}
        maxLength={10}
        onCommit={commit}
        onSearch={() => void openList()}
        error={!!problem}
        helperText={problem ?? (countryName || (code ? undefined : emptyHelp))}
      />
      {rows ? (
        <LookupDialog<Country>
          open
          title="Countries"
          columns={COUNTRY_LOOKUP_COLUMNS}
          rows={rows}
          getRowId={(r) => r.countryCode}
          onSelect={(row) => {
            setRows(null);
            commit(row.countryCode);
          }}
          onClose={() => setRows(null)}
        />
      ) : null}
    </>
  );
}
