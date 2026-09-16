import type { NextConfig } from 'next';

const config: NextConfig = {
  // sharp ships native binaries and @alacrity-education/kromata-core loads it; neither can be bundled, so Next must
  // leave both as runtime requires on the server.
  serverExternalPackages: ['sharp', '@alacrity-education/kromata-core'],
  // Needed by the Dockerfile: emits .next/standalone with a self-contained server.
  output: 'standalone',
  experimental: {
    serverActions: {
      // Uploads go through a route handler, not a server action, but the body size limit here
      // still applies to the multipart parse.
      bodySizeLimit: '30mb',
    },
  },
};

export default config;
