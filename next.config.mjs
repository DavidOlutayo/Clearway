/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse (via pdfjs-dist ESM) breaks when webpack bundles it into
    // route handlers: module load throws, and Next answers every request
    // with an HTML 500 instead of JSON. Load it from node_modules at
    // runtime instead (it is server-only; no client component uses it).
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
