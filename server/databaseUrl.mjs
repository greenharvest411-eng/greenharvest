/**
 * Supabase recommends transaction-mode pooling for serverless runtimes.
 * The shared Supavisor pooler exposes it on port 6543; port 5432 is session
 * mode and can exhaust the project's small per-role connection pool when
 * Vercel scales API invocations horizontally.
 */
export function runtimeDatabaseUrl(connectionString, isServerless = Boolean(process.env.VERCEL)) {
  if (!connectionString || !isServerless) return connectionString;

  try {
    const url = new URL(connectionString);
    if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '5432') {
      url.port = '6543';
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}
