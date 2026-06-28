# 설계 결정

## 2026-06-28: 어드민 세션 도메인은 apex host로 고정하고 자동 저장은 초안에만 적용
- 근거 커밋: `Add admin autosave and canonical redirect`
- 이유: 세션 쿠키는 host-only로 발급되므로 `www.yooreru.com`과 `yooreru.com`을 섞어 쓰면 7일 이내에도 로그인 상태가 분리된다. `/admin` 요청만 apex host로 모아 세션 도메인 혼선을 줄인다.
- 제약: 공개 페이지는 `www` redirect 대상에서 제외한다. 자동 임시 저장은 10분 간격으로 새 글과 기존 초안에만 적용하고, 발행/예약 글은 명시적 저장 없이 조용히 덮어쓰지 않는다.

## 2026-06-28: 어드민 본문 글꼴 선택은 저장 HTML의 font-family class로 보존
- 근거 커밋: `Add admin post font picker`
- 이유: 게시글 본문은 이미 `Post.contentHtml`로 저장되고 공개 페이지에서 WordPress 호환 class를 전역 CSS로 렌더링한다. 글꼴 선택을 별도 DB 컬럼으로 분리하면 블록/부분 선택 글꼴을 표현하기 어렵고 기존 WordPress식 HTML 구조와도 어긋난다.
- 제약: 어드민 에디터는 선택 영역 또는 현재 블록에 `has-*-font-family` class를 적용한다. 공개 렌더링은 전역 CSS의 font stack을 따른다. 바탕 계열은 OS 기본 `Batang` 대신 웹폰트로 제공되는 Noto Serif KR을 사용하고, 고딕 계열은 Noto Sans KR/Pretendard를 사용한다.

## 2026-05-11: slug는 디코딩과 Unicode NFC 정규화를 거쳐 비교
- 근거 커밋: `85be336` Fix slug matching and normalize slugs
- 이유: WordPress export와 브라우저 URL에서 한글 slug가 URL 인코딩, 이중 인코딩, Unicode 정규화 차이로 달라질 수 있다.
- 제약: `decodeSlug`, `normalizeSlug`를 통해 slug를 정규화한다. 기존 DB 데이터는 `scripts/normalize-post-slugs.ts`로 보정할 수 있다.

## 2026-05-10: 어드민 인증은 JWT 세션 쿠키와 DB 사용자로 처리
- 근거 커밋: `3daabd2` Implement blog and admin application
- 이유: 별도 인증 SaaS 없이 소규모 내장 어드민에 필요한 로그인, 관리자 보호, 초대 흐름을 구현할 수 있다.
- 거부된 대안: 외부 인증 제공자 도입. 현재 요구 범위에서는 운영 복잡도가 크다.
- 제약: 세션 쿠키 이름은 `yooreru_session`, 만료는 7일이다. `AUTHOR` role은 모델에 있으나 현재 주요 어드민 접근은 `ADMIN` 중심이다.

## 2026-05-31: 런타임 DB 접근은 `src/services`로 집중
- 근거 커밋: `Separate admin service layer`, `Route runtime DB access through services`
- 이유: `src/app`과 `src/lib`에 Prisma 호출이 흩어지면 page/action 경계와 도메인 DB 로직이 섞인다. 서비스 레이어를 단일 DB 접근 경계로 두면 권한, fallback, 캐시 무효화, 향후 테스트 지점을 명확히 나눌 수 있다.
- 제약: `src/lib/prisma.ts`는 Prisma client 인프라만 담당한다. `src/lib`의 다른 파일은 DB를 직접 호출하지 않는다. 런타임 DB 읽기/쓰기는 `src/services`를 거치며, import/seed 같은 운영 스크립트는 별도 도구로 예외다.

## 2026-05-10: 공개 콘텐츠 읽기는 `src/services/content.ts` 읽기 모델로 집중
- 근거 커밋: `3daabd2` Implement blog and admin application, `648cf05` Fix post slug lookup and cache content queries, `af4103a` Avoid stale cache for post detail lookups
- 이유: 공개 페이지들이 같은 게시글/카테고리/태그/댓글 매핑 규칙을 공유한다. WordPress 댓글 정리, 댓글 트리 구성, 이미지 속성 보정, 시간대 기반 URL 생성을 한 곳에서 유지한다.
- 제약: 목록 조회는 `unstable_cache`와 React `cache`를 사용하지만, 게시글 상세는 stale cache를 피하기 위해 slug로 DB를 직접 조회하고 날짜 path를 검증한다.

## 2026-05-10: WordPress 이미지는 import 시 Blob으로 이전하고 가능한 경우 최적화
- 근거 커밋: `1848922` Optimize WordPress image uploads
- 이유: WordPress.com 원본 이미지 의존도를 줄이고 Vercel 배포 환경에서 관리 가능한 미디어 URL을 확보한다. 큰 이미지는 로딩 성능에 영향을 주므로 import 단계에서 축소/압축한다.
- 제약: `BLOB_READ_WRITE_TOKEN`이 필요하다. 최적화 가능한 이미지는 최대 1600px, WebP 품질 82로 변환하되, 변환 결과가 원본보다 크면 원본을 유지한다.

## 2026-05-10: Next.js App Router와 Server Actions 중심으로 블로그/어드민을 구현
- 근거 커밋: `3daabd2` Implement blog and admin application
- 이유: 공개 페이지, 어드민 페이지, RSS route, 폼 mutation을 한 Next.js 애플리케이션 안에서 관리할 수 있다. 서버 컴포넌트에서 읽기 모델을 직접 조회하고, Server Actions로 댓글/구독/문의/어드민 쓰기를 처리한다.
- 제약: Next.js 16 App Router 규칙을 따른다. 라우트의 `params`, `searchParams`는 Promise로 받아 처리한다.

## 2026-05-10: Prisma 7 + Postgres를 단일 영속 저장소로 사용
- 근거 커밋: `efb598b` Add Prisma data model and dependencies
- 이유: WordPress 이전 데이터와 신규 운영 데이터를 같은 관계형 모델에서 관리해야 한다. 게시글, 작성자, 카테고리 트리, 태그, 댓글, 구독자, 이메일 전송 기록, 미디어, 문의 메시지 사이의 관계가 명확하다.
- 제약: `prisma/CONSTRAINTS.md`에 따라 FK 수정/삭제 정책은 기본 `RESTRICT`, ID는 int auto increment, timestamp는 `timestamptz`를 사용한다. 인덱스와 컬럼은 필요할 때만 추가한다.

## 2026-05-10: WordPress 호환 데이터 필드를 보존
- 근거 커밋: `efb598b` Add Prisma data model and dependencies, `dfde4ab` Add WordPress import tooling
- 이유: 기존 WordPress.com 블로그의 permalink, WordPress ID, 카테고리/태그, 댓글, 작성자 데이터를 보존해야 이전 후 검증과 중복 import가 가능하다.
- 제약: `Post.wordpressId`, `Post.permalink`, `Category.wordpressId`, `Tag.wordpressId`, `Comment.wordpressId`, `MediaAsset.wordpressId`를 유지한다. 공개 게시글 URL은 날짜와 slug 기반 WordPress 형태를 따른다.
