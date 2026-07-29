/**
 * On-the-fly gzip compression for served responses.
 *
 * Skips non-OK, already-encoded, or zero-length bodies.
 * Only compresses when the client sends `Accept-Encoding: gzip`.
 */
export async function maybeCompress(
  req: Request,
  response: Response,
): Promise<Response> {
  const accept = req.headers.get('accept-encoding')
  if (!accept) return response
  if (response.status >= 300) return response
  if (response.headers.has('content-encoding')) return response

  const body = await response.arrayBuffer()
  if (!body.byteLength) return response

  // Prefer gzip — universally supported, baked into Bun.
  if (!accept.includes('gzip')) return response

  const compressed = Bun.gzipSync(new Uint8Array(body))
  const headers = new Headers(response.headers)
  headers.set('content-encoding', 'gzip')
  // Remove any content-length that might have been set from the original body size.
  headers.delete('content-length')
  // Vary lets downstream caches know we negotiated encoding.
  headers.set('vary', 'accept-encoding')

  return new Response(compressed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
