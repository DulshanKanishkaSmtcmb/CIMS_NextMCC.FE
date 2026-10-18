import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { formatIsoDate, parseIsoDate } from './dates';
import { DmyDatePicker } from './DmyDatePicker';

describe('date helpers', () => {
  it('parses strict ISO dates only', () => {
    expect(formatIsoDate(parseIsoDate('2026-03-05'))).toBe('2026-03-05');
    expect(parseIsoDate('05/03/2026')).toBeNull();
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });

  it('formats invalid or empty dates as null', () => {
    expect(formatIsoDate(null)).toBeNull();
    expect(formatIsoDate(parseIsoDate('nope'))).toBeNull();
  });
});

describe('DmyDatePicker', () => {
  it('shows an ISO value as dd/MM/yyyy', () => {
    const { container } = render(
      <CimsThemeProvider>
        <DmyDatePicker label="Arrival" value="2026-03-05" onChange={() => undefined} />
      </CimsThemeProvider>,
    );

    const hidden = container.querySelector('input') as HTMLInputElement;
    expect(hidden.value).toBe('05/03/2026');
  });

  it('shows an empty field for null', () => {
    const { container } = render(
      <CimsThemeProvider>
        <DmyDatePicker label="Arrival" value={null} onChange={() => undefined} />
      </CimsThemeProvider>,
    );

    expect((container.querySelector('input') as HTMLInputElement).value).toBe('');
  });

  it('reports typed dates as ISO strings', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Form() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <CimsThemeProvider>
          <DmyDatePicker
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
    await user.keyboard('10032026');

    expect(onChange).toHaveBeenLastCalledWith('2026-03-10');
  });
});
