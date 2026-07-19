const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure mp4 is treated as a bundled asset
if (!config.resolver.assetExts.includes('mp4')) {
  config.resolver.assetExts.push('mp4');
}

module.exports = config;
