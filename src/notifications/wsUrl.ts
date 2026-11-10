/** http://host:8000 -> ws://host:8000/ws/notifications (https -> wss). */
export function toNotificationsSocketUrl(apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/+$/, '');
  const socketBase = base.replace(/^http(s?):\/\//i, (_match, secure: string) => `ws${secure}://`);
  return `${socketBase}/ws/notifications`;
}