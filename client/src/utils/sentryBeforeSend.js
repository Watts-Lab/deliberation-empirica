/**
 * Sentry beforeSend hook that strips IP addresses from events
 * to prevent re-identification of participants.
 */
export function stripIpAddress(event) {
  if (event.user) {
    const { ip_address: _stripped, ...userWithoutIp } = event.user;
    return { ...event, user: userWithoutIp };
  }
  return event;
}
