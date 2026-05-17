<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 프로젝트에 관하여
- `yooreru.com`을 위한 Next.js 블로그
- 내장 어드민

## Stack
- Next.js 16 + TypeScript
- Prisma 7 + Postgres 17, intended for Neon
- Resend for subscription/admin email
- Vercel Blob-ready media model

## 실행
- npm run dev, npm run start

## 참조 문서
- 프로젝트 배경 설명: [README.md](README.md)
- DB 관련 제약 사항: [CONSTRAINTS.md](prisma/CONSTRAINTS.md)
- 의사 결정 로그: [DECISIONS.md](DECISIONS.md)
- 아키텍처 문서: [ARCHITECTURE.md](ARCHITECTURE.md)

# Agent 루틴

## 세션 시작 시(출근)
1. PROGRESS.md를 읽어 현재 상태 파악
2. DECISIONS.md를 읽어 중요 결정 파악
3. PROGRESS.md의 "다음 단계" 섹션 이어서 진행

## 세션 종료 시(퇴근)
1. PROGRESS.md 업데이트
2. 기술적인 의사 결정 사항이 있다면 DECISIONS.md에 업데이트
3. 완료된 모든 작업 커밋
