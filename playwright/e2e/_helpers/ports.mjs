// Worker-indexed port allocation. Each worker gets a 10-port stripe so
// parallel Empirica stacks don't collide. Index comes from Playwright's
// process.env.TEST_WORKER_INDEX.
//
// Base ports are chosen to stay clear of the default dev-mode ports (3000,
// 8844, 4737, 9091) so a `npm run start` session running alongside tests
// won't clash with worker 0.
const BASE = {
  empirica: 3100, // empirica admin / proxy
  vite: 8900, // client dev server
  tajriba: 4800, // tajriba graphql
  cdn: 9100, // mock CDN for fixtures
  mockExternal: 9200, // mock for external provider APIs (GitHub, Daily, ...)
};

const STRIDE = 10;

export function portsForWorker(workerIndex) {
  return {
    empirica: BASE.empirica + workerIndex * STRIDE,
    vite: BASE.vite + workerIndex * STRIDE,
    tajriba: BASE.tajriba + workerIndex * STRIDE,
    cdn: BASE.cdn + workerIndex * STRIDE,
    mockExternal: BASE.mockExternal + workerIndex * STRIDE,
  };
}
