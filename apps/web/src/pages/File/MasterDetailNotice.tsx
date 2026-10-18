import { ErrorState, InlineHint, ValidationSummary } from '@cims/ui';
import { SHARED_MESSAGES, type DetailNotice } from './masterDataPage';

export interface MasterDetailNoticeProps {
  notice: DetailNotice | null;
  /** Retry of the request that failed (shown when the notice asks for it). */
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * The one message row above a master-data form: the save result, the problems that stopped a save (each jumps to its
 * field), or a blocking failure with the server's text verbatim and what happened to the user's work (docs/19 5.3).
 */
export function MasterDetailNotice({ notice, onRetry, onDismiss }: MasterDetailNoticeProps) {
  if (!notice) return null;
  if (notice.kind === 'saved') {
    return (
      <InlineHint tone="success" live boxed data-testid="save-result">
        {notice.text}
      </InlineHint>
    );
  }
  if (notice.kind === 'problems') {
    return (
      <ValidationSummary
        title={SHARED_MESSAGES.fixBeforeSaving}
        issues={notice.issues}
        data-testid="save-problems"
      />
    );
  }
  return (
    <ErrorState
      data-testid="detail-error"
      title={notice.title}
      message={notice.message}
      details={notice.details}
      onRetry={notice.retry ? onRetry : undefined}
      onClose={onDismiss}
    />
  );
}
