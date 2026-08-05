/**
 * Prefer IPv4 when dual-stack DNS returns broken AAAA records.
 * On this network (and many Windows setups) Adzuna's IPv6 addresses are
 * ENETUNREACH; Node's fetch then fails with AggregateError/ETIMEDOUT across
 * 3 AAAA + 3 A targets. ipv4first makes Happy Eyeballs succeed on IPv4 first.
 *
 * Node-only: Edge must not import `node:dns` (see Next.js instrumentation guide).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeInstrumentation } = await import(
      "./instrumentation-node"
    );
    registerNodeInstrumentation();
  }
}
