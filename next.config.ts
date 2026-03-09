import type { NextConfig } from "next";
import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  webpack: (config, { isServer, webpack }) => {
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, "node_modules/cesium/Build/Cesium/Workers"),
            to: path.join(__dirname, "public/cesium/Workers"),
          },
          {
            from: path.join(__dirname, "node_modules/cesium/Build/Cesium/ThirdParty"),
            to: path.join(__dirname, "public/cesium/ThirdParty"),
          },
          {
            from: path.join(__dirname, "node_modules/cesium/Build/Cesium/Assets"),
            to: path.join(__dirname, "public/cesium/Assets"),
          },
          {
            from: path.join(__dirname, "node_modules/cesium/Build/Cesium/Widgets"),
            to: path.join(__dirname, "public/cesium/Widgets"),
          },
        ],
      })
    );
    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify("/cesium"),
      })
    );
    return config;
  },
};

export default nextConfig;
