/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/goals", destination: "/dashboard/goals", permanent: true },
      { source: "/checkins", destination: "/dashboard/checkins", permanent: true },
    ];
  },
};

export default nextConfig;
