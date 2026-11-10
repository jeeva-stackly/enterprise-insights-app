/** Short relative time for alert rows: "Just now", "5 min ago", "2 hours ago", "Yesterday", "12 Oct, 3:45 pm". */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (seconds < 172800) return 'Yesterday';
  const date = new Date(then);
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day}, ${time}`;
}