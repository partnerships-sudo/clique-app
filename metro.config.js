// Use Sentry's config wrapper so source maps are uploaded automatically
// on every Xcode build. Falls back gracefully if Sentry isn't configured.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Ensure mp4 is treated as a bundled asset
if (!config.resolver.assetExts.includes('mp4')) {
  config.resolver.assetExts.push('mp4');
}

module.exports = config;
