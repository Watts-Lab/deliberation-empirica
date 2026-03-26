/**
 * Sentry beforeSend hook that strips IP addresses from events
 * to prevent re-identification of participants.
 */
export function stripIpAddress(event) {
  if (event.user) {
    return { ...event, user: { ...event.user, ip_address: undefined } };
  }
  return event;
}
