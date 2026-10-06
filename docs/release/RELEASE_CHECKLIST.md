# Release Checklist — 오니칸 (AshitaKanji)

Last updated: 2026-10-07
App: 오니칸 / slug `ashitakanji` / bundleId `com.taiyoungkim.ashitakanji` (iOS+Android 동일)
Current version: **1.0.1**

스토어: **Google Play + Apple App Store** for 1.0.1. 개발자 등록 = 개인(Individual), owner `datin0214@gmail.com`.

---

## 우선순위 요약

| Tier | 의미 | 통과 못 하면 |
|---|---|---|
| **P0** | 제출 자체 불가 (하드 블로커) | EAS submit / 스토어 업로드 실패 |
| **P1** | 심사 통과·광고 게재에 필수 | reject 또는 광고 노출 안 됨 |
| **P2** | 출시 직후/품질 | 출시는 되나 리스크 |

현재 상태 한 줄: **새 앱 아이콘을 포함한 서명된 Google Play production AAB(build 40)까지 준비됨. 남은 작업은 Play Console 초안의 build 38 교체·콘솔 설문·실기기 검증.**

### 자동 게이트 결과 (2026-09-27)

| 명령 | 결과 |
|---|---|
| `npm run ci-check` | ✅ typecheck · lint · 테스트 270개 통과 |
| `npm run release-gate` | 양쪽 스토어용 종합 게이트 — iOS 제출 정보와 EAS Submit용 Google 서비스 계정 키가 없으면 실패 |
| `npm run release-check:android` | ✅ Android 첫 수동 제출용 게이트 전체 통과 |

고양이 카드 보상 프로토타입은 1.0.0 출시 범위에서 제외했다. 아래 P0 계정 정보와 실기기 검증을 마치면 최종 스토어 빌드를 진행한다.

---

## P0 — 하드 블로커 (제출 전 반드시)

- [x] **GitHub Pages 배포** — 2026-08-18 `gh-pages` 게시. `/` `/privacy/` `/support/` HTTP 200. AdMob·ATT 공개 포함.
- [x] **버전 bump** — `app.json` / `package.json` `1.0.0`, `runtimeVersion` `1.0.0`. (native build number는 EAS `autoIncrement`/`remote`가 처리)
- [ ] **Android 최종 APK 콜드 스타트 게이트** — 초기화된 에뮬레이터 또는 실기기에 새로 설치한 뒤 시작 화면→홈→첫 학습 카드→TTS까지 확인. `expo_runtime_version` 리소스와 필요한 APK 자산도 대조. 상세 절차는 [`ANDROID_BUILD17_STARTUP_CRASH_POSTMORTEM.md`](./ANDROID_BUILD17_STARTUP_CRASH_POSTMORTEM.md) 참고.
- [x] **Google Play 개발자 등록** — 개인 계정, `datin0214@gmail.com`.
- [x] **production AAB 생성** — EAS production profile을 로컬 실행해 원격 Play 업로드 키를 주입한 서명본 생성. 일반 로컬 Gradle release(debug keystore)는 제출본으로 사용 금지.
  - 2026-09-27 첫 시도(build 34)는 Metro eager bundle 99.9%에서 메모리 부족(code 137).
  - 무료 `medium` 원격 빌드는 Metro 통과 후 `createReleaseUpdatesResources`에서 다시 메모리 부족(code 137). 같은 production profile과 원격 keystore로 공식 EAS local build를 실행해 우회.
  - 제출 파일: `releases/Onikan-google-play-v1.0.0-build40.aab` (versionName `1.0.0`, versionCode `40`, 190 MB). build 38은 Play 내부 테스트의 미출시 초안에만 업로드되어 있어 교체 대상.
  - SHA-256: `a5edd6abafe210739e7a703a3e179b00f98605ec0399f1e7a66112ea5ddbc89b`.
  - 검증: Gradle 1,034 tasks 성공, `jarsigner` 검증 성공, ZIP 무결성 성공, MP3 0개·OGG 14,054개 포함.
- [ ] **최종 AAB 수동 업로드** — build 38 초안을 제거하고 build 40을 Play Console 내부 테스트 트랙에 직접 업로드. `./secrets/play-service-account.json`은 EAS Submit 자동화 도입 전까지 선택 사항.
- [x] **스토어 그래픽 자산** — 2026-09-28 새 오니기리 아이콘으로 앱/Play 아이콘을 통일하고, Android 9:16 스크린샷 7장(1539×2736)과 feature graphic(1024×500)을 갱신·육안 확인.
- [ ] **prod 빌드 실광고 1회 확인** — `__DEV__=false` 빌드에서 실 Unit 로드되는지. ⚠️ 본인 클릭 금지 (계정 정지)

## P1 — 심사 통과·광고 게재 필수

- [ ] **AdMob 앱-스토어 연결** — 출시(또는 스토어 등록) 후 AdMob 콘솔에서 각 앱을 스토어 리스팅에 link. 미연결 = "게재 제한" 유지, 실광고 안 뜸
- [ ] **App Store 개인정보 라벨 (Privacy Nutrition Label)** — 아래 표대로 기입. 라벨 ≠ 실동작이면 reject
- [ ] **Play Data Safety form** — 아래 표대로 기입
- [ ] **ATT 프롬프트 동작 확인** — iOS 14.5+ ATT 다이얼로그 뜨고, 거부해도 앱·광고(non-personalized) 정상
- [ ] **연령 등급 / 콘텐츠 등급 설문** — 양 스토어. 광고 있음 표시. 아동 대상 아님

### 스토어 개인정보 기입 초안 (광고 유지, 2026-08-18)

App Store Privacy Nutrition Label:
- **Tracking** (Yes, linked to user via advertising ID when ATT is allowed): Advertising Data, Device ID — used for Third-Party Advertising
- **Data Used to Track You**: Advertising Data, Identifiers
- **Data Not Linked to You** (still disclose): Product Interaction is not collected by us. AdMob may collect Device ID / Advertising Data even when ATT is denied (non-personalized)
- Tracking is optional (user can decline ATT). App functions without allowing tracking

Play Data Safety:
- **Does your app collect data?** Yes (via Google AdMob, third party)
- Data types: Device or other IDs; advertising data. Not collected by the developer’s server
- Purpose: Advertising or marketing
- Collected by third party (Google). Encrypted in transit. Users cannot request deletion from us (use Google’s ad settings)
- **Is the app designed for children?** No
- Advertising ID: Yes (Android advertising ID)

Age rating surveys: mark **ads / advertising present**. Do not mark as child-directed.
- [ ] **스토어 리스팅 텍스트** — 앱명(오니칸), 설명, 키워드, 카테고리(교육). 일본어/한국어 현지화 결정
- [ ] **지원 URL·이메일** — support 페이지(P0 배포에 포함) + `datin0214@gmail.com`
- [ ] **`ITSAppUsesNonExemptEncryption=false`** 이미 설정됨 ✅ (확인만)

## P2 — 품질·출시 직후

- [ ] **내부 테스트 트랙** — Play `track: internal`, Apple TestFlight 1라운드 후 프로덕션 승격
- [ ] **빈도캡 실기기 검증** — adPolicy (3일/5세션 유예, 2세션당 1회, 10분 간격, 일 3회) 실디바이스에서 체감 확인
- [ ] **크래시/ANR 모니터링** — newArchEnabled=true 라 신아키텍처 회귀 주시
- [ ] **OTA = enabled** (`app.json` 실값). Privacy에 Expo Updates 공개됨. 핫픽스는 같은 runtimeVersion에서 JS OTA 가능, 네이티브/P0는 스토어 리빌드
- [ ] **placeholder CI 게이트** — `site/ docs/release/PRIVACY_POLICY.md SUPPORT.md app/ store-assets/` 스캔 0 hits (RELEASE_DECISIONS 정의)
- [x] **리디자인 화면 정합** — 2026-09-01, `final-screens/` 20종 대조 완료. 상세는 [`../03-analysis/remaining-work.md`](../03-analysis/remaining-work.md). 실기기 픽셀 검수는 미완
- [ ] **prebuild --clean 금지** 주의 — Podfile fmt 패치·수동 네이티브 편집(Info.plist SKAdNetwork, AndroidManifest tools:replace) 날아감

---

## 추천 실행 순서

1. Play Console에서 앱 레코드 생성 (`오니칸`, 기본 언어 한국어, 앱/무료)
2. 내부 테스트 초안의 build 38을 제거하고 `build40.aab`를 수동 업로드
3. Play Data Safety·광고 포함·콘텐츠 등급·대상 연령·앱 액세스 설문 작성
4. 스토어 설명·아이콘·feature graphic·Android 스크린샷·지원 URL/이메일 등록
5. 내부 테스트 설치 → 콜드 스타트·첫 학습·TTS·실광고 1회 확인 (본인 광고 클릭 금지)
6. AdMob에서 Play 스토어 리스팅 연결
7. 개인 계정의 적용 대상 테스트 요건을 Play Console에서 확인하고 충족한 뒤 프로덕션 제출
