# Android build 17 시작 크래시 사후 기록

상태: **해결됨**  
발생일: 2026-08-11  
영향 빌드: Android `versionCode 17` (`android-test-build17`)  
수정 빌드: Android `versionCode 18` (`android-test-build18`)  
수정 커밋: [`5436a74`](https://github.com/taiyoungkim/AshitaKanji/commit/5436a74c60545fc6eaab69c75fdad1d29e072626)

## 요약

build 17 APK는 설치에는 성공했지만 앱을 실행하면 React Native 화면이 뜨기 전에 즉시 종료됐다. 원인은 디자인 코드가 아니라 Expo Updates의 Android 네이티브 설정과 APK 패키징 결과가 일치하지 않았기 때문이다.

`app.json`의 `runtimeVersion.policy`가 `fingerprint`인 상태에서 APK의 `expo_runtime_version` 리소스에는 `file:fingerprint`가 기록됐지만, 이 값이 가리키는 `assets/fingerprint` 파일은 APK에 포함되지 않았다. 앱 초기화 중 Expo Updates가 파일을 읽으려다 `FileNotFoundException`을 발생시켰고, JavaScript 앱이 시작되기 전에 프로세스가 종료됐다.

## 사용자 영향

- APK 다운로드와 설치는 정상적으로 끝났다.
- Play Protect 경고를 무시해 설치해도 앱 실행 직후 종료됐다.
- 오류가 React Native 진입 전에 발생했으므로 오류 화면이나 복구 UI를 보여줄 수 없었다.
- 학습 데이터, TTS, 예문 또는 디자인 렌더링과는 무관했다.

## 확인된 증상과 증거

build 17을 새 Android 에뮬레이터에 설치해 콜드 스타트했을 때 `logcat`에서 다음 흐름이 확인됐다.

```text
java.io.FileNotFoundException: fingerprint
at expo.modules.updates.UpdatesConfiguration.getRuntimeVersion(...)
```

APK 내부 상태는 다음과 같았다.

```text
expo_runtime_version = file:fingerprint
assets/fingerprint = 없음
```

비교 대상인 이전 정상 빌드와 수정된 build 18은 네이티브 리소스에 실제 버전값 `0.1.0`을 포함했다.

## 근본 원인

직접 원인은 아래 두 조건의 조합이다.

1. Android 리소스의 `expo_runtime_version`이 실제 버전이 아니라 `file:fingerprint` 파일 참조값이었다.
2. 참조 대상인 `assets/fingerprint`가 최종 APK에 패키징되지 않았다.

따라서 Expo Updates 초기화가 런타임 버전을 결정하지 못했다. 이 초기화는 앱의 JavaScript와 화면 렌더링보다 먼저 실행되므로 디자인 변경이 포함된 빌드에서 발견됐더라도 디자인 자체가 크래시 원인은 아니었다.

## 적용한 수정

build 18에서는 검증 가능한 고정 런타임 버전을 명시하고 Android 빌드 번호를 올렸다.

```json
{
  "expo": {
    "version": "0.1.0",
    "runtimeVersion": "0.1.0",
    "android": {
      "versionCode": 18
    }
  }
}
```

수정 후 네이티브 프로젝트를 다시 생성하고 릴리즈 APK를 새로 빌드했다.

```bash
CI=1 npx expo prebuild --platform android --no-install
cd android
NODE_ENV=production ./gradlew assembleRelease --no-daemon --max-workers=1
```

`runtimeVersion`을 `appVersion` 또는 `fingerprint` 정책으로 다시 바꾸는 것은 가능하지만 네이티브 릴리즈 변경으로 취급해야 한다. 특히 `fingerprint` 정책은 최종 APK에 필요한 fingerprint 파일이 실제로 포함되는지 확인하기 전에는 사용하지 않는다.

## build 18 검증 결과

- `npm run ci-check` 통과
  - 테스트 파일 17개
  - 테스트 101개
  - 타입 검사와 린트 통과
- APK 서명 검증 통과
- `zipalign` 검증 통과
- APK 압축 무결성 검증 통과
- 내장 JLPT 데이터베이스 해시가 원본과 일치
- OGG 음성 자산 13,754개 포함 확인
- 초기화된 Android API 37 에뮬레이터에 새 설치 성공
- 콜드 스타트 성공, 앱 프로세스 유지 및 crash exit 기록 없음
- 시작 화면 → 튜토리얼 → 홈 → 학습 카드 → 뜻·예문 표시 확인
- 단어 TTS 재생 확인

배포 APK:

- 릴리즈: [오니칸 Android 테스트 build 18](https://github.com/taiyoungkim/AshitaKanji/releases/tag/android-test-build18)
- 파일 크기: `207,533,470 bytes`
- SHA-256: `70a129876fdbe26588863a578bbef7d59ded13d7324db260ede1af190e8c4e20`

문제가 있는 build 17 릴리즈는 삭제하지 않고 **설치 금지**로 표시해 사고 기록과 비교 자료로 보존했다.

## 재발 방지 릴리즈 게이트

Android APK를 배포하기 전에 아래 순서를 모두 통과한다.

### 1. Expo 설정과 생성된 네이티브 리소스 비교

```bash
CI=1 npx expo prebuild --platform android --no-install
rg -n "expo_runtime_version" android/app/src/main/res/values/strings.xml
```

기대값은 현재 배포할 런타임 버전이다. `file:fingerprint`가 나오면 다음 단계에서 fingerprint 파일 포함 여부를 반드시 확인한다.

### 2. 최종 APK 자체 검사

```bash
APK=android/app/build/outputs/apk/release/app-release.apk
AAPT2=$(find "$HOME/Library/Android/sdk/build-tools" -type f -name aapt2 | sort -V | tail -1)

"$AAPT2" dump resources "$APK" | rg -A3 -B3 "expo_runtime_version"
unzip -l "$APK" | rg "assets/fingerprint"
```

- 고정 버전 또는 `appVersion` 결과를 사용한다면 APK 리소스에 실제 버전 문자열이 있어야 한다.
- `file:fingerprint`라면 `assets/fingerprint`가 반드시 존재해야 한다.
- 둘 중 어느 조건도 만족하지 않으면 APK를 배포하지 않는다.

### 3. 깨끗한 설치와 콜드 스타트

기존 설치 위에 덮어쓰는 테스트만으로는 부족하다. 앱을 제거하거나 데이터가 초기화된 에뮬레이터·실기기에 APK를 새로 설치한다.

```bash
adb uninstall com.taiyoungkim.ashitakanji || true
adb install "$APK"
adb shell am force-stop com.taiyoungkim.ashitakanji
adb shell monkey -p com.taiyoungkim.ashitakanji -c android.intent.category.LAUNCHER 1
```

앱 프로세스가 유지되는지, `logcat`에 `FATAL EXCEPTION`, `AndroidRuntime`, Expo Updates 초기화 오류가 없는지 확인한다. 최소한 시작 화면, 홈, 첫 학습 카드와 음성 재생까지 직접 확인한다.

### 4. 배포 운영

- 실패한 APK와 같은 `versionCode`로 수정본을 배포하지 않는다.
- 수정 빌드는 `versionCode`를 올린다.
- 실패 릴리즈는 삭제보다 설치 금지 경고를 우선해 사용자가 잘못된 파일을 받지 않게 한다.
- GitHub 릴리즈 자산의 크기와 SHA-256을 로컬 APK와 대조한다.

## 빠른 진단 기준

앱이 화면을 한 번도 그리지 못하고 종료되면 UI 변경부터 의심하지 않는다. 아래 순서로 범위를 좁힌다.

1. `adb logcat`에서 최초 `FATAL EXCEPTION` 확인
2. 예외가 JavaScript 실행 전인지 확인
3. Expo Updates의 `runtimeVersion` 리소스와 APK 자산 대조
4. APK 서명·정렬·압축 무결성 확인
5. 초기화된 환경에서 같은 APK로 재현

이 사건의 핵심 교훈은 **빌드 성공과 설치 성공이 앱 시작 성공을 보장하지 않는다**는 점이다. Android 릴리즈의 최종 통과 기준은 정적 검사뿐 아니라 깨끗한 환경에서의 콜드 스타트와 핵심 화면·음성 동작 확인이다.
