import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import calendar from 'dayjs/plugin/calendar'

dayjs.extend(relativeTime)
dayjs.extend(calendar)

export function formatSize(b: number): string {
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * High-fidelity date formatting (Eagle-style)
 * Shows "Today at 4:30 PM", "Yesterday", "Last Friday", or full date
 */
export function formatDate(ts: number): string {
  if (!ts) return '—';
  return dayjs(ts).calendar(null, {
    sameDay: '[Today at] h:mm A',
    nextDay: '[Tomorrow at] h:mm A',
    nextWeek: 'dddd [at] h:mm A',
    lastDay: '[Yesterday at] h:mm A',
    lastWeek: '[Last] dddd [at] h:mm A',
    sameElse: 'MMM D, YYYY'
  });
}

/**
 * Short relative time (e.g. "Just now", "2m ago", "3h ago")
 */
export function timeAgo(ts: number): string {
  if (!ts) return '';
  const now = dayjs();
  const date = dayjs(ts);
  const diffInMinutes = now.diff(date, 'minute');
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = now.diff(date, 'hour');
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = now.diff(date, 'day');
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.format('MMM D');
}

/**
 * Standard date formatting for folders
 */
export function formatDateFolder(ts: number): string {
  if (!ts) return '—';
  return dayjs(ts).format('YYYY/MM/DD HH:mm');
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
