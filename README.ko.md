# Museum Map

[English](./README.en.md) | [기본 README](./README.md)

Museum Map은 전 세계 3,840+개 박물관과 미술관을 지도에서 탐색하고, AI 추천을 받고, 여행 동선을 계획할 수 있는 다국어 플랫폼입니다.

## 라이브 데모

Production: https://museummap.app

핵심 기능인 지도 탐색, 검색, 박물관 상세, MM Story, 작품 페이지는 로그인 없이 확인할 수 있습니다. 저장, 컬렉션, 리뷰, 여행 계획처럼 사용자별 데이터가 필요한 기능은 로그인이 필요합니다.

## 현재 현황

| 항목 | 내용 |
| --- | --- |
| 배포 URL | https://museummap.app |
| 공개 박물관/미술관 | 3,840+ |
| 박물관 사진 캐시 | 공개 박물관 100% 커버리지, placeholder fallback 포함 |
| 작품 | 900+ |
| MM Story | 120+ |
| 지원 언어 | 13개: KO, EN, JA, DE, FR, ES, PT, ZH-CN, ZH-TW, DA, FI, SV, ET |
| 앱 버전 | 1.6.1 |
| 공개 repo 형태 | 평가용 sanitized copy |

## 평가 방법

1. https://museummap.app 에 접속합니다.
2. 메인 지도에서 도시, 국가, 박물관 이름으로 검색합니다.
3. 박물관 상세 패널을 열어 사진, 관람 정보, 리뷰, 관련 스토리, 길찾기를 확인합니다.
4. AI 추천 영역에서 "서울 현대미술관 추천" 또는 "family-friendly museums in Paris" 같은 자연어 검색을 시도합니다.
5. MM Story와 작품 상세 페이지를 확인합니다.
6. 한국어, 영어, 일본어, 독일어, 프랑스어, 스페인어 등으로 언어 전환을 확인합니다.

## 테스트 계정

핵심 탐색 기능은 username/password 없이 확인할 수 있습니다.

Production 인증은 NextAuth와 Google OAuth 기반입니다. 해커톤 평가 과정에서 로그인 기능 확인이 필요하다면 전용 리뷰어 계정을 별도로 제공할 수 있습니다.

## 공개 안전성

이 repository는 private production repository에서 평가 가능한 내용만 분리한 공개용 복사본입니다.

포함된 내용:

- `src/` 앱 소스 코드
- `prisma/schema.prisma` 공개 가능한 DB 스키마
- `public/` 정적 자산
- `docs/` 디자인 시스템, 기능 정의, 아키텍처, API, 정책 문서
- `docs/public-development-log.md` 공개 가능한 개발/검증 로그 요약

제외된 내용:

- `.env`, `.env.local`, `.env.vercel`, Vercel project metadata
- Supabase, Google, Gemini, Serper, AWS, NextAuth, admin secret
- 생성된 Prisma client
- 로컬 build artifact, raw logs, scratch files, 일회성 DB backfill scripts
- 배포 전용 private operational notes

## 기술 스택

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, Radix UI, shadcn/ui-inspired components |
| Database | PostgreSQL, Supabase, Prisma ORM, PostGIS |
| Map | MapLibre GL |
| AI | Google Gemini API |
| Auth | NextAuth.js v4 |
| Storage | AWS S3 and Supabase Storage patterns |
| Hosting | Vercel |

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

DB까지 포함한 전체 실행에는 PostGIS가 활성화된 PostgreSQL/Supabase 환경변수가 필요합니다.

```bash
npx prisma generate
npm run build
```

Production DB와 private environment variables는 이 공개 repo에 포함되어 있지 않습니다.

## AI 활용

Claude Code와 Codex를 사용해 프론트엔드 구현, 데이터 품질 도구, production debugging, 문서화를 반복적으로 개선했습니다.

## 문서

- [한글 문서](./docs/ko/README.md)
- [영문 문서](./docs/en/README.md)
- [전체 공개 문서 인덱스](./docs/README.md)
