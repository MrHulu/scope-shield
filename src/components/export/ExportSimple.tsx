import type { Change, Requirement, ScheduleResult } from '../../types';
import { EXPORT_ROLE_COLORS, EXPORT_COLORS } from '../../constants/colors';
import { SimpleChart } from '../chart/SimpleChart';

interface ExportSimpleProps {
  requirements: Requirement[];
  changes: Change[];
  schedule: ScheduleResult;
}

export function ExportSimple({ requirements, changes, schedule }: ExportSimpleProps) {
  return (
    <SimpleChart
      requirements={requirements}
      changes={changes}
      schedule={schedule}
      roleColors={EXPORT_ROLE_COLORS}
      planColor={EXPORT_COLORS.plan}
      saveColor={EXPORT_COLORS.save}
      newReqColor={EXPORT_COLORS.newRequirement}
      isExport
    />
  );
}
