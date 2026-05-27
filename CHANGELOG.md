# Changelog / 변경 이력

All notable changes to Museum Map will be documented in this file.
Museum Map의 주요 변경 사항이 이 파일에 기록됩니다.

---

## [1.6.1+ Ops] - 2026-05-22

### 📱 Mobile UX / 모바일 UX
- 모바일에서 닫힌 박물관 상세 패널이 화면 밖에 남아 문서 폭을 2배로 만들던 문제 수정
- 프로덕션 모바일 390px viewport 기준 `scrollWidth=390`, 지도 캔버스 `390x732`, 가로 오버플로우 없음 확인
- 스플래시가 서버/클라이언트 첫 렌더에서 다르게 렌더링되던 hydration 원인을 제거
- 새 서비스워커 활성화 시 모바일 첫 로드를 강제 새로고침하던 동작 제거
- 스플래시 최소/최대 노출 시간을 줄여 첫 진입 대기감을 완화
- 지도 안의 미술관/박물관 상세에서 작품 상세로 이동한 뒤 뒤로가기 시 원래 상세 패널이 복원되도록 수정
- PC 지도 하단에 모바일 하단 네비 높이만큼 흰 여백이 남던 문제 수정
- `내 여행` 목록을 여행 날짜순이 아니라 최신 등록순으로 표시하도록 수정
- PC 지도에서 박물관/미술관 상세 패널 배경을 거의 투명하게 낮추고, 모바일 상세 시트는 기존 불투명 배경 유지
- PC 지도 상세 패널의 기존 구조를 복구하고 하단 padding만 축소
- PC 지도 상세 패널이 열릴 때 기존 700px 오른쪽 패널 구조를 유지한 채 오른쪽에서 왼쪽으로 슬라이드되도록 수정
- 박물관/미술관 상세 대표 이미지가 로드될 때 즉시 튀지 않고 디졸브로 나타나도록 수정

### 🖼️ Museum Thumbnails / 박물관 썸네일
- 지도 검색 결과, AI 추천 카드, 새로 추가된 박물관 목록의 썸네일을 공통 `getMuseumImageSrc()` fallback으로 통일

### 🚀 Deployments / 배포
- 프로덕션 배포: `dpl_BQyBsVzMDDzBT96CPJYvVZkw8C6p`
- 스플래시/hydration 수정 배포: `dpl_Ei6gS5cJT2graW8bpsHdys6D9Bqz`
- 작품 상세 뒤로가기 복원 배포: `dpl_H6jvC5zwimun63QQmuBKAx5yMsGb`
- PC 지도 하단 여백 수정 배포: `dpl_B3KuNisMVm82h8quxpMgJf9g2F6k`
- 내 여행 최신 등록순 정렬 배포: `dpl_AuVTAMLw2QnGPezrzov5QzRTuBb3`
- PC 상세 패널 투명도 조정 배포: `dpl_6Utg96iejJnUKudkdDVDkHBd66Zp`
- PC 상세 패널 구조 복구 및 하단 padding 축소 배포: `dpl_2MwmjRrdgPrnsdBCn21HMnWzCd2x`
- PC 상세 패널 슬라이드 및 이미지 디졸브 배포: `dpl_Cw9D6irpPSL6X8mMiwwzX7iUv3Sd`

---

## [1.6.1+ Ops] - 2026-05-15

### 🖼️ Museum Thumbnails / 박물관 썸네일
- 스토리 상세의 관련 박물관 칩이 `imageUrl`만 사용하던 문제 수정
- 관련 박물관 칩 썸네일을 `cachedPhotoUrls → imageUrl → placePhotos` 순서로 선택하도록 공통 이미지 로직 적용
- 브라우저에서 직접 렌더링되지 않는 Google Places 원본 URL을 대표 이미지로 갖고 있던 박물관 106개를 Supabase 캐시 이미지 URL로 보정
- 크리스탈 브릿지스 미술관 썸네일이 로고 fallback으로 뜨던 문제 해결

### 📱 Mobile UX / 모바일 UX
- 모바일 지도 컨테이너 높이가 0으로 계산되어 흰 화면처럼 보이던 문제에 인라인 높이 안전장치 추가
- 쿠키 동의 UI를 전체 화면 차단 모달에서 하단 non-blocking 배너로 변경
- 모바일 하단 네비게이션 active 상태의 `transform`/`scale` 효과를 제거해 선택 시 울렁임 완화
- 하단 네비게이션은 가로 `flex` 정렬을 유지하고 `basis-0 min-w-0`로 폭 재계산 흔들림을 줄임

### 🏛️ Museum Visibility / 박물관 노출
- `sourceAttribution.visibility`가 없는 기존 공개 박물관이 필터에서 누락되던 문제 수정
- 코펜하겐 컨템포러리 등 기존 공개 박물관이 API/지도에 다시 포함되도록 보정

### 🚀 Deployments / 배포
- 주요 프로덕션 배포: `dpl_9J6zP49BWdBoJndHf6CmswG3RyUa`, `dpl_BjxBT5gsvDYum6rfR4Nk1A16hfzo`, `dpl_4gMWkUzFKs5N9JKeufacaaAE2XSQ`

---

## [1.6.1+] - 2026-04-30

### 🏛️ Museum Data / 박물관 데이터
- 누락 우선순위 미술관 10곳 추가, 각 사진 최대 3장 Supabase Storage 캐시
- 전체 박물관 데이터에서 전화번호와 visitorInfo 중복 공식 웹사이트 항목 제거
- 상세 설명 내 Google Places 평점/리뷰 문장 제거

### 🌐 i18n / 다국어
- 날씨 팝업 UI와 WMO 날씨 상태 라벨 13개 언어 지원
- 관람 정보 라벨/안내 문구와 `요일 : 운영 시간` 운영시간 표시 다국어 보강

### 🗺️ Map UX / 지도 UX
- 클러스터가 보이는 즉시 클릭되도록 지도 클릭 지점 기반 fallback 추가

### ✍️ UX Writing · Typography / 문구·서체
- 한국어 UX Writing을 친절하고 친근한 톤으로 정리 (`내 픽`, `새로 추가된 곳`, `정보가 달라요`, `여행 준비 중` 등)
- 전역 서체를 `Pretendard` 우선의 다국어 고딕 Sans 스택(`Inter` + `Noto Sans KR/JP/SC/TC`)으로 정리
- 스토리 번역 캐시가 없는 경우에도 클라이언트 번역 fallback을 적용해 한국어 원문 노출 완화

---

## [1.5.1] - 2026-03-21

### 🌐 지도 다국어 레이블 (13개국 언어)
- **MapLibre + CARTO 타일** — OpenMapTiles `name:XX` 필드 활용
- `getLocalizedTextField()` + `applyMapLocale()` 함수 추가
- 초기 로드 / 다크모드 전환 / 언어 변경 시 자동 적용
- Fallback 체인: `name:XX` → `name_en` → `name`
- 지원 언어: ko, ja, de, fr, es, pt, zh-CN, zh-TW, da, fi, sv, et, en

### 🖼️ 작품 데이터 보강
- **v4 Batch** — Wikimedia Commons에서 11개 작품 추가 (모나리자, 별이 빛나는 밤, 진주 귀걸이를 한 소녀 등)
- **v5 Batch** — 9개 작품 추가 (일본/대만/한국 + 서구 주요 미술관)
- **비작품 4건 삭제** — DDP 야경, 돌하르방, 인천항, 도쿄역 마루노우치
- **미술관 매핑 수정** — 신라 금관→국립중앙박물관, 밀로의 비너스→루브르 파리
- 최종 작품 수: **903개**

### 🔧 Infrastructure
- 스토리 재작성 스크립트 Gemini 2.5-flash 전환
- 어드민 알림 마케팅 동의자 전용 토글

---

## [1.5.0] - 2026-03-19

### 📦 릴리스
- 디자인 시스템 개선 + 스토리 콘텐츠 + Maps 가격 업데이트
- 전체 페이지 `cachedPhotoUrls` 폴백 추가

---

## [1.4.1] - 2026-03-17

### 📖 MM 스토리 콘텐츠 보강
- **짧은 스토리 18개 전면 보강** — 33~106자 → 800~1,200자+ (베를린·로마·파리·뉴욕 등 도시별 여행 스토리)
- **관람정보 필수 포함** — 🎫 입장료 / 🕐 운영시간 / 📍 위치 / 🌐 팁 섹션 추가

### 🏛️ 박물관 칩 더보기 버튼
- **RelatedMuseums 컴포넌트** — 기본 2개 표시, 2개 초과 시 `+N개 더보기` 버튼 표시, 클릭 시 전체 펼치기/접기

### 🔀 거리순 정렬 개선
- **Blog 목록 API에 위도/경도 추가** — museum select에 `latitude`, `longitude` 포함으로 거리순 정렬 정상 동작

### 🔧 Infrastructure
- **Billing API 키 파싱 개선** — `GCP_SERVICE_ACCOUNT_KEY` / `GOOGLE_SERVICE_ACCOUNT_JSON` 두 환경변수 fallback 지원, private_key newline 이스케이프 처리 강화

---

## [1.4.0] - 2026-03-17

### ✈️ 여행 스토리 자동 컬렉션 연동

**EN:**
- **Auto-Collection from Travel Stories** — TRAVEL stories with 2+ museums auto-create a public shared collection on publish/update
- **"Go to Collection" button** — Purple gradient button on blog detail page navigates to linked collection (**TRAVEL category only**)
- **Auto-category for single museum** — TRAVEL + 1 museum → re-categorized as ART or MUSEUM
- **Bidirectional migration** — 277 collections created for existing stories, 18 stories created from existing collections

**KO:**
- **여행 스토리 자동 컬렉션 생성** — 여행(TRAVEL) 카테고리 + 박물관 2곳 이상 → 공개 컬렉션 자동 생성 및 연동
- **컬렉션으로 이동하기 버튼** — TRAVEL 카테고리 전용 퍼플 그라디언트 버튼
- **단일 박물관 자동 분류** — TRAVEL + 1곳: museum.type 기반 ART/MUSEUM 자동 재분류
- **양방향 마이그레이션** — 기존 스토리 277개 → 컬렉션, 기존 컬렉션 18개 → 스토리

### 🧹 컬렉션 정리
- 1개짜리 컬렉션 230개 삭제
- 컬렉션 제목 44개 도시 기반 리네이밍

### 🔀 스토리 정렬 필터
- 랜덤순(기본) / 최신순 / 오래된순 / 거리순(GPS)
- 전체/뮤지엄/여행/아트 모든 탭 적용

### 📖 컬렉션 관련 스토리
- 컬렉션 상세 하단에 관련 MM스토리 카드 표시

### ✨ UI 개선
- '새롭게 추가됐어요' 드롭다운 닫힘 애니메이션 — fadeOutDown 300ms
- 검색창 포커스 시 드롭다운 자동 닫힘

### 🗄️ DB 스키마
- `Story` 모델에 `collectionId` 필드 추가

### 🔧 Infrastructure
- **Vercel build fix** — `.next` symlink (iCloud `.nosync`) removed from git, was causing `ENOENT: mkdir .next`
- **Prisma shared instance** — Google reviews route migrated to use shared `@/lib/prisma`

---

## [1.3.3.4] - 2026-03-16

### 🐛 Critical Fixes / 긴급 버그 수정

**KO:**
- **API 500 에러 해결** — Prisma 필드명 `cachedPhotoUrls` 대소문자 불일치 수정
- **Vercel OOM 해결** — 빌드 시 TypeScript 타입체크 스킵 (`ignoreBuildErrors`) — Prisma generated client 메모리 초과 방지

---

## [1.3.3.3] - 2026-03-15

### 🏛️ Museum Data / 박물관 데이터

**KO:**
- **박물관 대규모 추가** — 총 3,394 → **3,748곳** (+354곳): 34곳 → 40곳 → 199곳 순차 추가
- **설명 리라이팅** — 3,272곳 설명 전면 개선, 카테고리 125곳 재정비
- **관람정보 다국어 번역** — 172곳 번역 완료, 중복 23곳 삭제, 위치 원본 3,449곳 복원
- **입장료 통일** — Free → 무료 52곳 일괄 수정
- **중복 방지 강화** — 좌표 1km 반경 중복 체크, `scan-museum-candidates.ts` 스크립트 추가

### ✍️ MM Story
- **카테고리 탭 기능** — 뮤지엄 / 여행 / 아트 3개 탭 (DB+API+어드민+탭UI 전체 구현)
- **랜덤 정렬** — Fisher-Yates shuffle (탭 진입 시마다)
- **썸네일 자동 적용** — 프리뷰 없을 때 연결 박물관 사진 자동 표시
- **스토리 19개 추가** — 현대미술관 중심

### 🌐 i18n
- **infoTable 라벨 번역 확장** — duration/budget/bestSeason/route 등 13개 언어

### 🎨 UI
- **PC 호버 줌 + 모바일 빠른 디졸브** 개선
- **스토리 상세 백버튼/관련 박물관 UI 통일**

---

## [1.3.3.2] - 2026-03-14

### 🏛️ Museum Data / 박물관 데이터

**KO:**
- **박물관 166곳 신규 등록** (3,394 → 3,560+)
- **위치(주소) 정보 보완** — 누락 주소 추가, `fix-location.ts` 스크립트 작성

### 🤖 AI

**KO:**
- **도시/cityKo 매칭 강화** — Gemini 프롬프트 개선, 한국어 도시명 검색 정확도 향상
- **Gemini `gemini-2.5-flash-lite` 전환**

### 📊 Info 페이지
- **동적 박물관/사진 수 실시간 표시** — DB 카운트 직접 연동
- **신규 박물관 캐시 무효화** — 박물관 수 변경 시 자동 초기화

---

## [1.3.3.1] - 2026-03-13

### 🔐 Infrastructure / 인프라

**KO:**
- **Consent gate 리라이팅** — 세션 토큰 기반 동의 게이트, API 호출 제거로 안정화
- **iCloud `.next` 심볼릭 링크 제거** — Vercel 빌드 실패 원인 제거
- **Vercel Node 20 고정 + `NODE_OPTIONS=--max-old-space-size=4096`** — OOM 빌드 안정화

### 💰 AdSense
- **Google AdSense 연동** — 검증 스크립트 + `ads.txt` 추가

### 🏛️ Content
- **현대미술관 20곳+ 신규 등록**

---

## [1.1.1] - 2026-03-02

### 🌐 Domain & Infrastructure / 도메인 및 인프라

**EN:**
- Custom domain launched: **museummap.app** (via Cloudflare DNS + Vercel)
- Upgraded Supabase to Pro plan for increased database connection limits
- Fixed critical database connection pool exhaustion caused by:
  - PrismaClient not being cached in production (serverless connection leak)
  - 3 API routes creating standalone PrismaClient instances
  - Sitemap querying 3,189 museums during every build
- All environment URLs updated from `global-museums.vercel.app` → `museummap.app`

**KO:**
- 커스텀 도메인 출시: **museummap.app** (Cloudflare DNS + Vercel 연동)
- Supabase Pro 플랜 업그레이드로 DB 연결 한도 증가
- 데이터베이스 연결 풀 소진 문제 근본 수정:
  - 프로덕션에서 PrismaClient 캐싱 누락 → 모든 환경에서 캐싱
  - 3개 API route에서 PrismaClient 직접 생성 → 글로벌 인스턴스 사용
  - 빌드 시 sitemap에서 3,189개 박물관 쿼리 → 제거
- 모든 URL을 `global-museums.vercel.app` → `museummap.app`으로 업데이트

---

### 🎨 UI/UX Improvements / UI/UX 개선

**EN:**
- Error pages (404, 500, global error) with construction-themed SVG icons, error codes, and retry/home buttons
- Default image logos scaled up 3x for better visibility
- Loading animation flicker fixed with smooth fade-in transition
- Skeleton UI opacity reduced to 60% for subtler loading states
- Empty state screens updated with logo SVG (Artworks, MM Story pages)
- Login page: background image zoomed in and positioned upward on mobile/tablet

**KO:**
- 에러 페이지(404, 500, 전역 에러) 추가: 공사 중 SVG 아이콘, 에러 코드, 다시 시도/홈 버튼
- 기본 이미지 로고 3배 확대로 가독성 향상
- 로딩 애니메이션 깜빡임 수정: fade-in 트랜지션으로 부드럽게 전환
- 스켈레톤 UI 투명도 60%로 조정하여 은은한 로딩 상태 표현
- 빈 화면(작품, MM스토리)에 로고 SVG 적용
- 로그인 페이지: 모바일/태블릿에서 배경 이미지 확대 및 상단 배치

---

### 📊 Analytics / 분석

**EN:**
- Google Analytics events added across all major user interactions:
  - Artwork views, blog post views, plan deletion
  - AI recommendation usage, museum filter, collection views
  - Navigation tracking via bottom nav

**KO:**
- Google Analytics 이벤트 전체 주요 사용자 행동에 추가:
  - 작품 조회, 블로그 포스트 조회, 여행계획 삭제
  - AI 추천 사용, 박물관 필터, 컬렉션 조회
  - 하단 네비게이션 추적

---

### 🔍 SEO & AEO / 검색 최적화

**EN:**
- Sitemap URL updated to `museummap.app`
- robots.txt sitemap reference corrected
- All LD+JSON structured data (WebSite, Organization) URLs updated
- metadataBase and SITE_URL updated across all page metadata
- Google Search Console connected

**KO:**
- 사이트맵 URL `museummap.app`으로 업데이트
- robots.txt 사이트맵 참조 수정
- 모든 LD+JSON 구조화 데이터(WebSite, Organization) URL 업데이트
- 모든 페이지 메타데이터의 metadataBase, SITE_URL 업데이트
- Google Search Console 연동 완료

---

### 🛡️ Reliability / 안정성

**EN:**
- Museum data fetch: 5 retries with exponential backoff + sessionStorage cache fallback
- If all retries fail, automatically retries every 10 seconds
- Registration API fixed to use cached Prisma instance

**KO:**
- 박물관 데이터 로딩: 5회 재시도(지수 백오프) + sessionStorage 캐시 폴백
- 모든 재시도 실패 시 10초마다 자동 재시도
- 회원가입 API 캐싱된 Prisma 인스턴스 사용으로 수정

---

### 🏛️ Data / 데이터
- Total museums: 3,189
- Database: Supabase PostgreSQL (Pro)
- Hosting: Vercel (Serverless)
- Domain: museummap.app (Cloudflare)
