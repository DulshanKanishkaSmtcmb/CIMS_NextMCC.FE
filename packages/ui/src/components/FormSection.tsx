import { useId, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export interface FormSectionProps {
  /** Short noun phrase or task: "Find pending contracts". */
  title: string;
  /** One line under the title: what this section is for or what to do. */
  description?: ReactNode;
  /** Step number for task pages that go in order (1, 2, 3). Shown as a badge before the title. */
  step?: number;
  /** Small controls on the right of the title row (e.g. "Add all"). */
  actions?: ReactNode;
  /** Status or count next to the title (e.g. a StatusChip). */
  status?: ReactNode;
  /** card: outlined surface with padding (default). plain: no surface, for nesting inside another card. */
  variant?: 'card' | 'plain';
  /** Heading level of the title. Default 2 (sections of a page whose title is the h1). */
  headingLevel?: 2 | 3;
  id?: string;
  children: ReactNode;
  'data-testid'?: string;
}

/** A titled group of related fields or content: the unit pages are built from. Rendered as a labelled <section>. */
export function FormSection({
  title,
  description,
  step,
  actions,
  status,
  variant = 'card',
  headingLevel = 2,
  id,
  children,
  'data-testid': testId,
}: FormSectionProps) {
  const titleId = useId();
  const body = (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          {step !== undefined ? (
            <Box
              aria-hidden
              sx={{
                flex: 'none',
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'grid',
                placeItems: 'center',
                typography: 'caption',
                fontWeight: 700,
              }}
            >
              {step}
            </Box>
          ) : null}
          <Typography
            id={titleId}
            component={headingLevel === 2 ? 'h2' : 'h3'}
            variant={headingLevel === 2 ? 'h2' : 'h3'}
          >
            {step !== undefined ? (
              <span className="visually-hidden">{`Step ${step}: `}</span>
            ) : null}
            {title}
          </Typography>
          {status}
        </Stack>
        {actions ? (
          <Stack direction="row" spacing={1} alignItems="center">
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {description ? (
        <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: -0.5 }}>
          {description}
        </Typography>
      ) : null}
      {children}
    </Stack>
  );

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      id={id}
      data-testid={testId}
      sx={{
        minWidth: 0,
        '& .visually-hidden': {
          // 1px, not 1: in sx a width of 1 means 100%, which stuck out of the page
          position: 'absolute',
          width: '1px',
          height: '1px',
          margin: '-1px',
          padding: 0,
          border: 0,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        },
      }}
    >
      {variant === 'card' ? <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>{body}</Paper> : body}
    </Box>
  );
}
