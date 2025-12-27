
export type NotificationType = 'success' | 'error' | 'info';

export const notify = (message: string, type: NotificationType = 'success') => {
  const event = new CustomEvent('app:notification', {
    detail: { message, type }
  });
  window.dispatchEvent(event);
};
