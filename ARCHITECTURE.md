# 아키텍처

## 개요

`yooreru.com`은 기존 WordPress.com 블로그를 대체하기 위한 Next.js 16 App Router 기반 블로그다. 공개 블로그, 검색/아카이브, 댓글, 구독, 문의, RSS feed와 내장 어드민을 한 애플리케이션 안에서 제공한다.

핵심 방향은 WordPress의 공개 URL, 카테고리/태그, 댓글, 작성자, 미디어 데이터를 최대한 보존하면서 운영은 Next.js, Prisma, Postgres, Resend, Vercel Blob으로 옮기는 것이다.

## 런타임과 주요 의존성

- Framework: Next.js 16 App Router, React 19, TypeScript
- Database: Prisma 7, Postgres 17, Neon 대상
- Auth: `jose` JWT 세션 쿠키, `bcryptjs` 비밀번호 해시
- Email: Resend. API 키가 없으면 dry-run 로그만 남긴다.
- Media: Vercel Blob. 에디터 업로드와 WordPress 이미지 이전을 지원한다.
- Import: WordPress WXR XML, WordPress CSV export
- Styling: 전역 CSS 중심. 기존 WordPress 블록 클래스와 시각적 구조를 많이 보존한다.

## 디렉터리 구조

- `src/app`: App Router 라우트, Server Actions, feed route
- `src/components`: 공개 블로그 UI, 댓글, 구독 폼, 어드민 UI 컴포넌트
- `src/lib`: 인프라/도메인 공통 코드
- `src/services`: 공개 액션에서 호출하는 쓰기 서비스 레이어
- `prisma`: Prisma schema, migration, DB 제약 문서
- `scripts`: 관리자 seed, WordPress XML/CSV import, slug 정규화 스크립트

## 라우팅

공개 라우트는 WordPress 호환성을 우선한다.

- `/`: 홈. 검색어 `s`가 있으면 검색 결과, 없으면 홈 툴바/헤더/카테고리/달력/푸터를 렌더링한다.
- `/[year]/[month]/[day]/[slug]/`: 게시글 상세. 날짜와 slug가 실제 발행일/slug와 일치해야 한다.
- `/[year]/[month]/`: 월별 아카이브
- `/category/[[...slug]]/`: 카테고리 아카이브. `/category/a/b/page/2/` 형태의 페이지네이션을 catch-all slug에서 파싱한다.
- `/tag/[slug]/`: 태그 아카이브
- `/feed`: RSS 2.0 feed
- `/그네에게`: `src/proxy.ts`에서 `/geuneege`로 rewrite한다.
- `/admin/**`: 내장 어드민

Next.js 16 App Router의 `params`와 `searchParams`는 Promise로 받아 `await`해서 사용한다.

## 데이터 모델

데이터 모델은 WordPress 이전과 블로그 운영을 동시에 고려한다.

- `User`: 관리자/작성자. 게시글 작성자와 초대 생성자를 가진다.
- `Invite`: 관리자/작성자 초대 토큰
- `Post`: 게시글. `wordpressId`, `permalink`, `slug`, `status`, `publishedAt`, `contentHtml`, `contentText`, `authorId`, `categoryId`를 가진다.
- `Category`: 단일 부모를 갖는 카테고리 트리. `wordpressId`와 slug를 보존한다.
- `Tag`, `PostTag`: 태그와 게시글-태그 다대다 관계
- `Comment`: WordPress 댓글 ID, 부모 댓글, 상태를 보존한다.
- `Subscriber`, `EmailDelivery`: 구독자와 글 발행 이메일 전송 기록
- `MediaAsset`: Blob 또는 WordPress 이전 미디어 메타데이터
- `ContactMessage`: 문의 메시지

DB 제약 원칙은 [prisma/CONSTRAINTS.md](prisma/CONSTRAINTS.md)를 따른다. FK 수정/삭제는 기본적으로 제한적이며, 필요한 경우에만 `SetNull` 또는 `Cascade`를 사용한다. timestamp 컬럼은 `timestamptz`를 쓴다.

## 읽기 흐름

읽기 모델은 `src/lib/content.ts`에 모여 있다.

1. Prisma에서 공개 가능한 게시글만 조회한다.
   `status = PUBLISHED`이고 `publishedAt <= now`인 게시글만 공개 페이지에 노출한다.
2. Prisma row를 `BlogPost`, `BlogCategory`, `BlogTag`, `BlogComment` 타입으로 매핑한다.
3. 댓글은 flat row에서 parent-child 트리로 변환한다.
4. 본문 이미지에는 `loading="lazy"`와 `decoding="async"`를 적용하고, import 과정에서 기록된 리사이즈 URL이 있으면 `src`, `width`, `height`를 보정한다.
5. 날짜 기반 URL과 아카이브는 `APP_TIME_ZONE` 기준으로 계산한다. 기본값은 `Asia/Seoul`이다.

`getPublishedPosts`와 `getPublishedPostLinks`는 `unstable_cache`와 React `cache`를 함께 사용한다. 캐시 태그는 `CONTENT_CACHE_TAG = "content"`이며, 쓰기 액션 후 `revalidateTag`로 무효화한다. 게시글 상세 조회는 오래된 상세 캐시를 피하기 위해 slug 단위 DB 조회를 수행한다.

## 쓰기 흐름

쓰기 진입점은 Server Actions다.

- `src/app/actions.ts`: 공개 댓글 작성, 구독 등록, 문의 메시지 전송
- `src/app/admin/actions.ts`: 로그인/로그아웃, 게시글 저장, 카테고리 저장/삭제, 댓글 moderation, 이미지 업로드, 초대 생성/수락

공개 쓰기는 `src/services`로 일부 분리되어 있다.

- `comments.ts`: 댓글 생성과 게시글 댓글 허용 여부 확인
- `subscribers.ts`: 구독자 upsert와 구독 확인 메일
- `contact.ts`: 문의 메시지 저장과 관리자 알림

어드민 게시글 저장은 Server Action 안에서 검증, slug 정규화, excerpt 생성, 태그 upsert, 게시글-태그 재연결, 캐시 무효화, redirect까지 처리한다. 구독자 발송은 현재 동기 루프이며 코드에 별도 job 분리 TODO가 남아 있다.

## 인증과 권한

어드민 인증은 `src/lib/auth.ts`가 담당한다.

- 로그인 시 DB의 `User`를 찾고 `bcrypt`로 비밀번호를 검증한다.
- 검증된 사용자 정보를 HS256 JWT로 서명해 `yooreru_session` httpOnly 쿠키에 저장한다.
- 세션 만료는 7일이다.
- `requireAdmin()`은 세션이 없거나 role이 `ADMIN`이 아니면 `/admin/login`으로 redirect한다.

현재 어드민 페이지와 쓰기 액션 대부분은 관리자 권한을 요구한다. `AUTHOR` role은 모델과 초대 흐름에는 존재하지만, 실제 권한 분기는 제한적이다.

## 메일

`src/lib/mail.ts`가 Resend 클라이언트를 감싼다.

- `RESEND_API_KEY`가 있으면 Resend로 전송한다.
- 키가 없으면 `[mail:dry-run]` 로그를 남기고 성공 형태의 응답을 반환한다.
- 구독 등록 확인, 글 발행 알림, 관리자 초대, 문의 알림에 사용한다.

발행 알림은 `EmailDelivery`에 `SENT` 또는 `FAILED` 결과를 저장한다.

## 미디어

에디터 업로드는 `uploadEditorImage` Server Action에서 처리한다.

- 관리자 권한 필요
- 이미지 MIME 타입만 허용
- 최대 8MB
- `BLOB_READ_WRITE_TOKEN` 필요
- `editor/{year}/{uuid}-{filename}` 경로로 Vercel Blob에 public 업로드
- 업로드 결과는 `MediaAsset`에 저장

WordPress import에서는 이미지 URL을 수집해 다운로드하고, 최적화 가능한 이미지는 `sharp`로 최대 1600px, WebP 품질 82 기준으로 압축한 뒤 Blob에 업로드한다.

## 캐시와 무효화

공개 콘텐츠는 300초 revalidate와 `content` 태그를 사용한다. 댓글 작성, 구독, 게시글 저장, 카테고리 변경은 관련 path와 `CONTENT_CACHE_TAG`를 무효화한다.

주의할 점:

- 카테고리/태그 검색 일부는 전체 공개 게시글을 메모리에서 필터링한다.
- 카테고리 아카이브 페이지는 DB pagination을 사용한다.
- 응답 지연이 알려진 이슈로 남아 있으므로, 데이터가 더 커지면 검색/태그/월별 아카이브 쿼리 최적화가 필요하다.

## 환경 변수

주요 환경 변수:

- `DATABASE_URL`: Prisma/Postgres 연결. 없으면 읽기 함수는 빈 결과를 반환하고, 쓰기 작업은 실패한다.
- `AUTH_SECRET`: 세션 JWT 서명 키
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`: seed/admin 알림
- `NEXT_PUBLIC_SITE_URL`: canonical site URL
- `APP_TIME_ZONE`: 기본 `Asia/Seoul`
- `RESEND_API_KEY`, `RESEND_FROM`: 메일 발송
- `BLOB_READ_WRITE_TOKEN`: Blob 업로드/import

## 운영상 제약과 남은 과제

- 테스트 자동화가 아직 없다.
- 로딩 인디케이터가 없다.
- 전반적인 응답 지연 문제가 알려져 있다.
- 공개 서비스 레이어는 분리 중이지만, 어드민 쓰기 로직은 아직 큰 Server Action 파일에 집중되어 있다.
- 글 발행 이메일은 동기 실행이므로 구독자 수가 늘면 background job 또는 queue로 분리해야 한다.
