import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import type { Sport, TeamRecord } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDateLabel(dateString: string): string {
  try {
    const date = parseISO(dateString.split('T')[0]);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  } catch {
    return dateString;
  }
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  // Already in 12-hour format like "7:00 AM" or "10:30 PM" — pass through
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(timeStr.trim())) return timeStr.trim();
  // Convert 24-hour "19:00" → "7:00 PM"
  try {
    const [hourStr, minuteStr] = timeStr.split(':');
    const hours = Number(hourStr);
    const minutes = Number(minuteStr);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    const period = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes.toString().padStart(2, '0');
    return `${h}:${m} ${period}`;
  } catch {
    return timeStr;
  }
}

export function formatRecord(record: TeamRecord | undefined, sport: Sport): string {
  if (!record) return '0-0';
  const { wins = 0, losses = 0, ties = 0, otLosses = 0 } = record;
  if (sport === 'hockey') {
    return otLosses > 0 ? `${wins}-${losses}-${ties}-${otLosses}` : `${wins}-${losses}-${ties}`;
  }
  if (sport === 'soccer' || sport === 'lacrosse') {
    return `${wins}-${losses}-${ties}`;
  }
  return `${wins}-${losses}`;
}

export function formatRecordLabel(sport: Sport): string {
  if (sport === 'hockey') return 'W-L-T-OTL';
  if (sport === 'soccer' || sport === 'lacrosse') return 'W-L-T';
  return 'W-L';
}

export const SPORT_EMOJI: Record<Sport, string> = {
  hockey: '🏒',
  baseball: '⚾',
  basketball: '🏀',
  soccer: '⚽',
  lacrosse: '🥍',
  softball: '🥎',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  practice: 'Practice',
  meeting: 'Meeting',
  social: 'Social',
  other: 'Event',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  practice: '#f97316',
  meeting: '#a78bfa',
  social: '#22c55e',
  other: '#3b82f6',
};

export function getDueDateColor(dueDate: string | undefined): string {
  if (!dueDate) return '#64748b';
  try {
    const due = parseISO(dueDate);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return '#ef4444'; // overdue — red
    if (diff < 3) return '#f97316'; // due soon — orange
    if (diff < 7) return '#eab308'; // upcoming — yellow
    return '#64748b'; // normal — slate
  } catch {
    return '#64748b';
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
