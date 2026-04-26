import path from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Turbopack (default in Next.js 16) handles Node built-in stubs natively.
  turbopack: {
    root: path.resolve(import.meta.dirname, '../../'),
    resolveAlias: {
      // Stub the wagmi experimental "tempo/accounts" dynamic import.
      accounts: './lib/accounts-stub.js',
    },
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Stub the wagmi experimental "tempo/accounts" dynamic import so webpack
    // doesn't error at build time. The feature gracefully falls back at runtime.
    config.resolve.alias = {
      ...config.resolve.alias,
      accounts: path.resolve(import.meta.dirname, "lib/accounts-stub.js"),
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
