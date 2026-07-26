# 프로젝트 진행 상황

## 현재 상태
- 최신 커밋: Add visual editor link previews
- 테스트 상태: `npm run lint`, `npm run build` 통과
- 린트/빌드: 통과

## 완료된 항목
- [x] ARCHITECTURE.md에 현재 코드베이스 아키텍처 정리
- [x] DECISIONS.md에 커밋 날짜 기반 주요 설계 결정 정리
- [x] Blob에 이미지 업로드(resizing 필요)
- [x] wordpress post 임포트 (카테고리별 7개씩 보이게 해야함)
- [x] Post의 authorId migration: Post 테이블의 authorId가 전부 null로 들어가있음. WordPress.2026-05-05.xml 파일 import할 때 author를 식별해서 Author 테이블에 넣고, 그 아이디를 Post에 넣어줘야함.
- [x] fallback 샘플 데이터(Db 없을 때) 전체 제거
- [x] 댓글 날짜 ui fix; 원본(https://yooreru.com/2025/10/11/%ec%95%84%ec%b9%a8%ec%97%94-%ec%82%ac%ea%b3%bc-%ec%a0%80%eb%85%81%ec%97%94-%ec%9e%90%eb%91%90/)과 폰트, 글자 크기, 색상은 같되 `2025.10.11 12:39 PM` 형식으로
- [x] 댓글에 `<!-- wp:paragraph --> <p>도화살 + 역마살 = 정예인</p> <!-- /wp:paragraph -->`이런 식으로 나오는 레코드가 있음. 찾아서 수정 필요.
- [x] admin에서 새 글 작성하면 첫 줄만 화면 맨 왼쪽으로 치우쳐 있음. 둘째줄부터는 정상적인 위치에 나옴.
- [x] admin에서 새 글 작성 시 이미지 업로드 후에는 글 쓰고 엔터 치면 행간에 간격이 생김. 이미지 업로드 전 위치에서는 행간이 정상적임.
- [x] admin에서 새 글 작성 시 발행일 기본값 현재로 설정 필요, `발행 시 구독자에게 이메일 발송`도 디폴트 on으로 해야함
- [x] admin에서 새 글 작성 시 카테고리에 하위 카테고리만 나오게 해야함. `그네에게` 카테고리는 옵션에서 제거해야함.
- [x] 블로그 구독 시 `구독이 등록되었습니다.`가 submit누르면 바로 해당 ui에서 뜨고, 확인 누르면 사라지게 하기. 이미 구독한 유저면 '이미 구독 중입니다.'라고 메시지 띄우기
- [x] database(neon) 추가 & 연결
- [x] resend 설정
- [x] dns 설정
- [x] wordpress 플랜 구독 취소
- [x] smoke test
- [x] https://www.yooreru.com/category/diary/ 에서 하위 카테고리의 모든 글 저자 상관 없이 보이게 하기
- [x] 서비스 레이어 분리
- [x] 런타임 DB 접근을 서비스 레이어 경유로 정리
- [x] PR #3 리뷰 코멘트 중 유효한 항목 반영
- [x] main branch push 시 Vercel deploy hook을 호출하는 GitHub Actions workflow 추가
- [x] [어드민] 글 작성 시 font 바꿀 수 있도록 지원: Noto Serif KR, Noto Sans KR, Pretendard
- [x] [어드민] 글 작성 시 HTML을 직접 보고 편집할 수 있는 모드와 글자 크기 설정 추가
- [x] [어드민] 비주얼 모드에서 링크 미리보기 삽입 지원
- [x] 새 댓글 작성 시 글 작성자에게 이메일 알림 발송(작성자 본인의 댓글/대댓글 제외)
- [x] [어드민] www/admin 접근 시 canonical host로 redirect해 세션 도메인 혼선을 방지
- [x] [어드민] 글 작성 중 10분마다 초안 자동 임시 저장
- [x] [어드민] 운영 canonical host와 반대 방향으로 redirect되어 발생한 `ERR_TOO_MANY_REDIRECTS` 수정

## 진행 중
- 없음

## 알려진 이슈
- 로딩 인디케이터 없음
- 전반적인 응답 지연 문제

## 다음 단계
- 새로운 구독자 등록 시 어드민 이메일로 이메일 전송하기
- [페이지네이션] 어드민 게시글 목록: `getAdminPostList`가 최근 50개만 고정 조회하고 pagination UI/API가 없음
- [페이지네이션] 어드민 댓글 목록: `getAdminComments`가 최근 100개만 고정 조회하고 pagination UI/API가 없음
- [페이지네이션] 공개 검색 결과: `searchPosts`가 전체 공개 글을 메모리 필터링하고 결과 pagination이 없음
- [페이지네이션] 태그 아카이브: `getPostsByTag`가 전체 공개 글을 메모리 필터링하고 pagination이 없음
- [페이지네이션] 월별 아카이브: `getPostsByMonth`가 전체 공개 글을 메모리 필터링하고 pagination이 없음
- [배치 처리] 발행 알림 구독자 조회: `notifySubscribersForPost`가 모든 ACTIVE 구독자를 한 번에 조회/처리하므로 cursor 기반 batch 처리가 필요
- [어드민] 모바일 반응형 지원
- 홈에서 요소 간격 조금씩 줄이고 달력 크기도 줄여서 전체 페이지가 스크롤 없이 렌더링되게 하기. 푸터 height도 조금 줄이기.
- [어드민]`그네에게`에 작성된 글 admin에서도 볼 수 있게 하기
- 카테고리로 포스트 상세 페이지 들어갔을 때에는 Previous/Next 누르면 카테고리 내에서만 이동, 달력에서 포스트 눌렀을 때엔 전체 글 시간순 목록에서 이동
