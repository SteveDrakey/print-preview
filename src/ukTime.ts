/**
 * Get the current UK time (handles GMT/BST automatically via Intl API)
 * and return minutes since midnight.
 */
export function getUKMinutesSinceMidnight(): number {
  const now = new Date();
  const ukTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).format(now);

  const [hours, minutes] = ukTime.split(':').map(Number);
  return hours * 60 + minutes;
}
