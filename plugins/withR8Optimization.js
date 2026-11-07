const { withGradleProperties } = require('expo/config-plugins');

// Play Console flagged 1.0.5 for R8 running without optimized resource shrinking.
// Its other suggestion, proguard-android-optimize.txt, is deliberately not applied:
// R8 optimizations broke Expo module records at runtime (expo-sqlite open failed,
// ExpoAudio.setAudioModeAsync could not cast its AudioMode argument).
function withR8Optimization(config) {
  return withGradleProperties(config, (modConfig) => {
    const key = 'android.r8.optimizedResourceShrinking';
    modConfig.modResults = modConfig.modResults.filter((item) => item.key !== key);
    modConfig.modResults.push({ type: 'property', key, value: 'true' });
    return modConfig;
  });
}

module.exports = withR8Optimization;
