# Release Checklist — 오니칸 (AshitaKanji)

Last updated: 2026-06-13
App: 오니칸 / slug `ashitakanji` / bundleId `com.taiyoungkim.ashitakanji` (iOS+Android 동일)
Current version: **0.1.0** → 출시 시 **1.0.0** 로 bump 필요

스토어: Apple App Store + Google Play. 개발자 등록 = 개인(Individual).

---

## 우선순위 요약

| Tier | 의미 | 통과 못 하면 |
|---|---|---|
| **P0** | 제출 자체 불가 (하드 블로커) | EAS submit / 스토어 업로드 실패 |
| **P1** | 심사 통과·광고 게재에 필수 | reject 또는 광고 노출 안 됨 |
| **P2** | 출시 직후/품질 | 출시는 되나 리스크 |

현재 상태 한 줄: **코드·광고 구현 완료. 블로커는 전부 "스토어 계정·자산·호스팅" 운영 작업.**

---

## P0 — 하드 블로커 (제출 전 반드시)

- [ ] **GitHub Pages 배포** — `privacy/`·`support/` 현재 **HTTP 404**. 양 스토어 모두 개인정보처리방침 URL 필수.
  - `deploy-pages.sh` 실행 → `gh-pages` 브랜치 push → Settings>Pages 활성화
  - 검증: `curl -I https://taiyoungkim.github.io/AshitaKanji/privacy/` → **200**
  - support URL 동일 검증
- [ ] **버전 bump** — `app.json` `version` `0.1.0` → `1.0.0`. (build number는 EAS `autoIncrement`/`remote`가 처리)
- [ ] **Apple 자산 채우기** — `eas.json` submit.production.ios `ascAppId: "TBD"`, `appleTeamId: "TBD"` → 실값.
  - App Store Connect에서 앱 레코드 생성 후 ascAppId 확보, Apple Developer 멤버십(연 $99) 필요
- [ ] **Google Play 서비스 계정 키** — `eas.json`가 `./secrets/play-service-account.json` 참조하나 **`secrets/` 폴더 없음**.
  - Play Console에서 service account 생성·키 다운로드 → `secrets/`에 배치 (git ignore 확인)
  - Play 개발자 등록 ($25 1회)
- [ ] **스토어 그래픽 자산** — `store-assets/` **비어있음**.
  - iOS: 6.7"·6.5"·5.5" 스크린샷, (iPad supportsTablet=true → iPad 스크린샷도 필요)
  - Android: 폰 스크린샷 2+, **Feature graphic 1024×500**, 512×512 아이콘
- [ ] **prod 빌드 실광고 1회 확인** — `__DEV__=false` 빌드에서 실 Unit 로드되는지. ⚠️ 본인 클릭 금지 (계정 정지)

## P1 — 심사 통과·광고 게재 필수

- [ ] **AdMob 앱-스토어 연결** — 출시(또는 스토어 등록) 후 AdMob 콘솔에서 각 앱을 스토어 리스팅에 link. 미연결 = "게재 제한" 유지, 실광고 안 뜸
- [ ] **App Store 개인정보 라벨 (Privacy Nutrition Label)** — IDFA/광고 데이터 수집 신고. AdMob+ATT 쓰므로 "Tracking" 카테고리 정확히 기입. 라벨 ≠ 실동작이면 reject
- [ ] **Play Data Safety form** — 광고 SDK 데이터 수집 항목 신고
- [ ] **ATT 프롬프트 동작 확인** — iOS 14.5+ ATT 다이얼로그 뜨고, 거부해도 앱·광고(non-personalized) 정상
- [ ] **연령 등급 / 콘텐츠 등급 설문** — 양 스토어. 광고 포함 = 등급 설문에 광고 있음 표시
- [ ] **스토어 리스팅 텍스트** — 앱명(오니칸), 설명, 키워드, 카테고리(교육). 일본어/한국어 현지화 결정
- [ ] **지원 URL·이메일** — support 페이지(P0 배포에 포함) + `datin0214@gmail.com`
- [ ] **`ITSAppUsesNonExemptEncryption=false`** 이미 설정됨 ✅ (확인만)

## P2 — 품질·출시 직후

- [ ] **내부 테스트 트랙** — Play `track: internal`, Apple TestFlight 1라운드 후 프로덕션 승격
- [ ] **빈도캡 실기기 검증** — adPolicy (3일/5세션 유예, 2세션당 1회, 10분 간격, 일 3회) 실디바이스에서 체감 확인
- [ ] **크래시/ANR 모니터링** — newArchEnabled=true 라 신아키텍처 회귀 주시
- [ ] **OTA = disabled** 확정 (RELEASE_DECISIONS 정책). 핫픽스 = 스토어 리빌드, P0는 Apple 신속심사
- [ ] **placeholder CI 게이트** — `site/ docs/release/PRIVACY_POLICY.md SUPPORT.md app/ store-assets/` 스캔 0 hits (RELEASE_DECISIONS 정의)
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
