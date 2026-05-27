# 🗺️ Museum Map — 서비스 기능 정의서

> **Museum Map**은 전 세계 현대미술관·박물관을 지도 기반으로 탐색하고, 여행 동선을 짜고, 방문 후 리뷰를 남기는 올인원 아트 여행 플랫폼입니다.
> 마지막 업데이트: **2026-05-27**

---

## 1. 핵심 기능 요약

| # | 기능 | 설명 |
|---|------|------|
| 1 | 🗺️ 지도 탐색 | 3,840+개 공개 미술관/박물관을 인터랙티브 지도에서 탐색 (13개 언어 지도 레이블, 현재 위치 원형 마커) |
| 2 | 🔍 검색 + AI 추천 | 한국어/영어/다국어 검색 + Gemini AI 자연어 추천 |
| 3 | 💾 저장 | 관심 미술관을 개인 폴더에 저장 (지도에서 주황색 마커로 표시) |
| 4 | 📍 여행 동선 | 저장한 미술관들의 최적 방문 동선(AutoRoute) 생성 |
| 5 | 📚 컬렉션 공유 | 방문 기록과 동선을 컬렉션으로 묶어 공유 |
| 6 | 📖 MM 스토리 | 미술관/작품 소개 콘텐츠 (블로그) 120편+ |
| 7 | 🎨 작품 DB | 900+개 작품 (CC0/PD Open Access API + Wikimedia Commons) |
| 8 | 🌐 다국어 (13개국어) | 한국어 기본 + 12개 언어 자동 번역 |
| 9 | 🔔 알림 시스템 | 공지사항, 버전 업데이트, 피드백 답변 알림 |
| 10 | 📷 사진 관리 | 미술관 사진 5장 관리 (드래그 정렬, 추가/삭제) |
| 11 | 🔐 보안 | CSP/XSS/클릭재킹 방지 보안 헤더 |
| 12 | 📋 관람정보 | 3,352개 미술관 입장료·운영시간·교통·관람시간 (13개 언어 번역) |
| 13 | 🕐 운영시간 | 2,672개 미술관 Google Places 운영시간 표시 |
| 14 | 🌐 SEO | 13개 언어 hreflang + Schema.org Museum/BlogPosting JSON-LD |
| 15 | 🍪 쿠키 동의 | GDPR 대응 13개 언어 쿠키 배너 + 개인정보처리방침 |
| 16 | ✈️ 여행 상태 UI | 대기(D-day/amber) vs 진행(LIVE/purple) 차별화 |
| 17 | ✨ 스플래시 | 모바일 첫 진입용 지도형 브랜드 인트로 (로고, 서비스명, 진행률, 제작자, 버전) |

---

## 2. 기획자 관점 (Product View)

### 2-1. 사용자 핵심 루프

```
탐색 → 저장 → 동선 생성 → 방문 → 리뷰 → 컬렉션 공유 → 재유입
```

| 단계 | 사용자 행동 | 결과 |
|------|-----------|------|
| **탐색** | 지도에서 미술관 핀 클릭 | 상세 정보 확인 |
| **저장** | "저장하기" 버튼 | 개인 폴더에 추가 |
| **동선** | "자동 동선 생성" | 최적 방문 순서 생성 |
| **공유** | 컬렉션 → Public → URL 복사 | 다른 사용자 유입 |

### 2-2. 지도 화면 구성

| 영역 | 기능 |
|------|------|
| 상단 | 검색창 + 필터 칩 (전체/미술관/박물관/갤러리) |
| 중앙 | MapLibre GL 지도 + 미술관 마커 (클러스터링, 카테고리별 아이콘, 별점순 팝업, 현재 위치 표시) |
| 하단 | 미술관 카드 슬라이더 + 저장/방문/리뷰 CTA |

### 2-3. 콘텐츠 전략

| 콘텐츠 | 등록 주체 | 노출 위치 |
|--------|----------|----------|
| 미술관 정보 | 시스템 (API 수집) | 지도, 검색, 상세 |
| MM 스토리 | 어드민 (한국어) | 블로그, 홈 피드 |
| 작품 정보 | 어드민/시스템 | 작품 상세, 미술관 상세 |
| 관람정보 | 시스템 (Gemini AI) | 미술관 상세, 스토리 |

### 2-4. 다국어 전략

- **기본 언어**: 한국어
- **등록 주체**: 어드민 (한국어 작성)
- **번역 규칙**: 고유명사는 각 언어의 공식 명칭 사용
- **번역 엔진**: Gemini 2.5 Flash
- **관람정보 라벨**: 하드코딩 번역 (visitorInfoI18n.ts, 13개 언어)
- **비용**: 전체 번역 시 약 5,000원 (1회성)

---

## 3. 개발자 관점 (Developer View)

### 3-1. 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 15.5.12 (App Router) |
| 언어 | TypeScript |
| DB | PostgreSQL (Supabase) + Prisma ORM |
| 지도 | MapLibre GL JS |
| 인증 | NextAuth.js (Google OAuth) |
| 스타일 | Tailwind CSS + Glassmorphism + CSS Custom Properties |
| 배포 | Vercel |
| AI 엔진 | Gemini 2.5 Flash (추천 + 번역 + 관람정보 생성) |
| 전시 검색 | Serper API (캐시 7일, 단계적 폐지 예정) |
| 작품 API | Met Museum, AIC, Cleveland (CC0) |
| 미술관 API | Google Places API (사진, 평점, 운영시간) |
| 로딩 | Lottie Animation |
| 보안 | CSP, X-XSS-Protection, X-Frame-Options |

### 3-2. DB 모델 핵심 구조

```
User ──┬── SavedMuseum ── Museum ── Artwork
       ├── Plan ── PlanMuseum ── Museum
       ├── Review ── Museum
       ├── Collection ── SavedMuseum
       └── Story ── StoryArtwork ── Artwork

Museum: name, nameKo, nameEn, descriptionKo, visitorInfo, openingHours, placePhotos
Artwork: title, titleKo, titleEn, artistKo, artistEn, descriptionKo
TranslationCache: entityType, entityId, field, locale, translated
Notification: title/titleEn, message/messageEn, type, isRead
```

### 3-3. API 구조

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/museums` | GET | 미술관 리스트 (필터, 검색, bbox) |
| `/api/museums/[id]` | GET | 미술관 상세 |
| `/api/artworks/[id]` | GET | 작품 상세 |
| `/api/collections/*` | CRUD | 컬렉션/저장 관리 |
| `/api/plans/*` | CRUD | 여행 동선 관리 |
| `/api/reviews` | CRUD | 리뷰 |
| `/api/blog/*` | CRUD | MM 스토리 |
| `/api/translations` | GET/DELETE | 다국어 번역 (Gemini) |
| `/api/translate` | POST | 실시간 UI 번역 |
| `/api/notifications` | GET | 알림 |
| `/api/admin/museums` | GET/PUT | 어드민 미술관 관리 (검색/수정/사진) |
| `/api/admin/artworks` | GET/PUT | 어드민 작품 관리 |
| `/api/admin/analytics` | GET | GA4 분석 데이터 |
| `/api/admin/billing` | GET | GCP 결제 정보 |

### 3-4. 페이지 라우팅

| 경로 | 컴포넌트 | 렌더링 |
|------|---------|--------|
| `/` | 메인 지도 | CSR (sessionStorage 캐시) |
| `/museums/[id]` | 미술관 상세 | SSR |
| `/artworks/[id]` | 작품 상세 | SSR (initialData) |
| `/blog/[id]` | 스토리 상세 | SSR |
| `/plans/new` | 동선 생성 | CSR |
| `/collections` | 컬렉션 목록 | CSR |
| `/saved` | 저장 목록 | CSR |
| `/notifications` | 알림 | CSR |
| `/notifications/[id]` | 알림 상세 | CSR |
| `/admin` | 어드민 (미술관/작품/분석) | CSR (인증 필수) |
| `/terms` | 이용약관 | SSR |

### 3-5. 번역 시스템 아키텍처

> 자세한 내용: [translation-system.md](./translation-system.md)

| 계층 | 역할 |
|------|------|
| DB 필드 (`nameKo`, `titleKo`) | 한국어/영어 직접 저장 |
| `nameTranslations` JSON | 13개 언어 번역 영구 저장 |
| TranslationCache 테이블 | 스토리/UI 동적 번역 캐시 |
| `gemini-translate.ts` | Gemini 2.5 Flash 배치 번역 |
| `visitorInfoI18n.ts` | 관람정보 라벨/값 하드코딩 번역 (13개 언어) |
| `/api/translations` | 캐시 조회 → Gemini 번역 → DB 저장 |
| `useTranslation` 훅 | 클라이언트 localStorage 캐시 |
| `useCachedTranslation` 훅 | DB 캐시 → Gemini 폴백 |

### 3-6. 성능 최적화

| 최적화 | 설명 |
|--------|------|
| SSR 작품 상세 | initialData로 클라이언트 로딩 튕김 방지 |
| sessionStorage 캐시 | 미술관 데이터 3,840+개 첫 로딩 후 캐시 (3일) |
| 번역 DB 캐시 | Gemini 호출 1회 → 이후 $0 |
| Lottie 로딩 | 첫 방문 시에만 로딩 오버레이 |
| Silent Fetching | 검색 시 로딩 스피너 없이 조용한 데이터 패칭 |

---

## 4. 문서 인덱스

| 문서 | 내용 |
|------|------|
| [architecture.md](./architecture.md) | 아키텍처 원칙, 폴더 구조, DB 패턴, AI 통합 |
| [data-pipeline.md](./data-pipeline.md) | 데이터 수집 파이프라인 + Open Access API |
| [setup.md](./setup.md) | 개발 환경 설정 + 환경변수 목록 |
| [design-system.md](./design-system.md) | 디자인 토큰, 컴포넌트 패턴, 애니메이션 |
| [ui-guide.md](./ui-guide.md) | Glassmorphism 디자인 원칙 |
| [user-flows.md](./user-flows.md) | 사용자 행동 흐름 |
| [translation-system.md](./translation-system.md) | 다국어 번역 시스템 상세 |
| [security-audit.md](./security-audit.md) | 보안 패치 보고서 |
| [changelog.md](./changelog.md) | 일별 변경 이력 |
| [version-log.md](./version-log.md) | 공식 버전 로그 (v1.0.0 ~ v1.6.1+) |
| [user-acquisition.md](./user-acquisition.md) | 유저 획득, SEO, 마케팅 전략 |
| [app-store-checklist.md](./app-store-checklist.md) | 앱 스토어 출시 체크리스트 |
| [user-management.md](./user-management.md) | 회원 관리 및 개인정보 처리 |
| [cost-optimization-policy.md](./cost-optimization-policy.md) | API 비용 최적화 정책 |
| [places-data-policy.md](./places-data-policy.md) | Google Places 데이터 정책 |

---

## 5. 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-03-02 | 다국어 번역 시스템 구축 (Gemini 2.5 Flash) |
| 2026-03-02 | Museum/Artwork 스키마에 한국어 필드 추가 |
| 2026-03-02 | 기능 정의서 초판 작성 |
| 2026-03-04 | 작품 413개 DB 구축 (Open Access API) |
| 2026-03-04 | AI 추천 검색 + 보안 헤더 + 사진 업로드 반영 |
| 2026-03-04 | Next.js 15.5.12 보안 업그레이드 |
| 2026-03-06 | 현대미술관 ~50곳 추가 (3,329→3,379), 관람정보/사진/운영시간 완비 |
| 2026-03-06 | 도시별 여행 컬렉션 9개 추가 |
| 2026-03-06 | 관람정보 번역 하드코딩 전환 (visitorInfoI18n) |
| 2026-03-06 | 클러스터 팝업 UI 개선 (별점순+별점표시) |
| 2026-03-06 | 카테고리 개수 리스트 UI 정리 (TOP3/별점 삭제) |
| 2026-03-06 | v1.2.2 버전 업데이트 + 스플래시 리디자인 |
| 2026-03-06 | VERSION_LOG.md 문서 생성 (v1.0.0~v1.2.2) |
| 2026-03-09 | Supabase Storage 사진 캐시 (3,148개 성공) |
| 2026-03-09 | hreflang 13개 언어 + Schema.org Museum JSON-LD |
| 2026-03-09 | 여행 대기/진행 UI 차별화 (D-day, LIVE 뱃지) |
| 2026-03-09 | 쿠키 동의 배너 (13개 언어 GDPR) |
| 2026-03-09 | v1.2.5~v1.2.6 배포 |
| 2026-03-11 | v1.3.2: 15개 미술관 추가, 다크모드 로고/약관 불릿/스플래시/맵 플래시 수정 |
| 2026-03-12 | 이름 수집 중단, UTM 공유 추적 8곳 적용, 로그인 NavHeader, 대시보드 사용자 표시 정리 |
| 2026-03-17 | Blog↔Collection 양방향 마이그레이션 (277 컬렉션 + 18 스토리), TRAVEL 전용 컬렉션 버튼, 드롭다운 닫힘 애니메이션 |
| 2026-03-19 | v1.5.0: 디자인 시스템 개선, 스토리 사진 자동 삽입, Maps 가격 업데이트 |
| 2026-03-21 | v1.5.1: 지도 다국어 레이블 13개 언어, 작품 903개 (Wikimedia v4/v5 + 비작품 정리), 어드민 마케팅 토글 |
| 2026-04-27 | 스플래시 지도형 리디자인, 디자인 토큰/어드민 카드 밀도 정리, 스켈레톤 45도 shimmer 통일, 현재 위치 원형 마커, 클러스터 초기 클릭 수정, MM Story 관람 정보표 121개 DB 보강, SEO/GEO 구조화 데이터 강화, 관리자 API 권한 강화 |
| 2026-05-22 | 모바일 지도 overflow/white-screen, splash hydration, 상세 패널 복귀, 데스크톱 패널 레이아웃/모션, 사진 캐시/썸네일 fallback, visibility filter, AI/API 보안·비용 hardening 배포 검증 |
