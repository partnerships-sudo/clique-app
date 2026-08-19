// Use Sentry's config wrapper so source maps are uploaded automatically
// on every Xcode build. Falls back gracefully if Sentry isn't configured.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Ensure mp4 is treated as a bundled asset
if (!config.resolver.assetExts.includes('mp4')) {
  config.resolver.assetExts.push('mp4');
}

// Keep native build output out of Metro's watcher.
//
// Metro watches the project root, and there is no watchman here, so it uses
// its own file watcher. `ios/Pods` alone is ~12,900 files, and every
// `pod install` or Xcode build rewrites hundreds of them — each one an event
// that makes Metro rebuild and reload the running app. The symptom is the
// simulator refreshing over and over while you build, with nothing in `src/`
// having changed.
//
// None of these directories contains JavaScript Metro needs to resolve.
const escapeForRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const root = escapeForRegExp(__dirname);

const ignoredPaths = [
  `${root}/ios/Pods/.*`,
  `${root}/ios/build/.*`,
  `${root}/ios/DerivedData/.*`,
  `${root}/android/build/.*`,
  `${root}/android/app/build/.*`,
  // Nested git repo, unrelated to the app bundle.
  `${root}/ios/clique-brand-portal-/.*`,
];

const existingBlockList = config.resolver.blockList;
const blocked = [
  ...(Array.isArray(existingBlockList)
    ? existingBlockList
    : existingBlockList
      ? [existingBlockList]
      : []),
  ...ignoredPaths.map((p) => new RegExp(p)),
];
config.resolver.blockList = blocked;

module.exports = config;
