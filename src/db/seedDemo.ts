import { DEMO_PROJECT, DEMO_REQUIREMENTS, DEMO_CHANGES } from '../constants/demo';
import { putProject } from './projectRepo';
import { putRequirement } from './requirementRepo';
import { putChange } from './changeRepo';
import { putSnapshot } from './snapshotRepo';
import { replayChanges } from '../engine/replayEngine';

/**
 * Seed the demo project with full snapshot history so the W4.3 replay player
 * has frames to scrub through. We run the demo's static change list through
 * `replayChanges()` once at seed time so:
 *   - changes get persisted with correct daysDelta (cancel recalcs)
 *   - requirements reflect post-replay state
 *   - one snapshot is written per change
 */
export async function seedDemoData(): Promise<void> {
  await putProject(DEMO_PROJECT);

  // Persist all baseline requirements first so the project list shows them
  // even if replay below somehow drops them (defensive — replay should keep
  // baseline reqs intact).
  for (const req of DEMO_REQUIREMENTS) {
    await putRequirement(req);
  }

  // Run the engine's replay on the demo data. This produces:
  //   - finalized requirements (after all changes applied)
  //   - finalized changes (with daysDelta recalculated)
  //   - snapshots, one per change
  const result = replayChanges(DEMO_REQUIREMENTS, DEMO_CHANGES, DEMO_PROJECT.id);

  // Persist the finalized state.
  await Promise.all([
    ...result.requirements.map((r) => putRequirement(r)),
    ...result.changes.map((c) => putChange(c)),
    ...result.snapshots.map((s) => putSnapshot(s)),
  ]);
}
