import type { NextConfig } from "next";
import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";

const cesiumSource = "node_modules/cesium/Build/Cesium";
const cesiumBaseUrl = "cesiumStatic";
// Copy into public/ so files are served at /cesiumStatic/* (not under _next/static).
const publicCesiumDir = path.resolve("public", cesiumBaseUrl);

const nextConfig: NextConfig = {
  reactStrictMode: false,
  reactCompiler: false,
  // Do NOT use transpilePackages for cesium or resium (pnpm + CJS/ESM issues).
  async redirects() {
    return [
      { source: "/", destination: "/login", permanent: false },
      { source: "/GEOIDRESOURCES", destination: "/login", permanent: false },
      { source: "/GEOIDRESOURCES/:path*", destination: "/login", permanent: false },
    ];
  },
  webpack(config, { isServer, webpack: webpackApi }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      cesium: path.resolve("node_modules/cesium/Source/Cesium.js"),
      resium: path.resolve("node_modules/resium/dist/resium.umd.cjs"),
    };

    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            { from: path.join(cesiumSource, "Workers"), to: path.join(publicCesiumDir, "Workers") },
            { from: path.join(cesiumSource, "ThirdParty"), to: path.join(publicCesiumDir, "ThirdParty") },
            { from: path.join(cesiumSource, "Assets"), to: path.join(publicCesiumDir, "Assets") },
            { from: path.join(cesiumSource, "Widgets"), to: path.join(publicCesiumDir, "Widgets") },
          ],
        })
      );
      config.plugins.push(
        new webpackApi.DefinePlugin({
          CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
        })
      );
    }

    config.module.unknownContextCritical = false;
    config.module.unknownContextRegExp =
      /\/cesium\/cesium\/Source\/Core\/buildModuleUrl\.js/;

    return config;
  },
};

export default nextConfig;
