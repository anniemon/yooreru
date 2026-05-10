# Done
[x] Blob에 이미지 업로드(resizing 필요)
[x] wordpress post 임포트 (카테고리별 7개씩 보이게 해야함)
[x] Post의 authorId migration: Post 테이블의 authorId가 전부 null로 들어가있음. WordPress.2026-05-05.xml 파일 import할 때 author를 식별해서 Author 테이블에 넣고, 그 아이디를 Post에 넣어줘야함.

# WIP
- fallback 샘플 데이터(Db 없을 때) 전체 제거
- 댓글 날짜 ui fix; 원본(https://yooreru.com/2025/10/11/%ec%95%84%ec%b9%a8%ec%97%94-%ec%82%ac%ea%b3%bc-%ec%a0%80%eb%85%81%ec%97%94-%ec%9e%90%eb%91%90/)과 폰트, 글자 크기, 색상은 같되 `2025.10.11 12:39 PM` 형식으로

# TODO
- database(neon?) 추가 & 연결
- resend 설정
- smoke test
- dns 설정
- deploy hook 설정
- wordpress 플랜 구독 취소
