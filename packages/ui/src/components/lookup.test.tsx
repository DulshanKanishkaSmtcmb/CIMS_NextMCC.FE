import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { LookupDialog, type LookupColumn } from './LookupDialog';
import { LookupField, type LookupFieldProps } from './LookupField';
import { lookupCellText } from './lookupText';

function Field(props: Partial<LookupFieldProps> & { initial?: string }) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <CimsThemeProvider>
      <LookupField
        label="Code"
        id="Code"
        searchId="btnCode"
        value={value}
        onCommit={(next) => {
          props.onCommit?.(next);
          setValue(next);
        }}
        onSearch={props.onSearch ?? (() => undefined)}
        onEnter={props.onEnter}
        readOnly={props.readOnly}
        searchDisabled={props.searchDisabled}
        hideSearch={props.hideSearch}
      />
      <button type="button" onClick={() => setValue('FROM-PAGE')}>
        Set from page
      </button>
    </CimsThemeProvider>
  );
}

describe('LookupField', () => {
  it('commits the typed text on blur, not on every keystroke', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Field onCommit={onCommit} />);

    await user.type(screen.getByRole('textbox', { name: 'Code' }), 'ABC');
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('ABC');
  });

  it('commits a changed text on Enter and then calls onEnter, without a second commit on blur', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    render(
      <Field onCommit={(v) => order.push(`commit:${v}`)} onEnter={() => order.push('enter')} />,
    );

    await user.type(screen.getByRole('textbox', { name: 'Code' }), 'XY{Enter}');
    await user.tab();

    expect(order).toEqual(['commit:XY', 'enter']);
  });

  it('calls onEnter without a commit when the text did not change', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onEnter = vi.fn();
    render(<Field initial="IND" onCommit={onCommit} onEnter={onEnter} readOnly />);

    await user.click(screen.getByRole('textbox', { name: 'Code' }));
    await user.keyboard('{Enter}');

    expect(onCommit).not.toHaveBeenCalled();
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it('is read-only on request and still searches', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<Field initial="IND" readOnly onSearch={onSearch} />);

    const input = screen.getByRole('textbox', { name: 'Code' });
    expect(input).toHaveAttribute('readonly');
    await user.type(input, 'Z');
    expect(input).toHaveValue('IND');

    await user.click(document.getElementById('btnCode') as HTMLElement);
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('disables the search button on request', () => {
    render(<Field searchDisabled />);
    expect(document.getElementById('btnCode')).toBeDisabled();
  });

  it('hides the search button on request', () => {
    render(<Field hideSearch />);
    expect(document.getElementById('btnCode')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Code' })).toBeInTheDocument();
  });

  it('shows a value the page sets, replacing what was typed', async () => {
    const user = userEvent.setup();
    render(<Field />);

    await user.click(screen.getByRole('button', { name: 'Set from page' }));

    expect(screen.getByRole('textbox', { name: 'Code' })).toHaveValue('FROM-PAGE');
  });
});

interface Row {
  code: string;
  name: string;
  active: boolean;
  created: string | null;
  qty: number;
}

const columns: LookupColumn[] = [
  { field: 'code', headerName: 'Code' },
  { field: 'name', headerName: 'Name' },
  { field: 'active', headerName: 'Active', kind: 'boolean' },
  { field: 'created', headerName: 'Created', kind: 'dateTime' },
  { field: 'qty', headerName: 'Qty', kind: 'number' },
];

const rows: Row[] = [
  { code: 'PAK', name: 'PAKISTAN', active: true, created: '2022-08-24T09:42:01', qty: 1200 },
  { code: 'IND', name: 'INDIA', active: false, created: '2022-02-23T00:00:00', qty: 5 },
  { code: 'LKA', name: 'SRI LANKA', active: true, created: null, qty: 0 },
];

function renderDialog(onSelect = vi.fn(), onClose = vi.fn()) {
  render(
    <CimsThemeProvider>
      <LookupDialog<Row>
        open
        title="Things Listing"
        columns={columns}
        rows={rows}
        onSelect={onSelect}
        onClose={onClose}
      />
    </CimsThemeProvider>,
  );
  return { onSelect, onClose, dialog: screen.getByRole('dialog', { name: 'Things Listing' }) };
}

describe('LookupDialog', () => {
  it('lists the rows sorted by the first column with the legacy renderers', () => {
    const { dialog } = renderDialog();

    const bodyRows = within(dialog).getAllByRole('row').slice(1);
    expect(bodyRows.map((r) => within(r).getAllByRole('gridcell')[1].textContent)).toEqual([
      'IND',
      'LKA',
      'PAK',
    ]);
    const pak = bodyRows[2];
    expect(within(pak).getByText('Yes')).toBeInTheDocument();
    expect(within(pak).getByText('24/08/2022 09:42')).toBeInTheDocument();
    expect(within(pak).getByText('1,200')).toBeInTheDocument();
    // midnight shows the date only; a missing date is blank; false is No
    expect(within(bodyRows[0]).getByText('23/02/2022')).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText('No')).toBeInTheDocument();
  });

  it('calls onSelect with the row of the clicked Select button', async () => {
    const user = userEvent.setup();
    const { dialog, onSelect } = renderDialog();

    const indRow = within(dialog).getByText('INDIA').closest('[role="row"]') as HTMLElement;
    await user.click(within(indRow).getByRole('button', { name: 'Select' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(rows[1]);
  });

  it('filters by a column search box on the displayed text, case-insensitively', async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.type(within(dialog).getByRole('textbox', { name: 'Search Name' }), 'an');
    expect(within(dialog).queryByText('INDIA')).not.toBeInTheDocument();
    expect(within(dialog).getByText('PAKISTAN')).toBeInTheDocument();
    expect(within(dialog).getByText('SRI LANKA')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Search Active' }), 'no');
    expect(within(dialog).getByText('No records')).toBeInTheDocument();
  });

  it('closes with the Close button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('lookupCellText', () => {
  it('renders each kind like the legacy DataTable renderers', () => {
    expect(lookupCellText(true, 'boolean')).toBe('Yes');
    expect(lookupCellText(false, 'boolean')).toBe('No');
    expect(lookupCellText(null, 'boolean')).toBe('No');
    expect(lookupCellText('2026-10-18T14:30:00', 'dateTime')).toBe('18/10/2026 14:30');
    expect(lookupCellText('2026-10-18T00:00:00', 'dateTime')).toBe('18/10/2026');
    expect(lookupCellText('2026-10-18T14:30:00', 'date')).toBe('18/10/2026');
    expect(lookupCellText(null, 'dateTime')).toBe('');
    expect(lookupCellText(1234567, 'number')).toBe('1,234,567');
    expect(lookupCellText(null)).toBe('');
    expect(lookupCellText('x')).toBe('x');
  });
});
