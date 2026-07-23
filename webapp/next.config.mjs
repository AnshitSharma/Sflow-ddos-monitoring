/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/dashboard',
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || '/dashboard',
  },
};
export default nextConfig;
