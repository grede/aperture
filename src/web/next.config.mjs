/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for easier deployment
  output: 'standalone',

  // Enable React strict mode
  reactStrictMode: true,

  // Configure image domains if needed
  images: {
    remotePatterns: [],
  },

  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // For file uploads
    },
  },
};

export default nextConfig;
