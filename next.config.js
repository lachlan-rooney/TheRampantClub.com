/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp ships a native binary that Next's file tracing can miss in the
  // serverless bundle — mark it external so it's loaded from node_modules at
  // runtime (fixes SVG→PNG chart rasterisation for the weekly report email).
  serverExternalPackages: ['sharp'],

  // ── AND the shared object it dlopens at runtime. ──────────────────────────
  // serverExternalPackages keeps sharp out of the bundle so it loads from
  // node_modules. That traces `sharp` and `@img/sharp-<platform>` correctly,
  // but NOT `@img/sharp-libvips-<platform>`: the .so is opened with dlopen at
  // runtime, and file tracing follows static requires, so it cannot see it.
  //
  // The result in production was:
  //   ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file
  //
  // …which failed at IMPORT time, so every route importing sharp returned 500
  // — including GETs that never touch an image. Naming the packages explicitly
  // is the only way the .so reaches the serverless bundle.
  //
  // linux-x64 is the deploy target. The darwin entries are absent on the build
  // machine and a glob matching nothing is simply skipped, so this is safe to
  // keep in one list.
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.upstash.io",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.youtube.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        // THE KIOSK IS NEVER STORED. The middleware sets this too; it was being
        // replaced by the framework's own Cache-Control on the rendered response,
        // so it is asserted here as well. Two layers on purpose: the tablets are
        // shared and bolted to a room, and a member's view must not outlive them
        // in a disk cache or a back-forward cache.
        source: '/kiosk/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' }],
      },
      {
        source: '/kiosk',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' }],
      },
    ]
  },
}

module.exports = nextConfig
