const { version } = require("./package.json");
const isDev = process.env.NODE_ENV === "development";
const withPWA = require("next-pwa")({
  dest: "public",
  disable: isDev
});
const { withSentryConfig } = require("@sentry/nextjs");

/**
 * @type {import('next').NextConfig}
 */
const moduleExports = {
  reactStrictMode: false,
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true
  },
  images: {
    domains: ["raw.githubusercontent.com"]
  },
  output: "standalone",
  typescript: {
    tsconfigPath: "./tsconfig.json"
  },
  // experimental: {
  //   // outputStandalone: true,
  //   externalDir: true // to make the import from shared parent folder work https://github.com/vercel/next.js/issues/9474#issuecomment-810212174
  // },
  publicRuntimeConfig: {
    version
  },
  i18n: {
    locales: ["en-US"],
    defaultLocale: "en-US"
  },
  sentry: {
    hideSourceMaps: true
  },
  webpack: config => {
    // Fixes npm packages that depend on `node:crypto` module
    config.externals.push({
      "node:crypto": "crypto"
    });
    return config;
  },
  redirects: async () => {
    return [
      {
        source: "/deploy",
        destination: "/cloud-deploy",
        permanent: true
      }
    ];
  }
};

const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, org, project, authToken, configFile, stripPrefix,
  //   urlPrefix, include, ignore

  silent: true, // Suppresses all logs,
  dryRun: true,
  release: require("./package.json").version

  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options.
};

// Make sure adding Sentry options is the last code to run before exporting, to
// ensure that your source maps include changes from all other Webpack plugins
module.exports = withPWA(withSentryConfig(moduleExports, sentryWebpackPluginOptions));
// module.exports = moduleExports

