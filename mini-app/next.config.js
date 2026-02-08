/* eslint-disable */
// const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: ".next", // Specify the output directory for builds
  // productionBrowserSourceMaps: true,
  compress: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.onton.live",
      },
      {
        protocol: "https",
        hostname: "*.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "telegra.ph",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        assert: require.resolve("assert/"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        os: require.resolve("os-browserify/browser"),
        url: require.resolve("url/"),
        buffer: require.resolve("buffer/"),
        process: require.resolve("process/browser"),
      };

      config.plugins.push(
        new webpack.ProvidePlugin({
          process: "process/browser",
        }),
        new webpack.NormalModuleReplacementPlugin(/node:crypto/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
        new webpack.NormalModuleReplacementPlugin(/node:url/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
    }

    config.module.rules.push({
      test: /\.(mp3|wav|ogg)$/,
      use: {
        loader: "file-loader",
        options: {
          publicPath: "/_next/static/sounds/",
          outputPath: "static/sounds/",
          name: "[name]-[hash].[ext]",
        },
      },
    });

    return config;
  },
};

// Sentry is temporarily disabled
// module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Enable browser profiling https://docs.sentry.io/platforms/javascript/guides/nextjs/profiling/browser/
  // async headers() {
  //   return [
  //     {
  //       source: "/:path*",
  //       headers: [
  //         {
  //           key: "Document-Policy",
  //           value: "js-profiling",
  //         },
  //       ],
  //     },
  //   ];
  // },
  // org: "onton",
  // project: "mini-app",
  // sentryUrl: "https://sentry.io/",

  // // Only print logs for uploading source maps in CI
  // silent: !process.env.CI,

  // // For all available options, see:
  // // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // // Upload a larger set of source maps for prettier stack traces (increases build time)
  // widenClientFileUpload: true,

  // // Automatically annotate React components to show their full name in breadcrumbs and session replay
  // reactComponentAnnotation: {
  //   enabled: true,
  // },

  // // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // // This can increase your server load as well as your hosting bill.
  // // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // // side errors will fail.
  // // tunnelRoute: "/monitoring",

  // // Hides source maps from generated client bundles
  // hideSourceMaps: true,

  // // Automatically tree-shake Sentry logger statements to reduce bundle size
  // disableLogger: true,

  // // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // // See the following for more information:
  // // https://docs.sentry.io/product/crons/
  // // https://vercel.com/docs/cron-jobs
  // automaticVercelMonitors: true,
// });

module.exports = nextConfig;
