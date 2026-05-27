# Global Contemporary Museums Map MVP - Architecture

> 마지막 업데이트: **2026-03-21**

## 아키텍처 원칙 (Architecture Principles)
1. **Next.js App Router**: `src/app` 폴더 기반의 서버/클라이언트 컴포넌트 혼합 (SEO + 빠른 초기 로딩).
2. **모듈 단위 결합도 완화 (Feature/Module-based)**:
   - 각 기능(Museum, Collection, Plan, Review)은 `src/components/{feature}` 또는 `src/lib/services/{feature}`로 분리.
3. **상태 관리**:
   - 로컬 UI 상태: React `useState`, 클라이언트 문맥 전달을 위한 `useContext` (전역 스토어 남용 방지).
   - 서버 상태: App Router의 Server Components 내 비동기 데이터 패칭 및 Next.js `fetch` 캐싱.
   - 복잡한 클라이언트 상태(지도 드래그, 핀 로딩 등): 전용 Hook (`useMapState`)으로 캡슐화.

## 폴더 구조 (Folder Structure)
```
/src
  /app                       # (Next.js 라우팅) 화면 및 API 진입점
    /(main)/page.tsx         # 메인 지도 화면 (Map, Search, Filter) -> / 루트 경로
    /museums/[id]/page.tsx   # 미술관 상세 (서버사이드 렌더링)
    /collections/            # 비공개/공개 컬렉션 관리 (생성 및 공유 뷰)
    /plans/                  # AutoRoute 및 플랜 보관
    /challenges/             # 월간 챌린지 뷰 (Opt-in)
    /admin/                  # 간단한 어드민 및 제보/검수 페이지
    /api/                    # 서버리스 API (Next.js Route Handlers)
      /museums               # 미술관 데이터 (위치 기반 쿼리 등)
      /collections           # 폴더/컬렉션 CRUD
      /plans                 # 동선(Plan) CRUD
      /reviews               # 3줄 리뷰 및 방문 로직

  /components                # (React 컴포넌트) App Router 밖에서 재사용되는 UI 컴포넌트
    /layout                  # 내비게이션 바, 사이드바, 하단 패널 등
    /map                     # MapLibre-gl 래퍼 및 마커 컴포넌트
    /museum                  # 미술관 카드, 리뷰 폼 등 도메인 종속 컴포넌트
    /ui                      # shadcn/ui 기반 공통 버튼, 인풋, 모달 UI (디자인 시스템)

  /lib                       # (유틸리티 및 서비스) 비즈니스 로직
    /prisma.ts               # Prisma 클라이언트 싱글톤
    /supabase.ts             # Supabase 클라이언트 (Storage 접근)
    /photo-proxy.ts          # 사진 URL 변환 (Supabase 캐시 우선)
    /services                # 각 도메인별 주요 로직 (예: DB 조작 추상화 계층)
    /utils.ts                # Tailwind 병합(cn) 등 순수 함수 유틸

/docs                        # (문서화) 아키텍처, 셋업, 흐름 정의
/prisma                      # (DB 스키마) schema.prisma (PostGIS 확장 포함)
```

## 데이터베이스 패턴 (Database Layer)
- **PostGIS**: `location Unsupported("geometry(Point, 4326)")` 필드를 이용하여 지도 중심 좌표로부터의 거리(Radius) 검색 등을 DB 단에서 신속히 처리.
- **ORM (Prisma)**: 관계형 데이터 매핑(`User` -> `Collection` -> `SavedMuseum` -> `Museum`). 
- **트랜잭션**: 플랜 생성, 폴더 저장 시 원자성을 보장하기 위해 Prisma Transaction 블록 사용.

## 인증 및 보안
- **NextAuth.js**: 소셜 로그인 또는 이메일 패스워드 없는 Magic Link 활용.
- **인가 (Authorization)**: 컬렉션/루트 등은 `userId`와 세션의 토큰값을 대조하여 미들웨어(`middleware.ts`)에서 보호.
- **RLS (Row Level Security)**: 모든 앱 테이블(26개)에 RLS 활성화 (2026-03-11).
  - Prisma는 `postgres` superuser로 연결 → RLS 자동 bypass, 앱 기능 영향 없음.
  - Supabase `anon`/`authenticated` 키를 통한 직접 DB 접근은 차단됨.
  - `spatial_ref_sys`는 PostGIS 시스템 테이블로 RLS 미적용 (변경 불가/불필요).

## 다국어 번역 시스템

> 📖 상세 문서: [translation-system.md](./translation-system.md)

- **13개 국어** 지원: `ko`, `en`, `ja`, `de`, `fr`, `es`, `pt`, `zh-CN`, `zh-TW`, `da`, `fi`, `sv`, `et`
- **DB 저장**: `titleKo`/`artistKo` + `titleTranslations` JSON (13국어)
- **Gemini 2.5 Flash** 배치 번역 → DB 영구 캐시
- **헬퍼 함수**: `getLocalizedMuseumName()`, `getLocalizedArtworkTitle()` 등

## Gemini AI 통합

### 모델: `gemini-2.5-flash`
- **추천 엔진** (`/api/recommend`): 사용자 검색 의도 파싱 + 박물관 추천 이유 생성
- **다국어 번역** (`src/lib/gemini-translate.ts`): 블로그 콘텐츠 실시간 번역
- **배치 번역 스크립트**: 작품/박물관명 13개 국어 일괄 번역

### API 키 관리
- 환경변수: `GEMINI_API_KEY`
- 모델 변경 이력: `gemini-2.0-flash-lite` → `gemini-2.5-flash` (2026-03-04)
- 토큰 사용량 추적: `TokenUsage` 테이블에 feature별 기록

## 작품 데이터 파이프라인 (Artwork Data Pipeline)

### Open Access API 소스
| API | 라이선스 | 용도 |
|-----|---------|------|
| Met Museum API | CC0 Public Domain | 하이라이트 회화/조각 |
| Art Institute of Chicago | CC0 | 부스트된 컬렉션 |
| Cleveland Museum of Art | CC0 | 공개 접근 회화 |
| Wikipedia Commons | CC-BY-SA / Public Domain | 박물관 이미지, 퍼블릭 도메인 명화 |

### 데이터 수집 스크립트
- `/tmp/fetch_open_access_artworks.js` — Met/AIC 자동 수집
- `/tmp/batch11_major_museums.js` — 주요 미술관 등록 + 대표작 큐레이션
- `/tmp/batch12_mass_artworks.js` — Cleveland/Rijks/Met/AIC 대량 수집
- `/tmp/translate_artworks_v2.js` — Gemini AI 13개 국어 배치 번역

### 로그
- `logs/translate_artworks.log` — 번역 작업 로그 (시간, 원문→번역 결과)

## Google Cloud Billing API
- **엔드포인트**: `/api/admin/billing`
- **인증**: GCP Service Account (`GCP_SERVICE_ACCOUNT_KEY` 환경변수)
- **역할**: Billing Account Viewer
- **데이터**: 결제 계정 정보, 프로젝트 결제 상태 (하루 지연)

## 블로그(Story) 시스템
- **모델**: `Blog` + `StoryMuseum` (미술관 연동) + `StoryArtwork` (작품 연동)
- **콘텐츠**: HTML 본문 (한/영), SEO description, infoTable (방문정보), artworks JSON
- **생성 스크립트**: `prisma/generate-blogs.js` (Gemini 2.5 Flash, 박물관 사진 활용)
- **총 100개** 블로그 게시글 (한/영 본문, 관람정보 테이블, 대표작품, 관련 미술관 연동)
- **관람정보**: visitorInfoI18n.ts — 라벨/값 번역 (하드코딩, 13개 언어)
- **운영시간**: Google Places API openingHours 저장 (2,672개)

## Supabase Storage 사진 캐시

### 개요
- **목적**: Google Places Photos API 비용 절감 (사용자 트래픽에서 API 호출 0)
- **스토리지**: Supabase Storage `museum-photos` 버킷 (Public, Pro 플랜 포함)
- **갱신 주기**: 월 1회 배치 (`scripts/cache_photos_to_storage.ts`)

### 데이터 흐름
```
[배치 - 월 1회]
  DB placePhotos (googleusercontent URL) → 다운로드 → Supabase Storage → DB cachedPhotoUrls

[사용자]
  photo-proxy.ts → cachedPhotoUrls 있으면 Supabase URL 직접 사용
                  → 없으면 /api/photos/place 프록시 폴백
```

### 환경변수
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY` — Storage 업로드용 (서버 전용)

### 비용
- 배치 다운로드: ₩0 (googleusercontent 무료)
- Supabase Storage: ₩0 (Pro 포함)
- 사용자 트래픽: ₩0 (Google API 호출 완전 제거)
