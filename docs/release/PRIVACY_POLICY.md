# Privacy Policy

Last updated: 2026-09-03

This Privacy Policy applies to **오니칸 (오니기리 칸지)**.

## Summary

오니칸 is a local-first vocabulary learning app.

- Study progress, review logs, settings, and local statistics stay on your device. We do not operate a learning-data server.
- After a regular study, weakness review, or reading session ends, the app may show a full-screen advertisement served by **Google AdMob**.
- On iOS, the app asks for App Tracking Transparency (ATT) permission so AdMob can serve personalized ads if you allow tracking. If you decline, the app still works and ads can still appear as non-personalized ads.
- We do not use a first-party analytics or crash-reporting SDK.
- The app may check for Expo Updates (version metadata) when it launches.

## Data Stored On Your Device

The app stores the following data locally on your device:
- Learned words and review progress
- FSRS scheduling data
- Review history
- Study session statistics
- App settings, including whether a tutorial was completed
- Ad frequency-cap state (so we do not show ads too often)

This learning data is stored in the app's local SQLite database and local storage. We do not upload it to a server we operate. You can export a JSON backup from Settings; that file leaves the device only if you choose to share or save it.

## Advertising

The launch version shows **interstitial ads** after a completed regular study, weakness review, or reading session, not while cards are being graded.

Ads are loaded and shown by **Google AdMob** (`react-native-google-mobile-ads`). AdMob may collect and process data such as:
- Advertising identifiers (IDFA on iOS if you allow tracking; the advertising ID on Android)
- IP address and coarse location derived from IP
- Device type, OS version, language, and similar device signals
- Ad interaction and diagnostic information needed to serve and measure ads

오니칸 does not send your word list, meanings, review grades, or FSRS schedule to AdMob.

Ad frequency inside the app is limited: new users get a short grace period, ads appear at most once every two completed sessions, at most three times per day, and not more often than once every ten minutes. If an ad fails to load, study completion is not blocked.

Google's own policies apply to data AdMob collects. See [Google Privacy Policy](https://policies.google.com/privacy) and [How Google uses information from sites or apps that use our services](https://policies.google.com/technologies/partner-sites).

## App Tracking Transparency (iOS)

On iOS 14.5 and later, the app requests tracking permission before initializing the ads SDK. The system prompt uses this purpose:

> 맞춤 광고 제공을 위해 추적 권한을 사용합니다.

- Allow: AdMob may use the advertising identifier for personalized ads.
- Don't Allow: the app continues to work. Ads may still appear, but they are requested as non-personalized ads.

You can change this later in iOS Settings → Privacy & Security → Tracking.

## Other Network Activity

- **Expo Updates**: on launch the app may contact Expo's update service to check whether a newer JavaScript bundle is available. This check uses version metadata. It does not include your study progress.
- **NAVER Japanese Dictionary**: bundled example sentences do not contact NAVER. If you tap an external dictionary link, the system browser opens a NAVER search for that word or kanji. NAVER may then process the query, IP address, and browser information under its own policy.
- **Pre-generated word and example audio** is bundled with the app. Playing it does not require a network request.

## Analytics and AI

We do not use a first-party analytics SDK or crash reporter in this release.

The app does not include user-facing AI features. If those are added later, this policy and the store data declarations will be updated first. AI answers can be inaccurate.

## Data Deletion

You can remove locally stored learning data by deleting the app from your device. Export a backup from Settings first if you want to keep it.

Advertising identifiers and ads data held by Google are governed by Google's tools and policies, not by an in-app delete control.

## Children

The app is intended for general language learners and is **not directed to children under 13**. If a younger person uses it, a parent or guardian should supervise. Advertising is not child-directed.

## Contact

Email: datin0214@gmail.com

GitHub: https://github.com/taiyoungkim/AshitaKanji
