import { describe, it, expect } from 'vitest';
import {
  validateDays,
  validateSupplementDays,
  validatePausedRemainingDays,
  validateProjectName,
  validateRequirementName,
  validateDescription,
  validateExportWidth,
} from '../validation';

describe('validateDays', () => {
  it('rejects NaN', () => {
    expect(validateDays(NaN)).not.toBeNull();
  });

  it('rejects non-number coerced values', () => {
    // @ts-expect-error testing runtime
    expect(validateDays('abc')).not.toBeNull();
    // @ts-expect-error testing runtime
    expect(validateDays(undefined)).not.toBeNull();
  });

  it('rejects values below 0.5', () => {
    expect(validateDays(0)).not.toBeNull();
    expect(validateDays(0.1)).not.toBeNull();
    expect(validateDays(0.25)).not.toBeNull();
    expect(validateDays(-1)).not.toBeNull();
  });

  it('accepts valid half-step values', () => {
    expect(validateDays(0.5)).toBeNull();
    expect(validateDays(1)).toBeNull();
    expect(validateDays(1.5)).toBeNull();
    expect(validateDays(2)).toBeNull();
    expect(validateDays(10)).toBeNull();
    expect(validateDays(99.5)).toBeNull();
  });

  it('rejects non-half-step values', () => {
    expect(validateDays(0.7)).not.toBeNull();
    expect(validateDays(1.1)).not.toBeNull();
    expect(validateDays(1.3)).not.toBeNull();
    expect(validateDays(2.25)).not.toBeNull();
    expect(validateDays(3.33)).not.toBeNull();
  });
});

describe('validateSupplementDays', () => {
  it('allows zero', () => {
    expect(validateSupplementDays(0)).toBeNull();
  });

  it('rejects negative', () => {
    expect(validateSupplementDays(-1)).not.toBeNull();
    expect(validateSupplementDays(-0.5)).not.toBeNull();
  });

  it('accepts valid half-step > 0', () => {
    expect(validateSupplementDays(0.5)).toBeNull();
    expect(validateSupplementDays(1)).toBeNull();
    expect(validateSupplementDays(3.5)).toBeNull();
  });

  it('rejects non-half-step > 0', () => {
    expect(validateSupplementDays(0.3)).not.toBeNull();
    expect(validateSupplementDays(1.1)).not.toBeNull();
    expect(validateSupplementDays(2.7)).not.toBeNull();
  });

  it('rejects NaN', () => {
    expect(validateSupplementDays(NaN)).not.toBeNull();
  });
});

describe('validatePausedRemainingDays', () => {
  const currentDays = 5;

  it('rejects NaN', () => {
    expect(validatePausedRemainingDays(NaN, currentDays)).not.toBeNull();
  });

  it('rejects below 0.5', () => {
    expect(validatePausedRemainingDays(0, currentDays)).not.toBeNull();
    expect(validatePausedRemainingDays(0.25, currentDays)).not.toBeNull();
  });

  it('rejects above currentDays', () => {
    expect(validatePausedRemainingDays(5.5, currentDays)).not.toBeNull();
    expect(validatePausedRemainingDays(6, currentDays)).not.toBeNull();
  });

  it('accepts valid range with half-step', () => {
    expect(validatePausedRemainingDays(0.5, currentDays)).toBeNull();
    expect(validatePausedRemainingDays(1, currentDays)).toBeNull();
    expect(validatePausedRemainingDays(2.5, currentDays)).toBeNull();
    expect(validatePausedRemainingDays(5, currentDays)).toBeNull();
  });

  it('rejects non-half-step in valid range', () => {
    expect(validatePausedRemainingDays(1.3, currentDays)).not.toBeNull();
    expect(validatePausedRemainingDays(2.7, currentDays)).not.toBeNull();
  });

  it('handles edge case where currentDays = 0.5', () => {
    expect(validatePausedRemainingDays(0.5, 0.5)).toBeNull();
    expect(validatePausedRemainingDays(1, 0.5)).not.toBeNull();
  });
});

describe('validateProjectName', () => {
  it('rejects empty', () => {
    expect(validateProjectName('')).not.toBeNull();
    expect(validateProjectName('   ')).not.toBeNull();
  });

  it('rejects over 100 chars', () => {
    expect(validateProjectName('a'.repeat(101))).not.toBeNull();
  });

  it('accepts valid names', () => {
    expect(validateProjectName('My Project')).toBeNull();
    expect(validateProjectName('a'.repeat(100))).toBeNull();
  });
});

describe('validateRequirementName', () => {
  it('rejects empty', () => {
    expect(validateRequirementName('')).not.toBeNull();
  });

  it('rejects over 200 chars', () => {
    expect(validateRequirementName('a'.repeat(201))).not.toBeNull();
  });

  it('accepts valid names', () => {
    expect(validateRequirementName('Login page')).toBeNull();
  });
});

describe('validateDescription', () => {
  it('rejects empty', () => {
    expect(validateDescription('')).not.toBeNull();
    expect(validateDescription('  ')).not.toBeNull();
  });

  it('rejects over 500 chars', () => {
    expect(validateDescription('a'.repeat(501))).not.toBeNull();
  });

  it('accepts valid', () => {
    expect(validateDescription('Some change reason')).toBeNull();
  });
});

describe('validateExportWidth', () => {
  it('rejects out of range', () => {
    expect(validateExportWidth(100)).not.toBeNull();
    expect(validateExportWidth(199)).not.toBeNull();
    expect(validateExportWidth(2001)).not.toBeNull();
  });

  it('accepts valid range', () => {
    expect(validateExportWidth(200)).toBeNull();
    expect(validateExportWidth(800)).toBeNull();
    expect(validateExportWidth(2000)).toBeNull();
  });
});
