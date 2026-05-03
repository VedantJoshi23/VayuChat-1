/**
 * VersionNumber shim
 *
 * React Native removed Libraries/Utilities/VersionNumber in RN 0.73.
 * Older packages that still import from that path get this shim so the
 * Metro bundle does not crash with "Unable to resolve module".
 *
 * The real version/build info comes from react-native's Platform module
 * which is always available.
 */
import { Platform } from 'react-native';

const VersionNumber = {
  appVersion: Platform.constants?.reactNativeVersion
    ? `${Platform.constants.reactNativeVersion.major}.${Platform.constants.reactNativeVersion.minor}.${Platform.constants.reactNativeVersion.patch}`
    : '0.0.0',
  buildVersion: Platform.constants?.Version ?? 0,
  bundleIdentifier: '',
};

export default VersionNumber;
