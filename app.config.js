// Keep production OTA updates enabled, but allow a deterministic embedded-only
// release artifact for offline/device verification. This is build-time only and
// never changes the production configuration unless explicitly requested.
const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = { ...appJson.expo, ...config };
  if (process.env.ASHITAKANJI_DISABLE_UPDATES === '1') {
    base.updates = {
      ...base.updates,
      enabled: false,
      checkAutomatically: 'NEVER',
    };
  }
  return { ...base };
};
