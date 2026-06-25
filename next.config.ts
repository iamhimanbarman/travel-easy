import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/kolkata-bus-router",
        destination: "/",
        permanent: true,
      },
      {
        source: "/kolkata-bus-router.html",
        destination: "/",
        permanent: true,
      },
      {
        source: "/kolkata-travel-router",
        destination: "/",
        permanent: true,
      }
    ];
  },
};

export default nextConfig;
