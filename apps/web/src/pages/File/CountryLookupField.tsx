import type { Ref } from 'react';
import type { LookupColumn } from '@cims/ui';
import {
  useLazyGetCountriesQuery,
  useLazyGetCountryQuery,
  type Country,
} from '../../services/masterDataApi';
import { CodeLookupField, type CodeLookupTexts } from './CodeLookupField';

/** Columns of the country lookup inside a form (the legacy "Countries Listing" showed every SQL column). */
const COUNTRY_LOOKUP_COLUMNS: readonly LookupColumn[] = [
  { field: 'countryCode', headerName: 'Country code', width: 140 },
  { field: 'countryName', headerName: 'Country name', width: 240 },
  { field: 'cargoMovement', headerName: 'Cargo movement', width: 150 },
];

const TEXTS: CodeLookupTexts = {
  searchLabel: 'Search countries',
  dialogTitle: 'Countries',
  notFound: (code) => `No country with code ${code}. Pick one with the search button.`,
  /** Legacy alert "Error Loading Country Details" (Supplier; "… SFOS Shipper Details" by mistake, U5). */
  loadFailed: 'The country could not be loaded. Try again.',
  listFailed: 'The country list could not be loaded. Try the search button again.',
  listEmpty: 'There are no countries to choose from.',
};

export interface CountryLookupFieldProps {
  /** The country code in the form. */
  code: string;
  /** The country's name, shown under the field (not saved). */
  countryName: string;
  onChange: (code: string, countryName: string) => void;
  readOnly?: boolean;
  label?: string;
  /** Shown under an empty field, e.g. "Optional." */
  emptyHelp?: string;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Country of a port, DC or supplier: `CodeLookupField` on `api/v1/master-data/countries` (the list for the search
 * button, the country by code for its name). Enter only commits the code (legacy `findCountryCode` was undefined).
 */
export function CountryLookupField({
  code,
  countryName,
  onChange,
  readOnly,
  label = 'Country',
  emptyHelp,
  inputRef,
}: CountryLookupFieldProps) {
  const [loadCountries] = useLazyGetCountriesQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  return (
    <CodeLookupField<Country>
      label={label}
      code={code}
      displayName={countryName}
      onChange={onChange}
      loadList={() => loadCountries()}
      loadName={(c) =>
        loadCountry(c).then((r) => ({
          data: r.data ? { name: r.data.countryName } : undefined,
          error: r.error,
        }))
      }
      columns={COUNTRY_LOOKUP_COLUMNS}
      getCode={(r) => r.countryCode}
      texts={TEXTS}
      readOnly={readOnly}
      emptyHelp={emptyHelp}
      maxLength={10}
      inputRef={inputRef}
    />
  );
}
