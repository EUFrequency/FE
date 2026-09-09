# Frequency

학교 축제/행사 기간에 학과 주점을 예약하고, 원한다면 다른 학과와 미팅(과팅)까지 신청할 수 있는 비회원제 웹사이트입니다.

- **`/festival`** — 축제 시즌 공개 페이지. 누구나(로그인 없이) 주점 배치도를 보고 예약을 넣을 수 있습니다.
- **`/admin`** — 관리자 페이지. 비밀번호로만 들어갈 수 있고, 시즌/주점/예약/배치도를 관리합니다.

이 문서는 나중에 이 프로젝트를 이어받아 유지보수할 사람을 위한 가이드입니다.

## 시작하기

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)으로 접속합니다. `/festival`은 바로 볼 수 있지만, `/admin`은 아래 환경변수 설정이 끝나야 정상 동작합니다.

## 환경변수 설정

`.env.example`을 복사해서 `.env.local`을 만들고 값을 채웁니다 (`.env.local`은 git에 올라가지 않습니다).

```bash
cp .env.example .env.local
```

### 1. 관리자 비밀번호

```
ADMIN_PASSWORD=원하는_비밀번호
ADMIN_SESSION_SECRET=아무_긴_무작위_문자열
```

`/admin`에 접속하면 이 비밀번호를 입력해야 로그인됩니다. `ADMIN_SESSION_SECRET`은 로그인 세션 쿠키에 서명할 때 쓰는 값이라 아무 문자열이나 넣어도 되지만, 실제 배포할 땐 추측하기 어려운 값으로 넣어주세요.

### 2. Firebase (실제 데이터 저장소)

이 프로젝트의 모든 데이터(시즌, 주점, 예약, 배치도)는 **Firestore**에 저장됩니다. 처음 설정하는 경우:

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만듭니다 (없다면).
2. 왼쪽 메뉴 **Firestore Database** → 아직 안 만들었으면 "데이터베이스 만들기" (프로덕션 모드 추천).
3. Firestore **규칙** 탭에서 아래처럼 전체 차단으로 잠급니다. 이 앱은 브라우저에서 Firestore를 직접 건드리지 않고, 서버(관리자 비밀번호로 보호된 Server Action)에서만 접근하기 때문에 규칙을 열어둘 필요가 없습니다.
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```
4. **프로젝트 설정 → 서비스 계정** 탭 → "새 비공개 키 생성"으로 JSON 파일을 받습니다.
5. 그 JSON 안의 값 3개를 `.env.local`에 옮겨 적습니다:
   ```
   FIREBASE_PROJECT_ID=<project_id>
   FIREBASE_CLIENT_EMAIL=<client_email>
   FIREBASE_PRIVATE_KEY="<private_key, 줄바꿈(\n) 그대로 큰따옴표로 감싸서>"
   ```

이 값들은 **서버에서만** 쓰이고 브라우저로 전송되지 않습니다 (`src/lib/firebase/admin.ts`, `server-only`로 보호됨). 다운받은 JSON 파일 자체를 저장소에 커밋하지 마세요.

값을 안 채워도 앱은 빌드/실행은 되지만, `/admin`과 `/festival` 양쪽에서 "Firebase 연동이 아직 설정되지 않았습니다" 같은 안내만 뜨고 실제 데이터는 안 보입니다.

## 데이터가 저장되는 곳

Firestore 콘솔(**Firestore Database → 데이터** 탭)에서 아래 컬렉션들을 볼 수 있습니다.

| 컬렉션 | 내용 | 비고 |
| --- | --- | --- |
| `seasons` | 시즌(축제/이벤트) 목록 | 컬렉션이 비어있으면 첫 조회 시 더미 데이터로 자동 채워짐 |
| `reservations` | 주점 예약 신청 내역 | `/festival`에서 접수되면 `status: "pending"`으로 여기 쌓임. 마찬가지로 비어있으면 자동 시드 |
| `booths` | 주점 정보 (이름/학과/메뉴/최소주문금액 등) | **자동 시드 안 됨** — `/admin`에서 직접 등록해야 함 |
| `layouts` | 시즌별 M행 N열 배치도 | 문서 id = 시즌 id |

### 이미지는 어디에 저장되나요?

Firebase **Storage는 쓰지 않습니다** (최근 정책상 유료 플랜이 필요해져서 피함). 대신 업로드된 이미지를 브라우저에서 캔버스로 리사이즈(최대 960px)·압축(JPEG 72%)한 뒤, **base64 텍스트로 인코딩해서 Firestore 문서에 그대로** 저장합니다.

`booths` 문서 자체엔 이미지를 안 넣고, 용량 제한(문서당 1MB)을 피하려고 이미지 1장당 문서 1개씩 하위 컬렉션에 나눠 저장합니다:

```
booths/{주점id}
  └ images/{이미지id}   ← dataUrl 필드에 base64 문자열이 통째로 들어있음
```

콘솔에서 특정 주점 문서를 열고 `images` 하위 컬렉션을 펼치면 실제 이미지 데이터(`dataUrl` 필드)를 볼 수 있습니다.

## 폴더 구조

```
src/
  lib/firebase/admin.ts        서버 전용 Firebase Admin SDK 초기화 (절대 클라이언트에서 import 금지)
  app/
    festival/                  공개 예약 페이지 (/festival)
      page.tsx                 서버 컴포넌트 - Firestore에서 주점 목록을 가져와 내려줌
      _components/             배치도, 주점 상세, 예약 폼 등
      _lib/reservation-actions.ts   예약 접수 Server Action (인증 불필요, 공개)
      data.ts                  학과 목록/은행 목록 등 폼에 쓰는 상수 (더 이상 안 쓰는 더미 BOOTHS도 참고용으로 남아있음)
    admin/                     관리자 페이지 (/admin, 비밀번호로 보호)
      page.tsx                 인증 체크 후 초기 데이터를 서버에서 fetch
      actions.ts                로그인/로그아웃
      _lib/
        auth.ts                 비밀번호 검증, 세션 쿠키
        firestore-*.ts          Firestore 읽기/쓰기 (서버 전용)
        *-actions.ts             위 함수들을 감싸는 Server Action (관리자 인증 재확인)
        store.tsx                클라이언트 쪽 상태 캐시 (Context) - 데이터 원천은 항상 Firestore
      _components/tabs/         대시보드/매출관리/시즌관리/예약/주점등록/주점배치/요청관리
```

## 관리자 페이지 구성

사이드바는 세 구역으로 나뉩니다.

- **대시보드 / 매출 관리 / 시즌 관리** — 시즌 관리는 표에서 "활성화"를 눌러 현재 진행중인 시즌을 지정합니다.
- **축제 시즌: 예약 / 주점 등록 / 주점 배치**
  - 예약 = 승인 대기(반려/승인 처리) · 확정(주점별 필터) · 결산(주점별·전체 매출 집계)
  - 주점 등록 = 모달에서 등록/수정, 설명 이미지 최대 5장·메뉴 최대 8개
  - 주점 배치 = M행 N열 격자에 드래그 앤 드롭(또는 클릭)으로 배치, "저장하기"를 눌러야 Firestore에 반영
- **이벤트 시즌: 요청 관리** — 미구현 (추후 비회원 미팅 신청 전용 시즌 기능용)

## 알아두면 좋은 점

- `/festival`은 Firestore 읽기 비용을 아끼려고 30초 캐시(ISR)가 걸려 있습니다. 관리자가 주점을 등록/수정해도 최대 30초 정도 늦게 반영될 수 있습니다 (`src/app/festival/page.tsx`의 `revalidate`).
- `/admin`의 각 탭에 있는 "새로고침" 버튼은 다른 관리자가 동시에 바꾼 내용을 다시 불러올 때 씁니다.
- `booths`/`seasons`/`reservations` 컬렉션 이름이나 문서 구조를 바꾸려면 `src/app/admin/_lib/firestore-*.ts` 파일들만 고치면 됩니다 - 화면 컴포넌트는 이 파일들이 주는 타입(`src/app/admin/_lib/types.ts`)만 알면 됩니다.

## 배포

Vercel에 올릴 경우: 저장소를 Import하고 위의 환경변수(`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)를 Vercel 프로젝트 설정의 Environment Variables에 그대로 넣어주면 됩니다. `FIREBASE_PRIVATE_KEY`는 줄바꿈이 포함된 값이니 그대로 붙여넣으면 됩니다.
