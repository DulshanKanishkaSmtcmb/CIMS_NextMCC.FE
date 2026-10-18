import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

export interface Tenant {
  id: string;
  name: string;
}

export interface TenantSwitcherProps {
  tenants: readonly Tenant[];
  /** Selected tenant id, or null when none is selected yet. */
  value: string | null;
  onChange: (tenantId: string) => void;
  disabled?: boolean;
  label?: string;
}

/** Select for the tenants a user may work in. Disabled when there is nothing to choose between. */
export function TenantSwitcher({
  tenants,
  value,
  onChange,
  disabled,
  label = 'Tenant',
}: TenantSwitcherProps) {
  const known = tenants.some((tenant) => tenant.id === value);
  return (
    <TextField
      select
      label={label}
      value={known ? value : ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || tenants.length < 2}
      sx={{ minWidth: 160 }}
      slotProps={{ select: { displayEmpty: true } }}
    >
      {tenants.map((tenant) => (
        <MenuItem key={tenant.id} value={tenant.id}>
          {tenant.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
