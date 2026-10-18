# Component Registry: packages/ui (@cims/ui)

The anti-duplication contract for the CIMS front ends. Same rules as the Cargo front end.

1. Before creating any component, search this file and `packages/ui/src/`.
2. Extend an existing component with props or variants. Never fork or copy it.
3. A new or changed shared component gets its registry entry in the same change.
4. Application code imports only from `@cims/ui`. It never imports `@mui/*` or `@emotion/*` directly. ESLint enforces this (`no-restricted-imports` in `eslint.config.js`) and the rule must not be disabled.
5. Promotion rule: a feature-local component that a second feature needs moves here. Do not copy it.
6. Theme tokens only. Colours, spacing, typography and scanner sizing come from `theme.ts`. No hex colours or pixel values in `sx` where a token exists.

Entry format: purpose, what it wraps, key props, usage, tests.

---

## Setup

### CimsThemeProvider (status: available)

- **Purpose:** Wrap the app once: MUI theme, CSS reset, notistack toasts, scan feedback settings.
- **Wraps:** `ThemeProvider`, `CssBaseline`, notistack `SnackbarProvider`.
- **Key props:** `theme?` (default `cimsTheme`), `scanFeedback?` (`{ sounds?, muted?, volume? }`), `maxToasts?` (default 3).
- **Usage:**
  ```tsx
  <CimsThemeProvider scanFeedback={{ sounds: { error: '/Sounds/computer_error.mp3' } }}>
    <App />
  </CimsThemeProvider>
  ```
- **Tests:** used by every test in this package.

### theme.ts: cimsTheme, cimsTokens (status: available)

- **Purpose:** Light theme with dense defaults for scanner stations, and the token table behind it.
- **Tokens:** `cimsTokens.palette`, `.typography` (13 px base), `.radius`, `.spacing`, `.scanner` (`inputFontSize`, `inputMinHeight`). Read scanner sizing in `sx` as `theme.cims.scanner.*`.
- **Defaults set once:** TextField, Select, FormControl, Button, IconButton, Table are `small`; DataGrid is `compact`; Paper is `outlined`.
- **Changing a token** changes every screen. Treat it as a design decision, not a tweak.
- **Tests:** `components/layout.test.tsx`.

### Primitives and icons (status: available)

- **Purpose:** The few MUI building blocks pages need, so pages never import MUI.
- **Exports:** `Alert`, `Box`, `Button`, `Checkbox`, `CircularProgress`, `Paper`, `Stack`, `Typography` (plain re-exports with their prop types), and `getMenuIcon(key)` which returns an icon element for keys `home`, `folder`, `inventory`, `reference`, `scan`, `page`.
- **Checkbox** was added for tick columns inside `InventoryGrid` cells (Confirm Arrivals supplier and container lists). Give it an accessible name with `slotProps={{ input: { 'aria-label': ... } }}`.
- **Add to the list** only when a page genuinely needs another primitive. Prefer a purpose-built component below.

---

## Warehouse components

### ScanInput (status: available)

- **Purpose:** Text field for barcode scanners. Enter commits the value.
- **Wraps:** `TextField`.
- **Key props:**

  | Prop                                                                                                          | Meaning                                                                               |
  | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
  | `onScan(value)`                                                                                               | Called with the trimmed value on Enter. Not called for a blank field.                 |
  | `clearOnScan`                                                                                                 | Clear after the scan. Default `true`. When `false` the field keeps the trimmed value. |
  | `forceUppercase`                                                                                              | Upper-case typed and scanned text, like the legacy `capsOn` fields. Default `false`.  |
  | `selectOnFocus`                                                                                               | Select the content when focused. Default `true`.                                      |
  | `value`, `onValueChange`, `defaultValue`                                                                      | Controlled or uncontrolled value.                                                     |
  | `inputRef`                                                                                                    | Ref to the input, for `useFocusChain().ref(key)`.                                     |
  | `label`, `id`, `name`, `placeholder`, `disabled`, `required`, `autoFocus`, `error`, `helperText`, `fullWidth` | As on a text field.                                                                   |

- **Usage:**
  ```tsx
  <ScanInput label="Item No" forceUppercase inputRef={chain.ref('item')} onScan={handleItem} />
  ```
- **Notes:** Enter during IME composition is ignored. With `forceUppercase`, editing in the middle of the text moves the caret to the end; scanners and typing at the end are unaffected.
- **Tests:** `components/ScanInput.test.tsx`.

### useFocusChain (status: available)

- **Purpose:** Ordered focus for scanner screens: after a successful scan, move to the next field.
- **Signature:** `useFocusChain(order: readonly K[], { wrap? })` returns `{ ref(key), focus(key), advance(from?), reset() }`.
- **Behaviour:** `advance()` moves to the next enabled, editable field and returns `true`; at the end it returns `false` (or wraps to the first field when `wrap` is set). Disabled and read-only fields are skipped. `ref(key)` returns a stable callback ref.
- **Usage:**
  ```tsx
  const chain = useFocusChain(['contractNo', 'itemNo'] as const);
  <ScanInput inputRef={chain.ref('contractNo')} onScan={() => chain.advance('contractNo')} />;
  ```
- **Tests:** `components/useFocusChain.test.tsx`.

### ScanFeedback: useScanFeedback, ScanFeedbackProvider, playSound (status: available)

- **Purpose:** Audio and toast feedback for scans.
- **Wraps:** `HTMLAudioElement` and notistack `useSnackbar`.
- **Hook result:** `playSuccess()`, `playError()` (sound only); `notifySuccess(msg)`, `notifyError(msg)`, `notifyWarning(msg)` (toast only); `success(msg?)` (sound plus optional toast); `error(msg)` (sound plus toast).
- **Configuration:** `{ sounds?: { success?, error? }, muted?, volume? }` through `CimsThemeProvider scanFeedback`, `ScanFeedbackProvider`, or the hook argument (hook wins over provider).
- **Defaults:** `DEFAULT_SOUND_URLS` points at the legacy `/Sounds` folder (`button_push.mp3` for success, "Phone Off Hook" for errors as the legacy pages do). The sound files are not part of this repo; the gateway keeps serving `/Sounds` from the legacy host during the migration. A missing file fails silently.
- **Notes:** Browsers may block audio before the first user gesture; `playSound` swallows that. Needs a notistack provider, which `CimsThemeProvider` includes.
- **Tests:** `components/scanFeedback/scanFeedback.test.tsx`.

### InventoryGrid (status: available)

- **Purpose:** Standard grid for lists: dense rows, column defaults, loading and empty states.
- **Wraps:** `@mui/x-data-grid` `DataGrid` (Community only, no Pro or Premium props).
- **Key props:** all `DataGrid` props except `density` and `autoHeight`; plus `columns`, `height?` (omit to size to the rows), `emptyMessage?` (default "No records"), `defaultColumn?`.
- **Column defaults:** `flex: 1`, `minWidth: 120`, sortable, filterable. A column with a `width` keeps that width.
- **Other defaults:** 25 rows per page, page sizes 10/25/50/100, no selection on row click, linear progress while `loading`.
- **Usage:**
  ```tsx
  <InventoryGrid<Row>
    columns={columns}
    rows={rows}
    loading={isLoading}
    emptyMessage="No arrivals"
  />
  ```
- **Notes:** Pass `disableVirtualization` for small fixed lists and in tests (jsdom has no layout). Column type: `InventoryGridColumn<Row>`.
- **Tests:** `components/InventoryGrid.test.tsx`.

### DmyDatePicker (status: available)

- **Purpose:** Date field that shows `dd/MM/yyyy` and exchanges ISO `yyyy-MM-dd` strings with the form. With `withTime` it is a date-time field (legacy `.datetimepicker`): shows `dd/MM/yyyy HH:mm` (24 h) and exchanges local `yyyy-MM-ddTHH:mm:ss` strings with **no offset** (never `toISOString()`; the API rejects UTC values for wall-clock columns).
- **Wraps:** `@mui/x-date-pickers` `DatePicker` / `DateTimePicker` with `AdapterDayjs` (Community).
- **Key props:** `value: string | null`, `onChange(value: string | null)`, `withTime?`, `label`, `minDate?`, `maxDate?` (ISO strings), `disabled`, `readOnly`, `required`, `error`, `helperText`, `fullWidth`, `id`, `name`.
- **Behaviour:** `onChange` gets `null` when the field is cleared or only partly typed. Helpers: `parseIsoDate`, `formatIsoDate`, `parseIsoDateTime`, `formatIsoDateTime`, `formatDmy(value, withTime?)` (display an API date in a grid cell), `DMY_DISPLAY_FORMAT`, `DMY_TIME_DISPLAY_FORMAT`, `ISO_DATE_FORMAT`, `ISO_DATE_TIME_FORMAT`.
- **Not ported:** the legacy pickers' red Sundays.
- **Usage:**
  ```tsx
  <DmyDatePicker
    label="Arrival date"
    value={form.arrivalDate}
    onChange={(v) => setValue('arrivalDate', v)}
  />
  ```
- **Tests:** `components/DmyDatePicker.test.tsx`, `components/formFields.test.tsx` (withTime).

### SelectField (status: available)

- **Purpose:** Single-choice drop-down (legacy Knockout `<select data-bind="options: ..., value: ...">`).
- **Wraps:** `TextField select`, `MenuItem`.
- **Key props:** `label`, `value: string`, `options` (strings, or `{ value, label }` pairs, shown in order), `onChange(value)`, `inputRef`, `id`, `name`, `disabled`, `required`, `error`, `helperText`, `fullWidth` (default `true`).
- **Usage:** `<SelectField label="Shipment" value={v} options={['Local', 'Import']} onChange={setV} />` (with react-hook-form: inside a `Controller`).
- **Tests:** `components/formFields.test.tsx`.

### TextInput (status: available)

- **Purpose:** Plain typed text field, and read-only display boxes (legacy `readonly="readonly"` inputs). Scanner fields use `ScanInput`.
- **Wraps:** `TextField`.
- **Key props:** `label`, `value`, `onChange?` (omit for read-only), `onBlur?`, `readOnly?`, `ariaLabel?` (when there is no visible label), `inputRef`, `id`, `name`, `placeholder`, `disabled`, `required`, `error`, `helperText`, `fullWidth` (default `true`).
- **Usage:** `<TextInput ariaLabel="Country name" value={countryName} />`
- **Tests:** `components/formFields.test.tsx`.

### LookupField (status: available)

- **Purpose:** Code field with a search button: the legacy "input + magnifier button + dialog with a DataTable" lookup (Country, Ports, DC pages). Pair it with `LookupDialog`.
- **Wraps:** `TextField` with an `InputAdornment` and `IconButton` (Search icon).
- **Key props:** `value` (the committed value), `onCommit(text)` (blur or Enter, only when the text changed; like a Knockout `value` binding, not every keystroke), `onEnter()` (after the commit; legacy `returnKey`), `onSearch()`, `readOnly`, `searchDisabled`, `id` (the legacy element id, e.g. `CountryCode`), `searchId` (the button id, e.g. `btnCountryCode`), `searchLabel`, `label`, `inputRef`, `name`, `disabled`, `fullWidth`.
- **Behaviour:** a `value` set by the page (a dialog selection, a loaded record, New) replaces the typed text. A read-only field still searches unless `searchDisabled`.
- **Usage:**
  ```tsx
  <LookupField
    id="CountryCode"
    searchId="btnCountryCode"
    label="Country Code"
    value={code}
    readOnly={option !== 'New'}
    onCommit={setCode}
    onEnter={findByCode}
    onSearch={openList}
  />
  ```
- **Tests:** `components/lookup.test.tsx`.

### LookupDialog (status: available)

- **Purpose:** Modal list with a Select button on every row and a search box per column: the legacy `GetApiDataForDialogBox` / `LoadListDialog` (Bootstrap modal + DataTable).
- **Wraps:** `Dialog`, `InventoryGrid`, `TextField` (the search boxes), `Button`.
- **Key props:** `open`, `title` ("Countries Listing"), `columns: LookupColumn[]` (`field`, `headerName`, `kind?` = `text` | `number` | `boolean` | `date` | `dateTime`, `width?`), `rows`, `onSelect(row)` (the dialog does not close itself), `onClose`, `getRowId?`.
- **Behaviour:** sorted by the first column, 10 rows per page (10/25/50/100; the legacy "All" is not offered, Community grid limit). `boolean` shows Yes/No, `date` dd/MM/yyyy, `dateTime` dd/MM/yyyy plus HH:mm unless it is midnight, `number` thousands separators and no decimals (legacy renderers). The search boxes match the displayed text anywhere in the cell, case-insensitively, and combine with AND. They sit above the grid and wrap (legacy: in the table footer).
- **Helper:** `lookupCellText(value, kind)` (also exported) is the display text used by the grid and the search boxes.
- **Usage:**
  ```tsx
  <LookupDialog
    open
    title="Ports Listing"
    columns={PORT_COLUMNS}
    rows={ports}
    onSelect={pick}
    onClose={close}
  />
  ```
- **Tests:** `components/lookup.test.tsx`.

### BlockingOverlay (status: available)

- **Purpose:** Blocks input while a request runs and shows a message (replaces legacy `BlockShow` and `blockUI`).
- **Wraps:** `Backdrop`, `CircularProgress`.
- **Key props:** `open`, `message?` (default "Processing request..."), `contained?` (cover only the nearest positioned parent instead of the whole window).
- **Usage:** `<BlockingOverlay open={isSaving} message="Saving arrival..." />`
- **Tests:** `components/overlays.test.tsx`.

### ConfirmDialog (status: available)

- **Purpose:** Confirmation before destructive actions.
- **Wraps:** `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `Button`.
- **Key props:** `open`, `title`, `message?`, `children?`, `confirmLabel?`, `cancelLabel?`, `destructive?` (red button, initial focus on Cancel so a stray scanner Enter cannot confirm), `loading?` (disables buttons and Escape), `onConfirm`, `onCancel`.
- **Usage:** `<ConfirmDialog open={open} destructive title="Delete line?" onConfirm={remove} onCancel={close} />`
- **Tests:** `components/overlays.test.tsx`.

### PageLoading (status: available)

- **Purpose:** Fallback while a lazily loaded page downloads. Use it as the `Suspense` fallback.
- **Wraps:** `Box`, `CircularProgress`.
- **Key props:** `label?` (screen reader text, default "Loading page"), `fullScreen?` (fill the window height, for the first load).
- **Usage:** `<Suspense fallback={<PageLoading />}><Outlet /></Suspense>`
- **Tests:** `components/overlays.test.tsx`.

### PageHeader (status: available)

- **Purpose:** Page title block with optional subtitle and actions.
- **Wraps:** `Stack`, `Typography` (title is the page's level 1 heading).
- **Key props:** `title`, `subtitle?`, `actions?` (nodes aligned right).
- **Usage:** `<PageHeader title="Field captions" actions={<Button>Reload</Button>} />`
- **Tests:** `components/layout.test.tsx`.

### TenantSwitcher (status: available)

- **Purpose:** Select among the tenants a user may work in. Disabled when there is nothing to choose between.
- **Wraps:** `TextField select`, `MenuItem`.
- **Key props:** `tenants: { id, name }[]`, `value: string | null`, `onChange(id)`, `disabled?`, `label?`.
- **Notes:** Presentation only. Tenancy is enforced server side; this component never decides what a user may access.
- **Tests:** `components/layout.test.tsx`.

---

## Planned (not built yet)

Add these when a migrated page needs them. Build them here, not in the page.

| Component              | Purpose                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| AppShell               | Layout with navigation, header and content area (the app currently uses Toolpad `DashboardLayout` directly). |
| FormSection            | Titled group of form fields with consistent spacing.                                                         |
| EmptyState, ErrorState | Standard views for data screens (the grid has its own empty state).                                          |
| StatusChip             | Canonical rendering of entity status.                                                                        |
