import { describe, expect, it } from 'vitest';
import {
  auditText,
  classifySaveFailure,
  formDiffers,
  withoutIssue,
  type DetailNotice,
} from './masterDataPage';

describe('classifySaveFailure', () => {
  it('maps like the legacy saveFailureText: no response, 409, 404, else the server text', () => {
    expect(classifySaveFailure({ message: 'Network Error' })).toEqual({ kind: 'noServer' });
    expect(classifySaveFailure({ status: 409, message: 'x' })).toEqual({ kind: 'exists' });
    expect(classifySaveFailure({ status: 404, message: 'x' })).toEqual({ kind: 'missing' });
    expect(
      classifySaveFailure({ status: 400, message: 'Bad', details: ['Too long', 'Enter X'] }),
    ).toEqual({ kind: 'failed', details: 'Too long Enter X' });
    expect(classifySaveFailure({ status: 500, message: 'Boom' })).toEqual({
      kind: 'failed',
      details: 'Boom',
    });
  });
});

describe('form helpers', () => {
  it('compares a form with its baseline by value', () => {
    expect(formDiffers({ a: 'x', b: true }, { a: 'x', b: true })).toBe(false);
    expect(formDiffers({ a: 'x ', b: true }, { a: 'x', b: true })).toBe(true);
  });

  it('drops the problem of a field that became valid', () => {
    const notice: DetailNotice = {
      kind: 'problems',
      issues: [
        { field: 'name', message: 'Enter the name' },
        { field: 'code', message: 'Enter the code' },
      ],
    };
    expect(withoutIssue(notice, 'name')).toEqual({ kind: 'problems', issues: [notice.issues[1]] });
    expect(withoutIssue(withoutIssue(notice, 'name'), 'code')).toBeNull();
    expect(withoutIssue(notice, 'other')).toBe(notice);
    const saved: DetailNotice = { kind: 'saved', text: 'Saved.' };
    expect(withoutIssue(saved, 'name')).toBe(saved);
  });

  it('writes the audit line', () => {
    const fmt = (d: string) => d.slice(0, 10);
    expect(auditText('2026-08-21T09:38:00', 'u1', fmt)).toBe('2026-08-21 by u1');
    expect(auditText(null, '', fmt)).toBe('—');
    expect(auditText(null, 'u1', fmt)).toBe('by u1');
  });
});
