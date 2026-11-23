import { handler } from '../server/index.mjs';

export default function apiHandler(req, res) {
  const forwardedPath = req.query?.path;
  if (typeof forwardedPath === 'string' && forwardedPath) {
    const originalUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    originalUrl.searchParams.delete('path');
    req.url = `/api/${forwardedPath}${originalUrl.search}`;
  }
  return handler(req, res);
}
