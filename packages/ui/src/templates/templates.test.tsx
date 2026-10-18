import { useState } from 'react';
import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { ActionBar } from './ActionBar';
import { MasterDataPage, type MasterDataMode, type MasterDataPageProps } from './MasterDataPage';
import { OperationalPage } from './OperationalPage';
import { PageShell } from './PageShell';

const wrap = (ui: React.ReactElement) => render(<CimsThemeProvider>{ui}</CimsThemeProvider>);

describe('PageShell', () => {
  it('renders context, the h1 title, status, actions, toolbar, content and footer', () => {
    wrap(
      <PageShell
        title="Confirm arrivals"
        context="Booking"
        status={<span>3 selected</span>}
        secondaryActions={<button>Close</button>}
        primaryAction={<button>Confirm</button>}
        toolbar={<span>shortcuts</span>}
        footer={<footer>bar</footer>}
      >
        <p>content</p>
      </PageShell>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Confirm arrivals' })).toBeInTheDocument();
    for (const text of ['Booking', '3 selected', 'shortcuts', 'content', 'bar']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    // Secondary actions come before the primary action (primary is rightmost).
    const close = screen.getByRole('button', { name: 'Close' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(close.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has a single heading when nothing optional is given', () => {
    wrap(<PageShell title="Home">x</PageShell>);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ActionBar', () => {
  it('is a named region with the start content, a message and the actions', () => {
    wrap(
      <ActionBar
        label="Arrival actions"
        start={<span>2 contracts</span>}
        message={<span>Saved</span>}
      >
        <button>Confirm arrival</button>
      </ActionBar>,
    );

    const region = screen.getByRole('region', { name: 'Arrival actions' });
    expect(within(region).getByText('2 contracts')).toBeInTheDocument();
    expect(within(region).getByText('Saved')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Confirm arrival' })).toBeInTheDocument();
  });
});

describe('OperationalPage', () => {
  it('lays out scan area, aside, results and action bar in reading order', () => {
    wrap(
      <OperationalPage
        title="Unload container"
        scanArea={<label>Scan carton</label>}
        aside={<p>Progress 3 of 10</p>}
        asideLabel="Unload progress"
        asidePosition="start"
        actionBar={<ActionBar>{<button>Finish</button>}</ActionBar>}
      >
        <p>Scanned cartons</p>
      </OperationalPage>,
    );

    const aside = screen.getByRole('complementary', { name: 'Unload progress' });
    expect(within(aside).getByText('Progress 3 of 10')).toBeInTheDocument();
    const scan = screen.getByText('Scan carton');
    const results = screen.getByText('Scanned cartons');
    const finish = screen.getByRole('button', { name: 'Finish' });
    expect(scan.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aside.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(results.compareDocumentPosition(finish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('works without an aside or scan area', () => {
    wrap(
      <OperationalPage title="Review">
        <p>rows</p>
      </OperationalPage>,
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByText('rows')).toBeInTheDocument();
  });
});

interface Country {
  code: string;
  name: string;
}

const COUNTRIES: Country[] = [
  { code: 'IND', name: 'India' },
  { code: 'PAK', name: 'Pakistan' },
  { code: 'LKA', name: 'Sri Lanka' },
];

type Handlers = Pick<
  MasterDataPageProps<Country>,
  'onSelect' | 'onNew' | 'onEdit' | 'onCancel' | 'onSave'
>;

function renderMaster(
  props: Partial<MasterDataPageProps<Country>> & { mode?: MasterDataMode } = {},
): Handlers {
  const handlers: Handlers = {
    onSelect: vi.fn(),
    onNew: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onSave: vi.fn(),
  };
  wrap(
    <MasterDataPage<Country>
      title="Countries"
      entityName="country"
      items={COUNTRIES}
      getItemId={(c) => c.code}
      getSearchText={(c) => `${c.code} ${c.name}`}
      renderItem={(c) => ({ primary: c.name, secondary: c.code })}
      selectedId={null}
      mode="idle"
      detailLayout="panel"
      {...handlers}
      {...props}
    >
      <label>
        Country name
        <input defaultValue="India" />
      </label>
    </MasterDataPage>,
  );
  return handlers;
}

describe('MasterDataPage', () => {
  it('lists the records, filters them by every search word and says how many match', async () => {
    const user = userEvent.setup();
    renderMaster();

    const list = screen.getByRole('list', { name: 'Countries' });
    expect(within(list).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('3 of 3')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search countries' }), 'sri lan');
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    expect(within(list).getByText('Sri Lanka')).toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('shows an empty state with Clear search when nothing matches', async () => {
    const user = userEvent.setup();
    renderMaster();

    await user.type(screen.getByRole('searchbox', { name: 'Search countries' }), 'zzz');
    expect(screen.getByText('No countries match “zzz”')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });

  it('asks to select a record when nothing is open and opens one on click', async () => {
    const user = userEvent.setup();
    const h = renderMaster();

    expect(screen.getByRole('heading', { name: 'Select a country' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pakistan/ }));
    expect(h.onSelect).toHaveBeenCalledWith(COUNTRIES[1]);
  });

  it('shows view mode read-only with Edit, and edit mode with Cancel and Save', () => {
    renderMaster({ mode: 'view', selectedId: 'IND' });
    expect(screen.getByText('Viewing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /India/ })).toHaveAttribute('aria-current', 'true');
  });

  it('marks unsaved changes and guards leaving them', async () => {
    const user = userEvent.setup();
    const h = renderMaster({ mode: 'edit', selectedId: 'IND', dirty: true });

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pakistan/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    // Destructive dialog: focus starts on the safe choice, so a stray scanner Enter keeps the edits.
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitForElementToBeRemoved(dialog);
    expect(h.onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Pakistan/ }));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    expect(h.onSelect).toHaveBeenCalledWith(COUNTRIES[1]);
  });

  it('does not ask when the form is clean', async () => {
    const user = userEvent.setup();
    const h = renderMaster({ mode: 'edit', selectedId: 'IND', dirty: false });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.onCancel).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('supports the keyboard shortcuts and shows them in a legend', async () => {
    const user = userEvent.setup();
    const h = renderMaster({ mode: 'edit', selectedId: 'IND' });

    const legend = screen.getByRole('list', { name: 'Keyboard shortcuts' });
    expect(within(legend).getByText('Save')).toBeInTheDocument();

    await user.click(screen.getByRole('textbox', { name: 'Country name' }));
    await user.keyboard('{Control>}s{/Control}');
    expect(h.onSave).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    await user.keyboard('{Alt>}n{/Alt}');
    expect(h.onNew).toHaveBeenCalledTimes(1);
  });

  it('focuses the search with / when focus is not in a field', async () => {
    const user = userEvent.setup();
    renderMaster();
    await user.keyboard('/');
    expect(screen.getByRole('searchbox', { name: 'Search countries' })).toHaveFocus();
  });

  it('shows a load failure with a retry', async () => {
    const user = userEvent.setup();
    const onRetryList = vi.fn();
    renderMaster({ listError: 'The server did not answer.', onRetryList });

    expect(screen.getByRole('alert')).toHaveTextContent('Countries could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryList).toHaveBeenCalled();
  });

  it('shows a skeleton while the list loads', () => {
    renderMaster({ listLoading: true });
    expect(screen.getByRole('status', { name: 'Loading countries' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('opens the detail in a drawer on narrow layouts', async () => {
    function Harness() {
      const [mode, setMode] = useState<MasterDataMode>('idle');
      return (
        <MasterDataPage<Country>
          title="Countries"
          entityName="country"
          items={COUNTRIES}
          getItemId={(c) => c.code}
          getSearchText={(c) => c.name}
          renderItem={(c) => ({ primary: c.name })}
          selectedId={mode === 'idle' ? null : 'IND'}
          mode={mode}
          detailLayout="drawer"
          onSelect={() => setMode('view')}
          onCancel={() => setMode('idle')}
          onSave={() => undefined}
        >
          <p>India form</p>
        </MasterDataPage>
      );
    }
    const user = userEvent.setup();
    wrap(<Harness />);

    expect(screen.queryByText('India form')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'India' }));
    expect(await screen.findByText('India form')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('India form')).not.toBeInTheDocument());
  });
});
