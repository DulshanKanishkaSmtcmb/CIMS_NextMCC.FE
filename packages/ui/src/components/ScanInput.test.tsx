import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { ScanInput, type ScanInputProps } from './ScanInput';

function renderScan(props: Partial<ScanInputProps> = {}) {
  const onScan = vi.fn();
  render(
    <CimsThemeProvider>
      <ScanInput label="Item" onScan={onScan} {...props} />
    </CimsThemeProvider>,
  );
  return { onScan, input: screen.getByLabelText('Item') as HTMLInputElement };
}

describe('ScanInput', () => {
  it('commits the trimmed value on Enter and clears the field', async () => {
    const user = userEvent.setup();
    const { onScan, input } = renderScan();

    await user.type(input, '  ABC-123  {Enter}');

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('ABC-123');
    expect(input.value).toBe('');
  });

  it('keeps the trimmed value when clearOnScan is false', async () => {
    const user = userEvent.setup();
    const { onScan, input } = renderScan({ clearOnScan: false });

    await user.type(input, ' po-77 {Enter}');

    expect(onScan).toHaveBeenCalledWith('po-77');
    expect(input.value).toBe('po-77');
  });

  it('does not commit before Enter or when the field is blank', async () => {
    const user = userEvent.setup();
    const { onScan, input } = renderScan();

    await user.type(input, 'abc');
    expect(onScan).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, '   {Enter}');
    expect(onScan).not.toHaveBeenCalled();
  });

  it('forces upper case when asked to', async () => {
    const user = userEvent.setup();
    const { onScan, input } = renderScan({ forceUppercase: true, clearOnScan: false });

    await user.type(input, 'ab-12{Enter}');

    expect(input.value).toBe('AB-12');
    expect(onScan).toHaveBeenCalledWith('AB-12');
  });

  it('leaves case alone by default', async () => {
    const user = userEvent.setup();
    const { input } = renderScan();

    await user.type(input, 'aB');

    expect(input.value).toBe('aB');
  });

  it('selects the existing content on focus', () => {
    const { input } = renderScan({ defaultValue: 'hello' });

    act(() => input.focus());

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it('works as a controlled input', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    function Controlled() {
      const [text, setText] = useState('');
      return (
        <CimsThemeProvider>
          <ScanInput label="Item" value={text} onValueChange={setText} onScan={onScan} />
          <output data-testid="mirror">{text}</output>
        </CimsThemeProvider>
      );
    }
    render(<Controlled />);

    await user.type(screen.getByLabelText('Item'), 'x1');
    expect(screen.getByTestId('mirror')).toHaveTextContent('x1');

    await user.type(screen.getByLabelText('Item'), '{Enter}');
    expect(onScan).toHaveBeenCalledWith('x1');
    expect(screen.getByTestId('mirror')).toHaveTextContent('');
  });
});
