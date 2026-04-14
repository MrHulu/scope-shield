import { format, addDays, parseISO } from 'date-fns';

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function now(): string {
  return new Date().toISOString();
}

export function addCalendarDays(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'M/d');
}
