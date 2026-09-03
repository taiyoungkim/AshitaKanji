# Release Checklist — 오니칸 (AshitaKanji)

Last updated: 2026-09-01
App: 오니칸 / slug `ashitakanji` / bundleId `com.taiyoungkim.ashitakanji` (iOS+Android 동일)
Current version: **1.0.0**

스토어: Apple App Store + Google Play. 개발자 등록 = 개인(Individual).

---

## 우선순위 요약

| Tier | 의미 | 통과 못 하면 |
|---|---|---|
| **P0** | 제출 자체 불가 (하드 블로커) | EAS submit / 스토어 업로드 실패 |
| **P1** | 심사 통과·광고 게재에 필수 | reject 또는 광고 노출 안 됨 |
| **P2** | 출시 직후/품질 | 출시는 되나 리스크 |

현재 상태 한 줄: **앱·데이터·Privacy URL 준비됨. 남은 블로커는 스토어 계정·prod 빌드 검증.**

### 자동 게이트 결과 (2026-09-01)

| 명령 | 결과 |
|---|---|
| `npm run ci-check` | ✅ typecheck · lint · 테스트 229개 통과 |
| `npm run release-gate` | ❌ 1건 — `eas.json submit.ios` `ascAppId`/`appleTeamId` 가 `TBD`. 나머지 28개 항목(에셋·jlpt.db 무결성·예문 권한·사이트 URL 3종) 통과 |

`release-gate`의 유일한 실패는 아래 P0 "Apple 자산 채우기"와 같은 항목이다. 값을 채우면 게이트가 전부 통과한다.

---

## P0 — 하드 블로커 (제출 전 반드시)

- [x] **GitHub Pages 배포** — 2026-08-18 `gh-pages` 게시. `/` `/privacy/` `/support/` HTTP 200. AdMob·ATT 공개 포함.
- [x] **버전 bump** — `app.json` / `package.json` `1.0.0`, `runtimeVersion` `1.0.0`. (native build number는 EAS `autoIncrement`/`remote`가 처리)
- [ ] **Android 최종 APK 콜드 스타트 게이트** — 초기화된 에뮬레이터 또는 실기기에 새로 설치한 뒤 시작 화면→홈→첫 학습 카드→TTS까지 확인. `expo_runtime_version` 리소스와 필요한 APK 자산도 대조. 상세 절차는 [`ANDROID_BUILD17_STARTUP_CRASH_POSTMORTEM.md`](./ANDROID_BUILD17_STARTUP_CRASH_POSTMORTEM.md) 참고.
- [ ] **Apple 자산 채우기** — `eas.json` submit.production.ios `ascAppId: "TBD"`, `appleTeamId: "TBD"` → 실값.
  - App Store Connect에서 앱 레코드 생성 후 ascAppId 확보, Apple Developer 멤버십(연 $99) 필요
- [ ] **Google Play 서비스 계정 키** — `eas.json`가 `./secrets/play-service-account.json` 참조하나 **`secrets/` 폴더 없음**.
  - Play Console에서 service account 생성·키 다운로드 → `secrets/`에 배치 (git ignore 확인)
  - Play 개발자 등록 ($25 1회)
- [x] **스토어 그래픽 자산** — `store-assets/`에 시뮬레이터 실화면 리사이즈본 있음 (iOS 6.7/6.5/5.5/iPad, Android phone, feature 1024×500, icon 512). 제출 전 한 번 눈으로 확인.
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

1. 개발자 계정 등록 (Apple $99/yr, Google $25) — 리드타임 김, 먼저
2. GitHub Pages 배포 → URL 200 검증 (P0, 빠름)
3. 스토어 앱 레코드 생성 → ascAppId/teamId·service account 키 확보
4. store-assets 스크린샷·그래픽 제작
5. version 1.0.0 bump → prod 빌드 → 실광고 1회 확인
6. Privacy 라벨/Data Safety/등급 설문 작성
7. 내부 트랙 업로드 → AdMob 앱 연결 → 프로덕션 제출
