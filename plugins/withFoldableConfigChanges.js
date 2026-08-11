const { withAndroidManifest } = require('expo/config-plugins');

const FOLDABLE_CONFIG_CHANGES = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenSize',
  'smallestScreenSize',
  'screenLayout',
  'density',
  'uiMode',
];

function applyFoldableConfigChanges(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  const mainActivity = application?.activity?.find((activity) =>
    activity.$?.['android:name']?.endsWith('MainActivity'),
  );

  if (!mainActivity?.$) {
    throw new Error('withFoldableConfigChanges: MainActivity not found');
  }

  const existing = mainActivity.$['android:configChanges']?.split('|').filter(Boolean) ?? [];
  mainActivity.$['android:configChanges'] = [
    ...existing,
    ...FOLDABLE_CONFIG_CHANGES.filter((flag) => !existing.includes(flag)),
  ].join('|');
  mainActivity.$['android:resizeableActivity'] = 'true';

  return androidManifest;
}

function withFoldableConfigChanges(config) {
  return withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = applyFoldableConfigChanges(modConfig.modResults);
    return modConfig;
  });
}

module.exports = withFoldableConfigChanges;
module.exports.applyFoldableConfigChanges = applyFoldableConfigChanges;
module.exports.FOLDABLE_CONFIG_CHANGES = FOLDABLE_CONFIG_CHANGES;
