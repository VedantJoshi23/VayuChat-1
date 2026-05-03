const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

/**
 * FIX: util/VersionNumber resolver
 *
 * React Native removed `Libraries/Utilities/VersionNumber` in RN 0.73.
 * Some older packages (and certain RN internal paths) still try to import it
 * via a relative path that resolves to `util/VersionNumber`.
 * We provide a tiny shim that returns the version from the app manifest so
 * the bundle doesn't crash with "Unable to resolve module".
 *
 * The shim file is at ./src/shims/VersionNumber.js (created below in extraModules).
 */
const versionNumberShimPath = path.resolve(__dirname, 'src/shims/VersionNumber.js');

const config = {
  resolver: {
    /**
     * extraNodeModules lets us intercept bare-specifier imports that Metro
     * can't find in node_modules, such as the legacy `util/VersionNumber` path.
     */
    extraNodeModules: new Proxy(
      {},
      {
        get: (target, name) => {
          // Catch any attempt to resolve the old VersionNumber module path.
          // Different packages may request it slightly differently:
          //   • 'util/VersionNumber'
          //   • 'react-native/Libraries/Utilities/VersionNumber'
          if (
            String(name) === 'util/VersionNumber' ||
            String(name).endsWith('Utilities/VersionNumber')
          ) {
            return versionNumberShimPath;
          }
          // Fall through to the normal node_modules resolution
          return path.join(__dirname, 'node_modules', String(name));
        },
      },
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
