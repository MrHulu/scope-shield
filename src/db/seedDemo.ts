import { DEMO_PROJECT, DEMO_REQUIREMENTS, DEMO_CHANGES } from '../constants/demo';
import { putProject } from './projectRepo';
import { putRequirement } from './requirementRepo';
import { putChange } from './changeRepo';

export async function seedDemoData(): Promise<void> {
  await putProject(DEMO_PROJECT);
  for (const req of DEMO_REQUIREMENTS) {
    await putRequirement(req);
  }
  for (const chg of DEMO_CHANGES) {
    await putChange(chg);
  }
}
