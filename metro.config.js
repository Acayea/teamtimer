const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

// Drizzle ships migrations as raw .sql files imported from migrations.js;
// Metro must treat .sql as a source extension or the bundle fails to resolve them.
config.resolver.sourceExts.push('sql');

module.exports = config;
