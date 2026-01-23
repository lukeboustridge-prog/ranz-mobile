// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add platform-specific extensions (.web.ts, .native.ts)
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'web.ts',
  'web.tsx',
  'native.ts',
  'native.tsx',
];

module.exports = config;
