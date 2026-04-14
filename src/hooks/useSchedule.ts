import { useMemo } from 'react';
import type { Requirement, ScheduleResult, ProjectStats } from '../types';
import { schedule, computeOriginalTotalDays } from '../engine/scheduler';
import { addCalendarDays } from '../utils/date';

export function useSchedule(requirements: Requirement[], startDate: string) {
  const scheduleResult = useMemo<ScheduleResult>(() => {
    const result = schedule(requirements);
    const originalTotalDays = computeOriginalTotalDays(requirements);
    return { ...result, originalTotalDays };
  }, [requirements]);

  const stats = useMemo<ProjectStats>(() => {
    const { totalDays, originalTotalDays } = scheduleResult;
    const delay = totalDays - originalTotalDays;
    return {
      originalTotalDays,
      currentTotalDays: totalDays,
      inflationRate: originalTotalDays > 0 ? Math.round((delay / originalTotalDays) * 100) : null,
      totalChanges: 0, // caller sets this
      endDate: totalDays > 0 ? addCalendarDays(startDate, totalDays - 1) : startDate,
    };
  }, [scheduleResult, startDate]);

  return { scheduleResult, stats };
}
