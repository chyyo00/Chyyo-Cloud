const PAGES_ORIGIN = /^https:\/\/(?:[a-z0-9-]+\.)?chyyo-cloud\.pages\.dev$/i;
const ALLOWED_ORIGINS = new Set([
  'https://panel.choverse.com',
  'https://chyyo-cloud.pages.dev',
]);

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin) || PAGES_ORIGIN.test(origin);
}

function corsHeaders(origin) {
  const headers = new Headers({
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!isAllowedOrigin(origin)) {
      return new Response('Origin not allowed', { status: 403 });
    }

    const headers = corsHeaders(origin);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, env.BACKEND_ORIGIN);
    try {
      const upstreamRequest = new Request(upstreamUrl, request);
      upstreamRequest.headers.set('Origin', origin ?? '');
      upstreamRequest.headers.delete('Host');
      const upstreamResponse = await fetch(upstreamRequest);
      const responseHeaders = new Headers(upstreamResponse.headers);
      for (const [name, value] of headers) responseHeaders.set(name, value);
      responseHeaders.set('Cache-Control', 'no-store');
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch {
      headers.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify({ error: 'Backend unavailable' }), {
        status: 502,
        headers,
      });
    }
  },
};
