import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { ListSkeleton, FormSkeleton } from '../components/SkeletonPresets';
import { ShortcutsLegend } from '../components/ShortcutsLegend';
import { StatusChip } from '../components/StatusChip';
import { useKeyboardShortcuts, type KeyboardShortcut } from '../components/useKeyboardShortcuts';
import { PageShell } from './PageShell';

/** idle: nothing open. view: a record is shown read-only. edit: the open record is being changed. new: a new record. */
export type MasterDataMode = 'idle' | 'view' | 'edit' | 'new';

export interface MasterDataListItem {
  primary: ReactNode;
  secondary?: ReactNode;
  /** Right-aligned extra, e.g. a StatusChip ("Inactive"). */
  meta?: ReactNode;
}

export interface MasterDataPageProps<T> {
  /** Page title (plural): "Countries". */
  title: string;
  context?: ReactNode;
  /** Singular, lower case, used in labels and messages: "country". */
  entityName: string;
  items: readonly T[];
  getItemId: (item: T) => string;
  renderItem: (item: T) => MasterDataListItem;
  /** Text the search box matches (every word must occur, case-insensitive): usually code + name. */
  getSearchText: (item: T) => string;
  /** Controlled search text. Omit to let the template keep it. */
  search?: string;
  onSearchChange?: (value: string) => void;
  listLoading?: boolean;
  /** Message when the list failed to load. */
  listError?: string | null;
  onRetryList?: () => void;
  selectedId: string | null;
  /** Open a record (after the dirty-state guard). */
  onSelect: (item: T) => void;
  mode: MasterDataMode;
  /** Start a new record (after the guard). Omit when the entity cannot be created here. */
  onNew?: () => void;
  /** Switch the open record from view to edit. Omit for read-only entities. */
  onEdit?: () => void;
  /** Leave edit/new (after the guard): back to view of the open record, or idle. */
  onCancel: () => void;
  /** Save the form. Validation and the request are the page's job; show problems with detailMessage and the fields. */
  onSave: () => void;
  saving?: boolean;
  /** The form differs from the loaded record: leaving asks first. */
  dirty?: boolean;
  /** Heading of the detail panel. Default "New <entity>" or "<Entity> details". */
  detailTitle?: ReactNode;
  detailLoading?: boolean;
  /** Row above the form: ValidationSummary after a failed save attempt, ErrorState after a failed request. */
  detailMessage?: ReactNode;
  /** The form (fields read-only in view mode: the page decides from `mode`). */
  children: ReactNode;
  /** panel: list and detail side by side. drawer: detail slides over. auto (default): panel from md up. */
  detailLayout?: 'auto' | 'panel' | 'drawer';
  /** Extra header actions (export, print). */
  secondaryActions?: ReactNode;
  'data-testid'?: string;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function matches(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/**
 * Template for master-data pages: searchable list + detail panel with view / edit / new modes, a dirty-state guard,
 * save/cancel conventions and keyboard shortcuts (/, Alt+N, Alt+E, Ctrl+S, Esc). See docs/19 section 3.1.
 */
export function MasterDataPage<T>({
  title,
  context,
  entityName,
  items,
  getItemId,
  renderItem,
  getSearchText,
  search,
  onSearchChange,
  listLoading = false,
  listError,
  onRetryList,
  selectedId,
  onSelect,
  mode,
  onNew,
  onEdit,
  onCancel,
  onSave,
  saving = false,
  dirty = false,
  detailTitle,
  detailLoading = false,
  detailMessage,
  children,
  detailLayout = 'auto',
  secondaryActions,
  'data-testid': testId,
}: MasterDataPageProps<T>) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const asDrawer = detailLayout === 'drawer' || (detailLayout === 'auto' && !wide);

  const [innerSearch, setInnerSearch] = useState('');
  const query = search ?? innerSearch;
  const setQuery = (value: string) => {
    if (search === undefined) setInnerSearch(value);
    onSearchChange?.(value);
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const countId = useId();

  const filtered = useMemo(
    () => (query.trim() ? items.filter((item) => matches(getSearchText(item), query)) : items),
    [items, query, getSearchText],
  );

  const editing = mode === 'edit' || mode === 'new';
  const [pending, setPending] = useState<(() => void) | null>(null);
  const guard = (action: () => void) => {
    if (editing && dirty) setPending(() => action);
    else action();
  };

  // Closing or reloading the tab with unsaved changes asks the browser's own question.
  useEffect(() => {
    if (!(editing && dirty)) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editing, dirty]);

  const newLabel = `New ${entityName}`;
  const shortcuts: KeyboardShortcut[] = [
    { keys: '/', description: 'Search', handler: () => searchRef.current?.focus() },
    {
      keys: 'alt+n',
      description: newLabel,
      handler: () => guard(() => onNew?.()),
      enabled: !!onNew && !saving,
    },
    {
      keys: 'alt+e',
      description: 'Edit',
      handler: () => onEdit?.(),
      enabled: mode === 'view' && !!onEdit,
    },
    { keys: 'ctrl+s', description: 'Save', handler: () => onSave(), enabled: editing && !saving },
    {
      keys: 'escape',
      description: 'Cancel',
      handler: () => guard(onCancel),
      enabled: editing && !saving,
    },
  ];
  useKeyboardShortcuts(shortcuts);

  const list = (
    <Paper sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          inputRef={searchRef}
          type="search"
          fullWidth
          label={`Search ${title.toLowerCase()}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-describedby': countId, autoComplete: 'off' },
          }}
        />
        <Typography
          id={countId}
          variant="caption"
          color="text.secondary"
          component="div"
          aria-live="polite"
          sx={{ mt: 0.5 }}
        >
          {listLoading ? 'Loading…' : `${filtered.length} of ${items.length}`}
        </Typography>
      </Box>
      <Box sx={{ overflowY: 'auto', maxHeight: { md: '68vh' } }}>
        {listError ? (
          <Box sx={{ p: 1.5 }}>
            <ErrorState
              title={`${capitalise(title)} could not be loaded`}
              message={listError}
              onRetry={onRetryList}
            />
          </Box>
        ) : listLoading ? (
          <Box sx={{ p: 2 }}>
            <ListSkeleton label={`Loading ${title.toLowerCase()}`} />
          </Box>
        ) : filtered.length === 0 ? (
          query.trim() ? (
            <EmptyState
              size="compact"
              title={`No ${title.toLowerCase()} match “${query.trim()}”`}
              description="Check the spelling or search by code."
              action={
                <Button variant="outlined" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              size="compact"
              title={`No ${title.toLowerCase()} yet`}
              description={onNew ? `Create the first ${entityName} with ${newLabel}.` : undefined}
            />
          )
        ) : (
          <List dense aria-label={title} disablePadding>
            {filtered.map((item) => {
              const id = getItemId(item);
              const view = renderItem(item);
              return (
                <ListItemButton
                  key={id}
                  selected={id === selectedId}
                  aria-current={id === selectedId ? 'true' : undefined}
                  onClick={() => {
                    if (id !== selectedId) guard(() => onSelect(item));
                  }}
                  sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}
                >
                  <ListItemText
                    primary={view.primary}
                    secondary={view.secondary}
                    slotProps={{ primary: { fontWeight: 600 } }}
                  />
                  {view.meta ? <Box sx={{ ml: 1, flex: 'none' }}>{view.meta}</Box> : null}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Paper>
  );

  const modeChip =
    mode === 'new' ? (
      <StatusChip tone="info" label="New" />
    ) : mode === 'edit' ? (
      dirty ? (
        <StatusChip tone="warning" label="Unsaved changes" />
      ) : (
        <StatusChip tone="info" label="Editing" />
      )
    ) : mode === 'view' ? (
      <StatusChip tone="neutral" label="Viewing" />
    ) : null;

  const heading = detailTitle ?? (mode === 'new' ? newLabel : `${capitalise(entityName)} details`);

  const detail =
    mode === 'idle' ? (
      <Paper>
        <EmptyState
          title={`Select a ${entityName}`}
          description={`Pick one from the list to see its details${onNew ? ', or create a new one' : ''}.`}
          action={
            onNew ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => onNew()}>
                {newLabel}
              </Button>
            ) : undefined
          }
        />
      </Paper>
    ) : (
      <Paper
        component="section"
        aria-label={typeof heading === 'string' ? heading : `${capitalise(entityName)} details`}
        sx={{ p: { xs: 1.5, sm: 2 } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          useFlexGap
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h2" component="h2">
              {heading}
            </Typography>
            {modeChip}
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={(t) => ({ '& .MuiButton-root': { minHeight: t.cims.density.touchTarget - 8 } })}
          >
            {mode === 'view' && onEdit ? (
              <Button variant="contained" onClick={onEdit}>
                Edit
              </Button>
            ) : null}
            {mode === 'view' && asDrawer ? (
              <Button variant="outlined" onClick={onCancel}>
                Close
              </Button>
            ) : null}
            {editing ? (
              <>
                <Button variant="outlined" onClick={() => guard(onCancel)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="contained" onClick={onSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : null}
          </Stack>
        </Stack>
        {detailMessage ? <Box sx={{ mb: 2 }}>{detailMessage}</Box> : null}
        {detailLoading ? <FormSkeleton label={`Loading ${entityName}`} /> : children}
      </Paper>
    );

  return (
    <PageShell
      data-testid={testId}
      title={title}
      context={context}
      width="full"
      secondaryActions={secondaryActions}
      primaryAction={
        onNew ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => guard(() => onNew())}
            disabled={saving}
            sx={(t) => ({ minHeight: t.cims.density.touchTarget - 4 })}
          >
            {newLabel}
          </Button>
        ) : undefined
      }
      toolbar={<ShortcutsLegend shortcuts={shortcuts} />}
    >
      {asDrawer ? (
        <>
          {list}
          <Drawer
            anchor="right"
            open={mode !== 'idle'}
            onClose={() => guard(onCancel)}
            slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560 }, p: 1 } } }}
          >
            {detail}
          </Drawer>
        </>
      ) : (
        <Box
          sx={(t) => ({
            display: 'grid',
            gap: 2,
            alignItems: 'start',
            gridTemplateColumns: `${t.cims.layout.asideWidth.wide}px minmax(0, 1fr)`,
          })}
        >
          {list}
          {detail}
        </Box>
      )}
      <ConfirmDialog
        open={pending !== null}
        destructive
        title="Discard unsaved changes?"
        message={`Your changes to this ${entityName} have not been saved and will be lost.`}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          action?.();
        }}
      />
    </PageShell>
  );
}
