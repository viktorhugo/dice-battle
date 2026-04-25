import path from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Turbopack (default in Next.js 16) handles Node built-in stubs natively.
  turbopack: {
    root: path.resolve(import.meta.dirname, '../../'),
  },
  // Kept for --webpack fallback mode only.
  webpack: (config) => {
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
