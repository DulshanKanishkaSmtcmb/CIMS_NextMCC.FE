import { useEffect, useId, useRef } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Link from '@mui/material/Link';

export interface ValidationIssue {
  /** Stable key, usually the field name. */
  field: string;
  /** Specific and actionable: "Enter the country name", not "Invalid input". */
  message: string;
  /** Move focus to the field. When given, the message is a link-styled button. */
  onSelect?: () => void;
}

export interface ValidationSummaryProps {
  issues: readonly ValidationIssue[];
  title?: string;
  /** Move focus to the summary when it appears (after a save attempt). Default true. */
  focusOnShow?: boolean;
  'data-testid'?: string;
}

/**
 * List of the problems that stopped a save, at the top of the form, each one jumping to its field. Shown only after
 * a save attempt; the fields show the same messages inline.
 */
export function ValidationSummary({
  issues,
  title = 'Fix these before saving',
  focusOnShow = true,
  'data-testid': testId,
}: ValidationSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const visible = issues.length > 0;

  useEffect(() => {
    if (visible && focusOnShow) ref.current?.focus();
  }, [visible, focusOnShow]);

  if (!visible) return null;
  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      severity="error"
      variant="outlined"
      aria-labelledby={titleId}
      data-testid={testId}
    >
      <AlertTitle id={titleId} sx={{ fontWeight: 600 }}>
        {title}
      </AlertTitle>
      <ul style={{ margin: 0, paddingInlineStart: '1.25rem' }}>
        {issues.map((issue) => (
          <li key={issue.field}>
            {issue.onSelect ? (
              <Link component="button" type="button" color="inherit" onClick={issue.onSelect}>
                {issue.message}
              </Link>
            ) : (
              issue.message
            )}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
