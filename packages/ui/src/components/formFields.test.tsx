import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { formatDmy, formatIsoDateTime, parseIsoDateTime } from './dates';
import { DmyDatePicker } from './DmyDatePicker';
import { SelectField } from './SelectField';
import { TextInput } from './TextInput';

describe('date-time helpers', () => {
  it('parses strict local ISO date-times only', () => {
    expect(formatIsoDateTime(parseIsoDateTime('2026-10-18T14:30:00'))).toBe('2026-10-18T14:30:00');
    expect(parseIsoDateTime('2026-10-18T14:30:00Z')).toBeNull();
    expect(parseIsoDateTime('18/10/2026 14:30')).toBeNull();
    expect(parseIsoDateTime(null)).toBeNull();
  });

  it('formats API dates for display as dd/MM/yyyy', () => {
    expect(formatDmy('2026-10-17T00:00:00')).toBe('17/10/2026');
    expect(formatDmy('2026-10-18T14:30:00', true)).toBe('18/10/2026 14:30');
    expect(formatDmy(null)).toBe('');
    expect(formatDmy('nonsense')).toBe('');
  });
});

describe('DmyDatePicker withTime', () => {
  it('shows a local ISO date-time as dd/MM/yyyy HH:mm', () => {
    const { container } = render(
      <CimsThemeProvider>
        <DmyDatePicker
          withTime
          label="Arrival"
          value="2026-10-18T14:30:00"
          onChange={() => undefined}
        />
      </CimsThemeProvider>,
    );

    expect((container.querySelector('input') as HTMLInputElement).value).toBe('18/10/2026 14:30');
  });

  it('reports typed date-times as local ISO strings without an offset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Form() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <CimsThemeProvider>
          <DmyDatePicker
            withTime
            label="Arrival"
            value={value}
            onChange={(next) => {
              onChange(next);
              setValue(next);
            }}
          />
        </CimsThemeProvider>
      );
    }
    render(<Form />);

    await user.click(screen.getByRole('spinbutton', { name: 'Day' }));
    await user.keyboard('181020261430');

    expect(onChange).toHaveBeenLastCalledWith('2026-10-18T14:30:00');
  });
});

describe('SelectField', () => {
  it('lists the options in order and reports the chosen value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CimsThemeProvider>
        <SelectField
          label="Shipment"
          value="Local"
          options={['Local', 'Import']}
          onChange={onChange}
        />
      </CimsThemeProvider>,
    );

    await user.click(screen.getByRole('combobox', { name: 'Shipment' }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Local', 'Import']);

    await user.click(screen.getByRole('option', { name: 'Import' }));
    expect(onChange).toHaveBeenCalledWith('Import');
  });

  it('accepts value/label pairs', () => {
    render(
      <CimsThemeProvider>
        <SelectField
          label="Country"
          value="IND"
          options={[{ value: 'IND', label: 'India' }]}
          onChange={() => undefined}
        />
      </CimsThemeProvider>,
    );

    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveTextContent('India');
  });
});

describe('TextInput', () => {
  it('is read-only without onChange', () => {
    render(
      <CimsThemeProvider>
        <TextInput ariaLabel="Country name" value="INDIA" />
      </CimsThemeProvider>,
    );

    const input = screen.getByRole('textbox', { name: 'Country name' });
    expect(input).toHaveValue('INDIA');
    expect(input).toHaveAttribute('readonly');
  });

  it('reports edits when it has onChange', async () => {
    const user = userEvent.setup();
    function Form() {
      const [value, setValue] = useState('');
      return (
        <CimsThemeProvider>
          <TextInput label="Container No" value={value} onChange={setValue} />
          <span data-testid="echo">{value}</span>
        </CimsThemeProvider>
      );
    }
    render(<Form />);

    await user.type(screen.getByLabelText('Container No'), 'MSCU1');
    expect(screen.getByTestId('echo')).toHaveTextContent('MSCU1');
  });
});

describe('table-cell fields without a visible label', () => {
  it('TextInput shows a text area of at least the requested rows', () => {
    render(
      <CimsThemeProvider>
        <TextInput ariaLabel="Detail" rows={3} value="line 1" onChange={() => undefined} />
      </CimsThemeProvider>,
    );

    const area = screen.getByRole('textbox', { name: 'Detail' });
    expect(area.tagName).toBe('TEXTAREA');
    expect(area).toHaveValue('line 1');
  });

  it('SelectField takes its accessible name from ariaLabel', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CimsThemeProvider>
        <SelectField
          ariaLabel="Unit Type"
          value="PCS"
          options={['Storage', 'PCS']}
          onChange={onChange}
        />
      </CimsThemeProvider>,
    );

    const select = screen.getByRole('combobox', { name: 'Unit Type' });
    expect(select).toHaveTextContent('PCS');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Storage' }));
    expect(onChange).toHaveBeenCalledWith('Storage');
  });
});
