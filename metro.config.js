// metro.config.js
// Required for Firebase JS SDK (uses package exports) in Expo / Metro bundler
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Enable package exports resolution (needed by Firebase v9+ modular SDK)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
