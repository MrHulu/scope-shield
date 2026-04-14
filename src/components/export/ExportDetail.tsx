import type { Change, Requirement, ScheduleResult } from '../../types';
import { EXPORT_ROLE_COLORS, EXPORT_COLORS } from '../../constants/colors';
import { DetailChart } from '../chart/DetailChart';

interface ExportDetailProps {
  requirements: Requirement[];
  changes: Change[];
  schedule: ScheduleResult;
}

export function ExportDetail({ requirements, changes, schedule }: ExportDetailProps) {
  return (
    <DetailChart
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
