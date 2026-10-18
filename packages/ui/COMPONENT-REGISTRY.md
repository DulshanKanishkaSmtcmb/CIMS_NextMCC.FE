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

- **Purpose:** Wrap the app once: MUI theme with the light and dark colour schemes, CSS reset, notistack toasts, scan feedback settings.
- **Wraps:** `ThemeProvider`, `CssBaseline`, notistack `SnackbarProvider`.
- **Key props:** `theme?` (default `cimsTheme`), `defaultMode?` (`light` | `dark` | `system`, default `system` = prefers-color-scheme), `scanFeedback?` (`{ sounds?, muted?, volume? }`), `maxToasts?` (default 3).
- **Theme modes:** the chosen mode is kept in localStorage under `CIMS_MODE_STORAGE_KEY` (`toolpad-mode`, the same key the Toolpad `AppProvider` of the shell uses, so pages inside and outside the shell agree); `disableTransitionOnChange` avoids a colour sweep. Switch it with `ThemeModeToggle`.
- **Usage:**
  ```tsx
  <CimsThemeProvider scanFeedback={{ sounds: { error: '/Sounds/computer_error.mp3' } }}>
    <App />
  </CimsThemeProvider>
  ```
- **Tests:** used by every test in this package.

### theme.ts: cimsTheme, cimsTokens (status: available)

- **Purpose:** The CIMS theme (light and dark colour schemes on CSS variables, selector `[data-light]` / `[data-dark]` on `<html>`, default mode `system`) with dense defaults for scanner stations, and the token table behind it.
- **Tokens:** `cimsTokens.palette` (with `textPrimary`, `textSecondary`, `divider`), `.status` (success/warning/error/info/neutral, each `main`/`fg`/`bg`, AA contrast), `.typography` (14 px base since 2026-10-18, was 13), `.radius` (6), `.spacing`, `.scanner` (`inputFontSize`, `inputMinHeight`), `.focusRing`, `.layout` (page paddings, content max width, aside widths), `.density` (`touchTarget` 44 px). Dark scheme: `cimsTokens.darkPalette`, `.darkStatus`, `.focusRing.darkColor`. Read them in `sx` as `theme.cims.*`: `theme.cims.status.*` and `theme.cims.focusRing.color` are `var(--mui-palette-…)` references that follow the active scheme, so never pass them to `alpha()`; for translucency use the channel variables (`rgba(${theme.vars.palette.background.paperChannel} / 0.6)`). Palette additions: `palette.status`, `palette.focusRing`.
- **Type scale:** `h1` page title (1.5 rem/600), `h2` section (1.125 rem/600), `h3` group (1 rem/600); buttons sentence case (`textTransform: none`).
- **Global:** visible focus ring on every ButtonBase (`.Mui-focusVisible`), soft focus halo on outlined inputs, `prefers-reduced-motion` honoured, `<kbd>` styling for shortcut legends. Rationale: legacy workspace `docs/19-ux-design-principles.md` section 8.
- **Defaults set once:** TextField, Select, FormControl, Button, IconButton, Table are `small`; DataGrid is `compact`; Paper is `outlined`.
- **Changing a token** changes every screen. Treat it as a design decision, not a tweak.
- **Tests:** `components/layout.test.tsx`, `components/themeModes.test.tsx` (both schemes defined, AA contrast of every text/status pair in both).

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
- **Key props:** `label`, `value: string`, `options` (strings, or `{ value, label }` pairs, shown in order), `onChange(value)`, `ariaLabel` (name when there is no visible label, e.g. in a table cell), `inputRef`, `id`, `name`, `disabled`, `required`, `error`, `helperText`, `fullWidth` (default `true`).
- **Usage:** `<SelectField label="Shipment" value={v} options={['Local', 'Import']} onChange={setV} />` (with react-hook-form: inside a `Controller`).
- **Tests:** `components/formFields.test.tsx`.

### TextInput (status: available)

- **Purpose:** Plain typed text field, and read-only display boxes (legacy `readonly="readonly"` inputs). Scanner fields use `ScanInput`.
- **Wraps:** `TextField`.
- **Key props:** `label`, `value`, `onChange?` (omit for read-only), `onBlur?`, `readOnly?`, `ariaLabel?` (when there is no visible label), `rows?` (a text area of at least that many rows, legacy `<textarea>`; OK-to-Load Reason detail), `inputRef`, `id`, `name`, `placeholder`, `disabled`, `required`, `error`, `helperText`, `fullWidth` (default `true`), `maxLength?` (the API validator's limit; typing stops there), `showCount?` ("n/max" under the field; default when the limit is 20 or less and the field is editable).
- **Notes:** read-only fields (here and in `LookupField`) get the theme's read-only look: tinted background, dashed outline (`MuiInputBase-readOnly`).
- **Usage:** `<TextInput ariaLabel="Country name" value={countryName} />`
- **Tests:** `components/formFields.test.tsx`.

### LookupField (status: available)

- **Purpose:** Code field with a search button: the legacy "input + magnifier button + dialog with a DataTable" lookup (Country, Ports, DC pages). Pair it with `LookupDialog`.
- **Wraps:** `TextField` with an `InputAdornment` and `IconButton` (Search icon).
- **Key props:** `value` (the committed value), `onCommit(text)` (blur or Enter, only when the text changed; like a Knockout `value` binding, not every keystroke), `onEnter()` (after the commit; legacy `returnKey`), `onSearch()`, `readOnly`, `searchDisabled`, `hideSearch` (no search button at all, legacy `visible:` binding; PM Master in New mode), `id` (the legacy element id, e.g. `CountryCode`), `searchId` (the button id, e.g. `btnCountryCode`), `searchLabel`, `ariaLabel` (name of the input when there is no visible label, e.g. in a table cell), `label`, `inputRef`, `name`, `disabled`, `fullWidth`.
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

| Component | Purpose                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| AppShell  | Layout with navigation, header and content area (the app currently uses Toolpad `DashboardLayout` directly). |

---

## UX foundation: page templates, states, form layout, shortcuts (2026-10-18)

The design rules behind these are in the legacy workspace `docs/19-ux-design-principles.md` (page anatomy, page types, forms, feedback, tables, tokens, accessibility, wording, review checklist). Every page uses `PageShell` directly or through a template. Showcase: `apps/web/src/pages/Data/ConfirmArrivalPage.tsx` (OperationalPage).

### PageShell (status: available)

- **Purpose:** The one page frame: context line, the page's single h1 with an optional status, secondary + primary actions on the right, an optional toolbar line (shortcuts legend), content with the token paddings and max width, optional sticky footer.
- **Wraps:** `Box`, `Stack`, `Typography`.
- **Key props:** `title`, `context?`, `status?`, `primaryAction?`, `secondaryActions?`, `toolbar?`, `footer?` (an `ActionBar`), `width?` (`content` default, `full` for wide grids), `children`.
- **Usage:** `<PageShell title="Countries" context="File · Master data" primaryAction={<Button variant="contained">New country</Button>}>…</PageShell>`
- **Tests:** `templates/templates.test.tsx`.

### ActionBar (status: available)

- **Purpose:** Sticky bottom bar of a task page: the input the commit needs (e.g. a date) and a summary on the left, the actions on the right (primary last), an optional message row (ErrorState, success hint). Buttons get the 44 px touch target.
- **Wraps:** `Box` (`position: sticky; bottom: 0` inside the scrolling main area), `Stack`.
- **Key props:** `start?`, `children` (actions), `message?`, `label?` (region name, default "Page actions").
- **Tests:** `templates/templates.test.tsx`.

### OperationalPage (status: available)

- **Purpose:** Template for scan/task pages: scan area on top, results with a context/progress aside, sticky action bar. Below `md` the aside stacks above the results.
- **Wraps:** `PageShell`, CSS grid.
- **Key props:** all `PageShell` props except `footer`/`width`, plus `scanArea?`, `aside?`, `asideLabel?`, `asidePosition?` (`end` default, `start`), `asideWidth?` (`narrow` 320 / `wide` 420 px tokens), `actionBar?`, `children` (results).
- **Usage:** see `ConfirmArrivalPage.tsx` (step 1 filters as `scanArea`, step 2 pick list as `aside`, step 3 lists as `children`, date + totals + Confirm in the `ActionBar`).
- **Tests:** `templates/templates.test.tsx`.

### MasterDataPage (status: available)

- **Purpose:** Template for master-data pages: searchable list + detail panel (drawer below `md`) with `idle`/`view`/`edit`/`new` modes, a dirty-state guard (ConfirmDialog "Discard unsaved changes?" with focus on "Keep editing", plus the browser's `beforeunload` prompt), Cancel/Save conventions, a mode chip, and keyboard shortcuts with a legend (`/` search, Alt+N new, Alt+E edit, Ctrl+S save, Esc cancel).
- **Wraps:** `PageShell`, `TextField` (search), `List`/`ListItemButton`, `Drawer`, `ConfirmDialog`, `EmptyState`, `ErrorState`, `ListSkeleton`/`FormSkeleton`, `StatusChip`, `ShortcutsLegend`, `useMediaQuery`.
- **Key props:** `title` (plural), `entityName` (singular, lower case), `items`, `getItemId`, `renderItem → { primary, secondary?, meta? }`, `getSearchText` (every search word must occur), `search?`/`onSearchChange?`, `listLoading?`, `listError?`, `onRetryList?`, `selectedId`, `onSelect`, `mode`, `onNew?`, `onEdit?`, `onCancel`, `onSave`, `saving?`, `dirty?`, `detailTitle?`, `detailLoading?`, `detailMessage?` (ValidationSummary / ErrorState), `detailLayout?` (`auto` | `panel` | `drawer`), `secondaryActions?`, `onClose?` (quiet header Close, behind the guard), `children` (the form; the page makes fields read-only in `view`).
- **Notes:** the template never validates or saves; the page does, and reports through `detailMessage` and the fields. Enter never saves (scanners send Enter); Ctrl+S does. Enter in the search box opens the record whose id equals the typed text (case-insensitive), or the only match (the keyboard path that replaces the legacy "type the code + Enter"). Migration steps: `docs/19` section 14.
- **Tests:** `templates/templates.test.tsx` (search, empty search, open, view/edit, guard, shortcuts, `/`, load failure, skeleton, drawer).

### FormSection, FieldGrid, FieldGridItem (status: available)

- **Purpose:** `FormSection` is a titled, labelled `<section>` (optional step number badge, description, status, right-side actions; `card` or `plain`). `FieldGrid` lays fields out in equal responsive columns (default `{ xs: 1, sm: 2, md: 3 }`) so DOM order = reading order = tab order; `FieldGridItem span={n|'full'}` widens one cell. Replaces the planned FormSection, and the web app's local `SectionBox` for new work.
- **Key props:** FormSection `title`, `description?`, `step?`, `actions?`, `status?`, `variant?`, `headingLevel?` (2 default, 3), `id?`; FieldGrid `columns?`, `gap?`, `alignItems?`.
- **Tests:** `components/uxFoundation.test.tsx`.

### StatusChip (status: available)

- **Purpose:** Canonical status rendering: icon + word in the tone's tinted colours (`theme.cims.status`), never colour alone.
- **Key props:** `tone` (`success` | `warning` | `error` | `info` | `neutral`), `label`, `icon?`, `size?`.
- **Usage:** `<StatusChip tone="warning" label="Unsaved changes" />`
- **Tests:** `components/uxFoundation.test.tsx`.

### EmptyState, ErrorState (status: available)

- **Purpose:** `EmptyState` says what is empty and what to do next (title, description, one action; `compact` for panels). `ErrorState` is a blocking failure: `role="alert"`, title, what happened to the user's work, the server's own text as `details` (verbatim), `onRetry`, extra `actions`, `onClose`.
- **Usage:** `<ErrorState title="Data not saved" message="Nothing was changed." details={serverMessage} onRetry={save} />`
- **Tests:** `components/uxFoundation.test.tsx`.

### TableSkeleton, ListSkeleton, FormSkeleton (status: available)

- **Purpose:** Loading placeholders shaped like what is coming (grid, list of lines, form); announced once as `role="status"` with `label`, shapes hidden from screen readers. Use them instead of spinners and blocking overlays for reads.
- **Tests:** `components/uxFoundation.test.tsx`.

### InlineHint, ValidationSummary (status: available)

- **Purpose:** The inline validation and guidance convention. `InlineHint` is one icon + text line in a tone (`info`, `success`, `warning`, `error`; `boxed` variant); errors are announced (`role="alert"`), `live` announces other tones, static guidance is silent. Give it an `id` for `aria-describedby`. `ValidationSummary` lists the problems that stopped a save, takes focus when it appears, and each item is a link-button that focuses its field.
- **Tests:** `components/uxFoundation.test.tsx`.

### SegmentedControl (status: available)

- **Purpose:** One choice among two to five, all visible (ToggleButtonGroup, exclusive, cannot be cleared), visible label as the group name, 40 px+ buttons. Confirm Arrivals' Shipment Local / Import. More than five choices: `SelectField`.
- **Key props:** `label`, `value`, `options` (as `SelectField`), `onChange`, `disabled?`, `fullWidth?`.
- **Tests:** `components/uxFoundation.test.tsx`.

### StatGroup, formatNumber (status: available)

- **Purpose:** `StatGroup` shows key figures as a `<dl>` (`small` inline for table footers, `large` stacked for action bars); the text reads "Label: value". `formatNumber(value, decimals, { fixed? })` is the shared number formatter (en-GB separators, at most `decimals`, no trailing zeros unless `fixed`); rounding stays with the page.
- **Tests:** `components/uxFoundation.test.tsx`.

### useKeyboardShortcuts, ShortcutsLegend (status: available)

- **Purpose:** Page shortcuts on `window` with a visible legend. Keys like `ctrl+s`, `ctrl+enter`, `alt+l` (letters also match by physical key), `escape`, `/`; `mod` = Ctrl/Cmd. Plain keys never fire while typing in a field (combinations do); plain keys skip events a component already handled (ScanInput's Enter); plain Escape is left to open dialogs and menus. `enabled: false` keeps the entry in the legend, dimmed. Helpers `matchesShortcut`, `formatShortcut`.
- **Usage:** `const shortcuts = [{ keys: 'ctrl+enter', description: 'Confirm arrival', handler: save }]; useKeyboardShortcuts(shortcuts); <ShortcutsLegend shortcuts={shortcuts} />`
- **Notes:** do not bind keys the browser or Windows owns (Ctrl+W/T/N/L/P, Alt+F4, F5). The reserved CIMS set is in docs/19 section 5.4.
- **Tests:** `components/uxFoundation.test.tsx`, `templates/templates.test.tsx`.

### ThemeModeToggle (status: available)

- **Purpose:** Light / dark / system switch for the app bar: an icon button showing the current mode ("Theme: System (dark)" as its name and tooltip) that opens a menu of the three modes (`menuitemradio`, checked state, 44 px rows). System is the default and follows the operating system.
- **Wraps:** `IconButton`, `Tooltip`, `Menu`, `MenuItem`, MUI `useColorScheme`.
- **Key props:** `userId?`: also keeps the choice per signed-in user (`cims-theme-mode:<userId>` in localStorage) and restores it when that user signs in, for shared station PCs.
- **Usage:** in the shell's Toolpad `toolbarActions` slot: `<ThemeModeToggle userId={profile?.sub} />` (`apps/web/src/layouts/AppLayout.tsx`).
- **Notes:** needs `CimsThemeProvider` or the Toolpad `AppProvider` with `cimsTheme` above it. Design rules for both modes: docs/19 section 8.1.
- **Tests:** `components/themeModes.test.tsx`.
