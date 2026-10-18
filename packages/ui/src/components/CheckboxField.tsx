import { useId, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';

export interface CheckboxFieldProps {
  /** Visible label, clickable with the box (a large target). */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** One line under the label: what ticking it means. */
  helperText?: ReactNode;
  disabled?: boolean;
  /** The helper text is a problem (shown in the error colour and announced with the field). */
  error?: boolean;
  id?: string;
  'data-testid'?: string;
}

/**
 * A yes/no field of a form: checkbox with its label as one click target (at least the touch-target height) and an
 * optional explanation under it. In a read-only view show the value as text ("Yes" / "No") instead of a disabled box.
 */
export function CheckboxField({
  label,
  checked,
  onChange,
  helperText,
  disabled,
  error,
  id,
  'data-testid': testId,
}: CheckboxFieldProps) {
  const helpId = useId();
  return (
    <Box data-testid={testId} sx={{ minWidth: 0 }}>
      <FormControlLabel
        label={label}
        disabled={disabled}
        control={
          <Checkbox
            id={id}
            checked={checked}
            onChange={(_, value) => onChange(value)}
            slotProps={{
              input: {
                'aria-describedby': helperText ? helpId : undefined,
                'aria-invalid': error || undefined,
              } as object,
            }}
          />
        }
        sx={(theme) => ({ minHeight: theme.cims.density.touchTarget - 4, mr: 0 })}
      />
      {helperText ? (
        <FormHelperText id={helpId} error={error} sx={{ mt: -0.5, ml: 4 }}>
          {helperText}
        </FormHelperText>
      ) : null}
    </Box>
  );
}
