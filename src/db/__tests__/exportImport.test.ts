/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';

// We test validateImportData indirectly via importData (which calls it).
// Since importData needs IndexedDB, we test the validation logic by
// extracting it or calling importData and catching errors.
// The validateImportData function is private, so we'll test via importData's error path.

// For a pure unit test, we can import and test via the module's error messages.
// Since importData calls validateImportData first, we can test by passing bad data
// and asserting on error messages (no DB needed for validation failures).

// Dynamic import to access the module
import { importData } from '../exportImport';

function makeValidExport() {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projects: [{
      id: 'p1',
      name: 'Test Project',
      startDate: '2026-01-01',
      status: 'active',
      isDemo: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      requirements: [{
        id: 'r1',
        projectId: 'p1',
        name: 'Req 1',
        originalDays: 3,
        currentDays: 5,
        isAddedByChange: false,
        status: 'active',
        sortOrder: 0,
        dependsOn: null,
        pausedRemainingDays: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }],
      changes: [{
        id: 'c1',
        projectId: 'p1',
        type: 'add_days',
        targetRequirementId: 'r1',
        role: 'pm',
        personName: null,
        description: 'Added days',
        daysDelta: 2,
        date: '2026-01-15',
        metadata: null,
        screenshots: [],
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      }],
      snapshots: [{
        id: 's1',
        projectId: 'p1',
        changeId: 'c1',
        data: { requirements: [], schedule: { totalDays: 5, originalTotalDays: 3, requirementSchedules: [] } },
        totalDays: 5,
        createdAt: '2026-01-15T00:00:00Z',
      }],
    }],
    personNameCache: [],
  };
}

describe('importData validation', () => {
  // importData will throw with validation errors before touching DB

  it('rejects null data', async () => {
    await expect(importData(null)).rejects.toThrow('数据格式无效');
  });

  it('rejects wrong version', async () => {
    await expect(importData({ version: '2.0', projects: [] })).rejects.toThrow('不支持的版本');
  });

  it('rejects non-array projects', async () => {
    await expect(importData({ version: '1.0', projects: 'nope' })).rejects.toThrow('projects 必须为数组');
  });

  it('rejects duplicate project IDs', async () => {
    const data = {
      version: '1.0',
      projects: [
        { ...makeValidExport().projects[0] },
        { ...makeValidExport().projects[0] }, // duplicate id
      ],
      personNameCache: [],
    };
    await expect(importData(data)).rejects.toThrow('Project id 重复');
  });

  it('rejects invalid project status', async () => {
    const data = makeValidExport();
    data.projects[0].status = 'invalid' as any;
    await expect(importData(data)).rejects.toThrow('无效 status');
  });

  // Half-step validation tests
  it('rejects non-half-step originalDays', async () => {
    const data = makeValidExport();
    data.projects[0].requirements[0].originalDays = 1.3;
    await expect(importData(data)).rejects.toThrow('0.5 的倍数');
  });

  it('rejects non-half-step currentDays', async () => {
    const data = makeValidExport();
    data.projects[0].requirements[0].currentDays = 2.7;
    await expect(importData(data)).rejects.toThrow('0.5 的倍数');
  });

  it('rejects originalDays < 0.5', async () => {
    const data = makeValidExport();
    data.projects[0].requirements[0].originalDays = 0.25;
    await expect(importData(data)).rejects.toThrow('originalDays < 0.5');
  });

  it('rejects currentDays < 0.5', async () => {
    const data = makeValidExport();
    data.projects[0].requirements[0].currentDays = 0.1;
    await expect(importData(data)).rejects.toThrow('currentDays < 0.5');
  });

  it('accepts half-step days', async () => {
    const data = makeValidExport();
    data.projects[0].requirements[0].originalDays = 1.5;
    data.projects[0].requirements[0].currentDays = 2.5;
    // Should fail at DB access, NOT at validation
    await expect(importData(data)).rejects.not.toThrow('0.5 的倍数');
  });

  it('rejects non-number originalDays', async () => {
    const data = makeValidExport();
    (data.projects[0].requirements[0] as any).originalDays = 'abc';
    await expect(importData(data)).rejects.toThrow('必须为数字');
  });

  // pausedRemainingDays validation
  it('rejects non-half-step pausedRemainingDays', async () => {
    const data = makeValidExport();
    data.projects[0].requirements[0].status = 'paused';
    (data.projects[0].requirements[0] as any).pausedRemainingDays = 1.3;
    await expect(importData(data)).rejects.toThrow('pausedRemainingDays 必须为 0.5 的倍数');
  });

  it('rejects pausedRemainingDays > currentDays', async () => {
    const data = makeValidExport();
    data.projects[0].requirements[0].status = 'paused';
    data.projects[0].requirements[0].currentDays = 3;
    (data.projects[0].requirements[0] as any).pausedRemainingDays = 5;
    await expect(importData(data)).rejects.toThrow('不能超过 currentDays');
  });

  it('rejects pausedRemainingDays < 0.5', async () => {
    const data = makeValidExport();
    data.projects[0].requirements[0].status = 'paused';
    (data.projects[0].requirements[0] as any).pausedRemainingDays = 0.25;
    await expect(importData(data)).rejects.toThrow('pausedRemainingDays < 0.5');
  });

  // daysDelta validation
  it('rejects non-half-step daysDelta', async () => {
    const data = makeValidExport();
    data.projects[0].changes[0].daysDelta = 1.3;
    await expect(importData(data)).rejects.toThrow('daysDelta 必须为 0.5 的倍数');
  });

  it('rejects non-number daysDelta', async () => {
    const data = makeValidExport();
    (data.projects[0].changes[0] as any).daysDelta = 'abc';
    await expect(importData(data)).rejects.toThrow('daysDelta 必须为数字');
  });

  it('allows daysDelta = 0', async () => {
    const data = makeValidExport();
    data.projects[0].changes[0].daysDelta = 0;
    // Should fail at DB access, not at daysDelta validation
    await expect(importData(data)).rejects.not.toThrow('daysDelta');
  });

  // Supplement validation
  it('rejects supplement without subType', async () => {
    const data = makeValidExport();
    data.projects[0].changes[0].type = 'supplement';
    (data.projects[0].changes[0] as Record<string, unknown>).metadata = {};
    await expect(importData(data)).rejects.toThrow('supplement 缺少 metadata.subType');
  });

  it('rejects supplement with invalid subType', async () => {
    const data = makeValidExport();
    data.projects[0].changes[0].type = 'supplement';
    (data.projects[0].changes[0] as any).metadata = { subType: 'invalid' };
    await expect(importData(data)).rejects.toThrow('无效 supplement subType');
  });

  it('rejects negative supplement daysDelta', async () => {
    const data = makeValidExport();
    data.projects[0].changes[0].type = 'supplement';
    data.projects[0].changes[0].daysDelta = -1;
    data.projects[0].changes[0].metadata = { subType: 'feature_addition' } as any;
    await expect(importData(data)).rejects.toThrow('supplement daysDelta 不能为负数');
  });

  // Pause metadata validation
  it('rejects pause with non-number remainingDays', async () => {
    const data = makeValidExport();
    data.projects[0].changes[0].type = 'pause';
    (data.projects[0].changes[0] as any).metadata = { remainingDays: 'abc' };
    await expect(importData(data)).rejects.toThrow('pause remainingDays 必须为数字');
  });

  it('rejects pause with non-half-step remainingDays', async () => {
    const data = makeValidExport();
    data.projects[0].changes[0].type = 'pause';
    data.projects[0].changes[0].metadata = { remainingDays: 1.3 } as any;
    await expect(importData(data)).rejects.toThrow('pause remainingDays 必须为 0.5 的倍数');
  });

  // Change type validation
  it('rejects invalid change type', async () => {
    const data = makeValidExport();
    (data.projects[0].changes[0] as any).type = 'invalid_type';
    await expect(importData(data)).rejects.toThrow('无效 type');
  });

  it('rejects invalid role', async () => {
    const data = makeValidExport();
    (data.projects[0].changes[0] as any).role = 'invalid_role';
    await expect(importData(data)).rejects.toThrow('无效 role');
  });

  // Snapshot validation
  it('rejects snapshot with dangling changeId', async () => {
    const data = makeValidExport();
    data.projects[0].snapshots[0].changeId = 'nonexistent';
    await expect(importData(data)).rejects.toThrow('changeId 引用不存在');
  });

  // Dependency validation
  it('rejects dangling dependsOn reference', async () => {
    const data = makeValidExport();
    (data.projects[0].requirements[0] as any).dependsOn = 'nonexistent';
    await expect(importData(data)).rejects.toThrow('dependsOn 引用不存在');
  });

  it('rejects unsafe requirement source URLs', async () => {
    const data = makeValidExport();
    (data.projects[0].requirements[0] as any).source = {
      provider: 'feishu_project',
      url: 'javascript:alert(1)',
    };

    await expect(importData(data)).rejects.toThrow('source 无效');
  });

  it('allows valid requirement source URLs through validation', async () => {
    const data = makeValidExport();
    (data.projects[0].requirements[0] as any).source = {
      provider: 'feishu_project',
      url: 'https://project.feishu.cn/proj?project_key=PAY&work_item_type_key=story&work_item_id=42',
      ownerNames: ['张三'],
      pluginToken: 'must-not-be-trusted',
    };

    try {
      await importData(data);
    } catch (e) {
      expect((e as Error).message).not.toContain('source');
    }
  });

  // Limits
  it('rejects project with > 50 requirements', async () => {
    const data = makeValidExport();
    data.projects[0].requirements = Array.from({ length: 51 }, (_, i) => ({
      ...data.projects[0].requirements[0],
      id: `r${i}`,
      sortOrder: i,
    }));
    await expect(importData(data)).rejects.toThrow('需求数超过上限');
  });

  it('rejects screenshots that is not an array', async () => {
    const data = makeValidExport();
    (data.projects[0].changes[0] as Record<string, unknown>).screenshots = 'not-array';
    await expect(importData(data)).rejects.toThrow('screenshots 必须为数组');
  });

  it('rejects screenshots exceeding max count', async () => {
    const data = makeValidExport();
    const fakeImg = 'data:image/jpeg;base64,/9j/4A';
    (data.projects[0].changes[0] as Record<string, unknown>).screenshots = [fakeImg, fakeImg, fakeImg, fakeImg];
    await expect(importData(data)).rejects.toThrow('screenshots 超过上限');
  });

  it('rejects screenshots with invalid data URL format', async () => {
    const data = makeValidExport();
    (data.projects[0].changes[0] as Record<string, unknown>).screenshots = ['https://example.com/img.png'];
    await expect(importData(data)).rejects.toThrow('base64 data:image URL');
  });

  it('rejects oversized screenshot', async () => {
    const data = makeValidExport();
    const bigImg = 'data:image/jpeg;base64,' + 'A'.repeat(600_001);
    (data.projects[0].changes[0] as Record<string, unknown>).screenshots = [bigImg];
    await expect(importData(data)).rejects.toThrow('单张超过大小限制');
  });

  it('accepts valid screenshots array', async () => {
    const data = makeValidExport();
    const fakeImg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    (data.projects[0].changes[0] as Record<string, unknown>).screenshots = [fakeImg];
    // Should not throw on screenshots validation (may still fail on DB, but validation passes)
    // We test only that screenshot-specific errors don't appear
    try {
      await importData(data);
    } catch (e) {
      expect((e as Error).message).not.toContain('screenshots');
    }
  });

  it('rejects project with > 200 changes', async () => {
    const data = makeValidExport();
    data.projects[0].changes = Array.from({ length: 201 }, (_, i) => ({
      ...data.projects[0].changes[0],
      id: `c${i}`,
    }));
    // Also fix snapshots to reference valid changeIds
    data.projects[0].snapshots = [];
    await expect(importData(data)).rejects.toThrow('变更数超过上限');
  });
});
