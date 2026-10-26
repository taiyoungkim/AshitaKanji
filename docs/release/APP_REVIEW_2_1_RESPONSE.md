# App Review Guideline 2.1 response

Replace the two bracketed placeholders before sending. The video link must open without a login or access request.

## Reply to App Review / App Review Notes

Hello App Review Team,

Thank you for your message. The app is complete and ready for review. Please find the requested information below.

1. **Physical-device screen recording**

Video: [PUBLIC_SCREEN_RECORDING_URL]

The video was recorded on [IPHONE_MODEL] running the latest available version of iOS. It begins with launching the submitted app and demonstrates the introductory tutorial, selecting a JLPT level, the daily study and review flow, pronunciation, word and kanji details, handwriting practice, completion results, reading practice, progress statistics, and the onigiri collection.

The app does not include account registration, login, account deletion, user-generated content, content reporting or blocking, purchases, subscriptions, or other paid content or features.

2. **Purpose and target audience**

Onikan is a Japanese kanji and vocabulary learning app for Korean-speaking learners, including learners preparing for JLPT levels N5 through N1. It helps users maintain a structured daily study and review routine through active-recall cards, spaced repetition, reading practice, handwriting practice, weak-item review, progress statistics, and gamified onigiri collection rewards.

3. **Setup and access instructions**

No account, login credentials, subscription, or sample file is required.

- Install and launch the app.
- On first launch, tap “시작하기” and complete the short tutorial.
- On the Home screen, choose a JLPT level from the level selector and tap the main study card to begin a daily session.
- Reveal each card's reading and Korean meaning, then select a review result.
- To use handwriting practice, open a learned word's detail screen, tap a kanji card, and tap “따라쓰기.” The screen includes both “따라쓰기” and free “연습” modes and supports finger or stylus input on iPhone.
- Reading practice, review, statistics, collection, and settings are available from the app navigation.

All core learning features are available immediately. Learning progress is stored locally on the device.

4. **External services, tools, and platforms**

The core learning content and progress system do not require a user account or remote backend. The app uses the following external services or system integrations:

- Google Mobile Ads SDK (AdMob): displays advertising after eligible learning sessions. Ads are not shown while cards are being graded.
- Expo Application Services / EAS Update: application build and update delivery. Learning records are not uploaded to Expo.
- Apple system services: text-to-speech/audio playback, Photos add-only access when the user explicitly saves a study-result image, and the Share Sheet when the user explicitly shares a result image or exports a JSON backup.
- NAVER Japanese Dictionary: an optional external browser link for additional dictionary reference. It is not required for core functionality.

The app does not use authentication services, a cloud database, payment processing, or AI services at runtime.

5. **Regional differences**

The app functions consistently in all supported regions. Its interface and learning explanations are in Korean, and it is intended for Korean-speaking Japanese learners worldwide. There are no region-specific features, restrictions, or content differences.

6. **Regulated industry and third-party material**

The app is an educational study tool and does not operate in a regulated industry.

The learning data includes materials used under the following licenses and permissions:

- JLPT vocabulary data derived from “JLPT Words by Level” by Robin Pourtaud: Creative Commons Attribution 4.0 (CC BY 4.0). Source: https://www.kaggle.com/datasets/robinpourtaud/jlpt-words-by-level — License: https://creativecommons.org/licenses/by/4.0/
- Kanji readings, radicals, and stroke-count data derived from EDRDG KANJIDIC2: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). Source: https://www.edrdg.org/kanjidic/kanjd2index_legacy.html — License statement: https://www.edrdg.org/edrdg/licence.html
- Example sentences are either authored by the developer or included with permission from the relevant content owner. The optional NAVER dictionary link opens NAVER's public website in the system browser and does not copy live dictionary results into the app.

Please let us know if any additional information is required.

## Physical iPhone recording checklist

Use the exact submitted TestFlight/App Store build on a physical iPhone running the latest available iOS.

1. Start screen recording while the Home Screen and Onikan icon are visible.
2. Launch Onikan and show the intro/tutorial.
3. Show the Home screen and change or confirm a JLPT level.
4. Start a daily study session; reveal and grade several cards and play pronunciation once.
5. Open a word detail, tap a kanji, enter “따라쓰기,” draw with a finger, switch to “연습,” and draw again.
6. Show the completion/result screen and the onigiri reward flow.
7. Briefly show reading practice, statistics, collection, and settings.
8. If an ad appears naturally after a completed session, leave it in the recording.
9. Upload the recording to a public, view-only URL that does not require login or an access request, then replace `[PUBLIC_SCREEN_RECORDING_URL]` above.

Do not add account, deletion, UGC, or purchase demonstrations; those features do not exist in this app.
