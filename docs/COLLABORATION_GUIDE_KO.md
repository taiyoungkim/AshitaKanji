# 오니칸 공동 작업 시작 가이드

이 문서는 개발 경험이 없는 공동 작업자가 **터미널 명령어 없이** 오니칸 프로젝트의 파일을 내려받고, 수정한 내용을 안전하게 전달하는 방법을 설명합니다.

- 프로젝트 주소: [github.com/taiyoungkim/AshitaKanji](https://github.com/taiyoungkim/AshitaKanji)
- 사용하는 프로그램: [GitHub Desktop](https://desktop.github.com/)
- 작업 원칙: `main`에서 직접 수정하지 않고, 매번 내 작업용 브랜치를 만든 뒤 Pull Request로 검토를 요청합니다.

> 도움이 필요하면 혼자 해결하려고 파일을 삭제하거나 되돌리지 말고, 보이는 화면을 캡처해 저장소 관리자에게 보내주세요.

## 먼저 알아둘 네 가지

| 용어 | 쉬운 뜻 |
| --- | --- |
| 저장소(Repository) | 프로젝트 파일이 모여 있는 공유 폴더 |
| 브랜치(Branch) | 원본을 건드리지 않고 작업하는 개인용 복사선 |
| 커밋(Commit) | 현재 변경사항에 이름을 붙여 저장하는 것 |
| Pull Request(PR) | 내 변경사항을 원본에 반영해 달라고 검토 요청하는 것 |

전체 흐름은 아래와 같습니다.

> 초대 수락 → 프로젝트 내려받기 → 최신 내용 받기 → 내 브랜치 만들기 → 파일 수정 → 커밋 → Push → Pull Request

## 1. 최초 한 번만 설정하기

### 1-1. GitHub 계정 만들기

1. [GitHub 가입 페이지](https://github.com/signup)를 엽니다.
2. 이메일 주소, 비밀번호, 사용자명을 입력해 계정을 만듭니다.
3. 받은 이메일에서 이메일 주소를 인증합니다.
4. 만든 **GitHub 사용자명**을 저장소 관리자에게 알려줍니다.

사용자명은 프로필 주소의 마지막 부분입니다. 예를 들어 프로필 주소가 `https://github.com/hana-kim`이라면 사용자명은 `hana-kim`입니다.

### 1-2. 공동 작업 초대 수락하기

저장소 관리자가 초대를 보내면 GitHub 알림 또는 이메일이 도착합니다.

1. 초대 메시지의 **View invitation**을 누릅니다.
2. GitHub에 로그인합니다.
3. **Accept invitation**을 누릅니다.

오니칸 저장소는 공개되어 있어 누구나 볼 수 있지만, 수정한 내용을 올리려면 공동 작업 초대를 수락해야 합니다.

### 1-3. GitHub Desktop 설치 및 로그인

1. [GitHub Desktop 다운로드 페이지](https://desktop.github.com/)를 엽니다.
2. 운영체제에 맞는 설치 파일을 내려받아 설치합니다.
3. GitHub Desktop을 실행합니다.
4. **Sign in to GitHub.com**을 누릅니다.
5. **Continue with browser**를 누르고, 앞에서 만든 GitHub 계정으로 로그인합니다.
6. 브라우저에 승인 화면이 나오면 승인하고 GitHub Desktop으로 돌아옵니다.

비밀번호를 GitHub Desktop 창에 직접 입력하는 방식이 아니라, 브라우저에서 로그인하는 것이 정상입니다.

## 2. 프로젝트를 내 컴퓨터에 내려받기

이 작업을 **Clone(클론)**이라고 합니다. 최초 한 번만 하면 됩니다.

1. GitHub Desktop에서 **File → Clone Repository…**를 누릅니다.
2. **GitHub.com** 탭을 선택합니다.
3. 목록에서 **taiyoungkim/AshitaKanji**를 선택합니다.
   - 목록에 없다면 **URL** 탭을 누르고 아래 주소를 붙여 넣습니다.
   - `https://github.com/taiyoungkim/AshitaKanji.git`
4. **Local Path**에서 프로젝트를 저장할 위치를 선택합니다.
5. **Clone**을 누릅니다.

완료되면 GitHub Desktop 상단의 **Current Repository**에 `AshitaKanji`가 표시됩니다.

> 프로젝트 폴더를 클라우드 동기화 폴더나 다른 사람과 공유되는 폴더 안에 두면 충돌이 생길 수 있습니다. 가능하면 일반적인 `Documents` 또는 `Projects` 폴더 아래에 저장하세요.

## 3. 작업을 시작할 때마다 하기

### 3-1. 저장소와 브랜치 확인하기

GitHub Desktop 상단을 확인합니다.

- **Current Repository**: `AshitaKanji`
- **Current Branch**: `main`

다른 저장소가 보이면 **Current Repository**를 눌러 `AshitaKanji`를 선택합니다.

### 3-2. 최신 내용 받기

1. **Current Branch**를 눌러 `main`을 선택합니다.
2. 상단의 **Fetch origin**을 누릅니다.
3. 버튼이 **Pull origin**으로 바뀌면 한 번 더 누릅니다.

이 단계는 다른 사람이 먼저 반영한 변경사항을 내 컴퓨터에 받는 과정입니다. 작업을 시작할 때마다 실행하세요.

### 3-3. 내 작업용 브랜치 만들기

1. 상단의 **Current Branch**를 누릅니다.
2. **New Branch**를 누릅니다.
3. 브랜치 이름을 입력합니다.
4. 기준 브랜치를 묻는다면 `main`을 선택합니다.
5. **Create Branch**를 누릅니다.

브랜치 이름은 영문 소문자와 하이픈을 사용하면 안전합니다.

- 문구 수정: `이름/fix-copy`
- 단어 데이터 검수: `이름/review-vocab`
- 이미지 교체: `이름/update-images`

예: `hana/review-vocab`

> 상단의 **Current Branch**가 `main`이라면 아직 파일을 수정하지 마세요. 반드시 내 작업용 브랜치로 바꾼 뒤 시작합니다.

## 4. 파일 수정하기

1. GitHub Desktop 메뉴에서 **Repository → Show in Finder**(Mac) 또는 **Show in Explorer**(Windows)를 누릅니다.
2. 열린 `AshitaKanji` 폴더 안에서 요청받은 파일만 수정합니다.
3. 수정한 파일을 저장합니다.
4. GitHub Desktop으로 돌아옵니다.

GitHub Desktop 왼쪽의 **Changes** 목록에 수정한 파일이 나타납니다.

수정하기 전에 관리자에게 아래 내용을 확인하면 좋습니다.

- 어느 파일을 수정해야 하는지
- 어떤 내용을 어떻게 바꿔야 하는지
- 이미지라면 권장 크기와 파일 형식이 무엇인지
- 언제까지 검토를 요청하면 되는지

### 변경사항 확인하기

GitHub Desktop의 **Changes** 화면에서 각 파일을 누르면 바뀐 부분을 확인할 수 있습니다.

- 초록색: 새로 추가한 내용
- 빨간색: 삭제한 내용
- 예상하지 못한 파일이 보임: 커밋하지 말고 관리자에게 문의

비밀번호, 인증 키, 개인정보가 들어간 파일은 절대로 올리지 않습니다. 특히 `.env`, 비밀번호 메모, 개인 인증서가 보이면 즉시 작업을 멈추고 관리자에게 알립니다.

## 5. 변경사항 저장하고 올리기

### 5-1. 커밋 만들기

1. 왼쪽 **Changes** 목록에서 내가 수정한 파일만 체크되어 있는지 확인합니다.
2. 왼쪽 아래 **Summary (required)** 칸에 무엇을 바꿨는지 짧게 적습니다.
3. **Commit to 현재-브랜치-이름** 버튼을 누릅니다.

커밋 메시지는 아래처럼 작성하면 됩니다.

- `문구 오탈자 수정`
- `N3 단어 뜻 검수`
- `튜토리얼 이미지 교체`

한 번에 서로 다른 작업을 했다면 커밋도 나누는 것이 좋습니다. 예를 들어 문구 수정과 이미지 교체는 각각 별도의 커밋으로 저장합니다.

### 5-2. GitHub에 올리기

커밋 후 상단에 보이는 버튼을 누릅니다.

- 처음 올리는 브랜치: **Publish branch**
- 이미 한 번 올린 브랜치: **Push origin**

버튼을 누른 뒤 **No local changes**가 보이면 내 컴퓨터의 변경사항이 저장된 상태입니다.

## 6. 검토 요청하기

1. GitHub Desktop에서 **Preview Pull Request**를 누릅니다.
2. 비교 화면에서 아래 항목을 확인합니다.
   - base: `main`
   - compare 또는 head: 내가 만든 브랜치
3. **Create Pull Request**를 누릅니다.
4. 브라우저가 열리면 제목과 설명을 작성합니다.
5. 다시 **Create Pull Request**를 누릅니다.

제목 예시:

> N3 단어 뜻 50개 검수

설명 예시:

> 변경 내용
> - N3 단어 50개의 한국어 뜻을 확인했습니다.
> - 어색한 표현 8개를 수정했습니다.
>
> 확인이 필요한 부분
> - `〇〇`의 뜻은 두 가지 후보 중 어느 것이 좋은지 확인 부탁드립니다.

Pull Request가 만들어지면 주소를 복사해 관리자에게 보내고 검토를 요청합니다. **직접 Merge 버튼을 누르지 말고**, 관리자의 검토를 기다립니다.

## 7. 수정 요청을 받았을 때

새 브랜치나 Pull Request를 다시 만들 필요가 없습니다.

1. GitHub Desktop에서 기존 작업 브랜치를 선택합니다.
2. 요청받은 내용을 수정하고 파일을 저장합니다.
3. 새 커밋을 만듭니다.
4. **Push origin**을 누릅니다.

기존 Pull Request에 새 변경사항이 자동으로 추가됩니다. 완료했다는 댓글을 Pull Request에 남기면 됩니다.

## 8. 작업이 반영된 뒤 정리하기

관리자가 Pull Request를 병합했다고 알려주면 다음 작업을 준비합니다.

1. GitHub Desktop에서 **Current Branch → main**을 선택합니다.
2. **Fetch origin**을 누릅니다.
3. **Pull origin**이 나타나면 누릅니다.
4. 다음 작업 때는 `main`에서 새로운 브랜치를 다시 만듭니다.

작업 브랜치 삭제는 익숙해질 때까지 관리자가 처리하도록 두어도 괜찮습니다.

## 문제가 생겼을 때

### 저장소가 목록에 보이지 않아요

- 공동 작업 초대를 수락했는지 확인합니다.
- GitHub Desktop에 초대받은 계정으로 로그인했는지 확인합니다.
- **File → Clone Repository… → URL**에서 저장소 주소를 직접 입력합니다.

### Push가 되지 않아요

- 인터넷 연결을 확인합니다.
- GitHub Desktop에서 **Fetch origin**을 먼저 누릅니다.
- `permission`, `access`, `authentication`이라는 문구가 보이면 초대와 로그인 계정을 확인합니다.
- 계속 실패하면 오류 화면을 캡처해 관리자에게 보냅니다.

### Merge conflict라는 메시지가 나와요

다른 사람이 같은 부분을 먼저 수정한 상태입니다. 파일을 임의로 삭제하거나 **Force push**하지 말고 관리자에게 연락합니다.

보낼 내용:

- 현재 브랜치 이름
- 오류 메시지가 보이는 전체 화면 캡처
- 마지막으로 누른 버튼
- 수정 중이던 파일 이름

### 수정한 내용이 사라진 것 같아요

아래 버튼은 누르지 말고 관리자에게 먼저 문의합니다.

- **Discard Changes**
- **Discard All Changes**
- **Force Push**
- 저장소나 프로젝트 폴더 삭제

## 관리자에게 보낼 메시지 예시

### 작업 시작 전

> `hana/review-vocab` 브랜치에서 단어 뜻 검수를 시작하겠습니다. 수정 대상은 `파일명`이 맞는지 확인 부탁드립니다.

### 검토 요청

> 작업을 올리고 Pull Request를 만들었습니다. 변경 내용과 확인이 필요한 부분을 설명에 적었습니다. 검토 부탁드립니다: `PR 주소`

### 오류 문의

> GitHub Desktop에서 오류가 발생했습니다. 현재 브랜치는 `브랜치 이름`이고 마지막으로 `누른 버튼`을 눌렀습니다. 오류 화면을 함께 보냅니다.

## 마지막 확인표

작업을 올리기 전에 아래 항목을 확인합니다.

- [ ] 저장소가 `AshitaKanji`인가?
- [ ] `main`이 아닌 내 작업 브랜치인가?
- [ ] 작업 시작 전에 `main`에서 Fetch/Pull 했는가?
- [ ] 요청받은 파일만 수정했는가?
- [ ] 비밀번호, 인증 키, 개인정보가 포함되지 않았는가?
- [ ] 변경사항을 직접 확인했는가?
- [ ] 이해하기 쉬운 커밋 메시지를 작성했는가?
- [ ] Push 또는 Publish branch를 눌렀는가?
- [ ] base가 `main`인 Pull Request를 만들었는가?
- [ ] 관리자에게 Pull Request 주소를 보냈는가?

## 공식 도움말

- [GitHub Desktop 설치 및 설정](https://docs.github.com/en/desktop/installing-and-authenticating-to-github-desktop/setting-up-github-desktop)
- [GitHub Desktop에서 저장소 복제하기](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop)
- [GitHub Desktop에서 브랜치 관리하기](https://docs.github.com/en/desktop/making-changes-in-a-branch/managing-branches-in-github-desktop)
- [변경사항 커밋 및 Push하기](https://docs.github.com/en/desktop/making-changes-in-a-branch/committing-and-reviewing-changes-to-your-project-in-github-desktop)
- [GitHub Desktop에서 Pull Request 만들기](https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/creating-an-issue-or-pull-request-from-github-desktop)
- [브랜치 최신 상태로 동기화하기](https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/syncing-your-branch-in-github-desktop)

---

문서 기준일: 2026-08-07
