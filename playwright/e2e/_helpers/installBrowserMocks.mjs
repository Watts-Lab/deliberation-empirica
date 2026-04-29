// Browser-side mocks for external services the player browser calls
// directly (NOT routed through the empirica server). The existing
// `mockExternal` server (mockExternalServer.mjs) only intercepts
// server-originated calls — GitHub asset fetches, prereg push, Daily
// room create, etc. Anything fired from the participant's browser
// (axios.get from a React hook, fetch from a service worker, etc.)
// goes around it.
//
// `useConnectionInfo` (client/src/components/hooks.js) is the main
// case today: every consent submit fires
//   1. axios.get("https://ipwho.is") → populates country/timezone
//   2. axios.get("https://raw.githubusercontent.com/.../vpn/ipv4.txt")
//      → populates isKnownVpn
//
// In CI both hits are network-bound and non-deterministic — country
// depends on the CI runner location, the VPN list moves under us,
// and rate limits are real. Mocking them at the browser-context
// layer gives every L3 test deterministic connection data and
// unblocks `connectionInfo.country === "US"` style assertions that
// were dropped pre-mock.
//
// Usage from a test:
//   const ctx = await browser.newContext();
//   await installBrowserMocks(ctx);
//   const page = await ctx.newPage();
//
// Or wire into a fixture's beforeEach.

const DEFAULT_IPWHOIS = {
  country_code: "US",
  timezone: { id: "America/New_York", utc: "-05:00" },
};

export async function installBrowserMocks(context, opts = {}) {
  const ipwhois = { ...DEFAULT_IPWHOIS, ...(opts.ipwhois ?? {}) };
  // VPN list is just a newline-delimited IP list. Empty by default →
  // no IP matches → isKnownVpn=false. Pass an array of CIDRs to
  // simulate a flagged client.
  const vpnList = Array.isArray(opts.vpnList) ? opts.vpnList.join("\n") : "";

  // ipwho.is — useConnectionInfo expects `country_code`, `timezone.id`,
  // `timezone.utc`. Status MUST be 200 or the hook throws.
  await context.route("**/ipwho.is**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ipwhois),
    }),
  );

  // X4BNet VPN-IP list — fetched as plain text. The hook checks
  // membership via simple string matching against the user's IP.
  await context.route("**/X4BNet/lists_vpn/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: vpnList,
    }),
  );
}
