import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // TMDB serves every poster and backdrop from this host. Next refuses
    // remote images that are not listed here, so without it next/image fails
    // with an error that does not obviously point at configuration.
    // Cards currently use a plain <img>, so this is not load-bearing yet —
    // it is here so switching to next/image is a one-line change.
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' }],
  },
}

export default nextConfig
