# 🎨 Museum Map — UI / 디자인 가이드

> 마지막 업데이트: **2026-04-28** — GPT image 생성 미술관 배경과 그라데이션 스플래시 정리

---

## 1. 핵심 철학

| 원칙 | 설명 |
|------|------|
| **Glassmorphism** | `backdrop-blur-xl` + 반투명 레이어로 지도 위에 떠 있는 느낌 |
| **가독성 최우선** | 블러 위 텍스트엔 반드시 충분한 대비 확보 |
| **명확한 CTA** | 주요 버튼은 불투명 보라색 (`purple-600`) + 그림자 |
| **다크모드 대응** | 모든 컴포넌트 `dark:` prefix 필수 |
| **통일된 라운딩** | 카드 `rounded-3xl`, 버튼 `rounded-2xl`, 칩 `rounded-full` |

---

## 2. 디자인 토큰 (`globals.css`)

### 브랜드 컬러

| 토큰 | Light | Dark |
|------|-------|------|
| `--mm-brand` | `#7C3AED` | `#A78BFA` |
| `--mm-brand-light` | `#A78BFA` | `#C4B5FD` |
| `--mm-brand-bg` | `#F5F3FF` | `rgba(124,58,237,0.1)` |
| `--mm-brand-glow` | `rgba(124,58,237,0.2)` | `rgba(167,139,250,0.15)` |

### 표면 (Surface)

| 토큰 | Light | Dark |
|------|-------|------|
| `--mm-surface` | `#FFFFFF` | `#171717` |
| `--mm-surface-secondary` | `#F9FAFB` | `#262626` |
| `--mm-surface-border` | `#F3F4F6` | `#262626` |

### 텍스트

| 토큰 | Light | Dark |
|------|-------|------|
| `--mm-text-primary` | `#111827` | `#F3F4F6` |
| `--mm-text-secondary` | `#6B7280` | `#9CA3AF` |
| `--mm-text-tertiary` | `#9CA3AF` | `#6B7280` |

### 타이포그래피

전체 UI 기본 서체는 `Pretendard` 우선의 다국어 고딕 계열 Sans 스택이다. 한글과 영문/유럽어는 `Pretendard`와 `Inter`, 일본어는 `Noto Sans JP`, 중국어는 `Noto Sans SC/TC`를 fallback으로 사용한다.

| 토큰 | 크기 | 용도 |
|------|------|------|
| `--mm-font-xs` | 11px | 캡션, 라벨 |
| `--mm-font-sm` | 13px (PC: 14px) | 본문 보조 |
| `--mm-font-base` | 15px (PC: 16px) | 본문 기본 |
| `--mm-font-lg` | 18px | 소제목 |
| `--mm-font-xl` | 24px | 섹션 제목 |
| `--mm-font-2xl` | 32px | 페이지 제목 |

> **PC Override (`min-width: 1024px`)**: `--mm-font-sm` → 14px, `--mm-font-base` → 16px

### 라운딩

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--mm-radius-sm` | 0.5rem | 체크박스, 작은 요소 |
| `--mm-radius-md` | 0.75rem | 버튼, 입력 |
| `--mm-radius-lg` | 1rem | 카드 내부 |
| `--mm-radius-xl` | 1.25rem | 카드, 패널 |
| `--mm-radius-2xl` | 1.5rem | 모달, 시트 |
| `--mm-radius-full` | 9999px | 칩, 아바타 |

### 그림자

| 토큰 | Light 기준 |
|------|-----------|
| `--mm-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--mm-shadow-md` | `0 4px 6px …` |
| `--mm-shadow-lg` | `0 10px 15px …` |

### 트랜지션

| 토큰 | 값 |
|------|-----|
| `--mm-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--mm-ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--mm-duration-fast` | 150ms |
| `--mm-duration-normal` | 200ms |
| `--mm-duration-slow` | 300ms |

---

## 3. Tailwind 컴포넌트 패턴

### 글래스 패널 (Glass Panel)

3단계 유틸리티 클래스 (`globals.css`):
```
.glass-panel  — blur(20px) saturate(180%), 표준 글래스 카드
.glass-nav    — blur(24px) saturate(200%), 네비게이션/모달 (더 불투명)
.glass-popup  — blur(20px), 92%/90% 불투명 (팝업/툴팁 가독성 최우선)
```

React 컴포넌트: `<GlassPanel intensity="heavy" gradient>` (`@/components/ui/glass`)
→ 바텀시트, 사이드 패널, 모달 배경

### 주요 버튼 (Primary CTA)
```
bg-purple-600 text-white font-bold rounded-xl shadow-lg
hover:bg-purple-700 active:scale-95 transition-all
```
→ 저장하기, 동선 만들기, 리뷰 작성

### 검색창 (Search Bar)
```
기본: border-2 border-gray-300 dark:border-neutral-600 rounded-2xl shadow-lg
포커스: border-purple-500 (transition-colors 300ms)
```
→ 모바일/태블릿/PC **동일** 스타일. AI 검색 폼은 `border-gray-200 → focus-within:border-purple-400`

### 카드 (Card)
```
bg-white dark:bg-neutral-900 p-6 rounded-3xl
border border-gray-100 dark:border-neutral-800 shadow-sm
hover: shadow-md hover:scale-[1.02] active:scale-[0.98]
```
→ 어드민 대시보드 요약, 미술관 카드

### 백버튼 (Floating Back Button)
```
fixed bottom-8 right-8 w-14 h-14
bg-neutral-800/90 dark:bg-white/90 rounded-full shadow-lg
```
→ 미술관 상세, 알림, 피드백 페이지

---

## 4. 애니메이션 시스템

### 글로벌 규칙
- 모든 `a`, `button`, `[role="button"]`에 `transition: all 0.2s ease` 적용
- 이미지 로드 시 자동 디졸브: `animation: imgDissolve 0.4s` (`.svg` 제외)

### 스플래시 화면

| 요소 | 규칙 |
|------|------|
| 배경 | GPT image로 생성한 세로형 미술관 아트리움 사진(`/splash-museum-bg.png`)을 풀스크린으로 사용. 사진 위에는 어두운 가독성 레이어와 블루/코랄 방향성 그라데이션만 얕게 적용 |
| 로고 | `/icon.svg` 사용. 큰 장식 카드가 아니라 58px 내외의 단정한 앱 아이콘으로 배치 |
| 서비스명 | `Museum`/`Map`을 큰 stacked display type으로 표시. 흰색 기반의 아주 옅은 블루/코랄 그라데이션 텍스트로 사진 위에서도 선명하게 유지 |
| 프로그레스바 | 4px 내외의 얇은 단일 가로 바 + 퍼센트. 화이트→블루→코랄 그라데이션 fill을 사용하고 로딩 라벨은 현재 언어 기준 |
| 프로그레스 모션 | 숫자와 바는 `requestAnimationFrame` easing을 사용하고, fill은 width 변경 대신 `transform: scaleX()`로 부드럽게 진행 |
| 제작자 | `Haerangsa`와 인스타그램 링크 유지. 제작자 라벨은 현재 언어 기준으로 표시 |
| 버전 | 하단 우측 칩 형태. 버전업 요청 전에는 값만 임의 변경하지 않음 |
| 접근성 | `role="status"`, `aria-live`, `role="progressbar"` 유지. ARIA label도 언어별로 제공. `prefers-reduced-motion`에서는 애니메이션 중단 |
| 첫 페인트 | React 로드 전 오버레이와 실제 스플래시가 겹쳐 깜빡이지 않도록 초기 표시 여부를 즉시 계산. 선로딩 오버레이도 같은 이미지 배경/그라데이션을 사용하고, React 스플래시 fade-out 시작 시 즉시 종료 처리 |

### 스켈레톤 UI

| 요소 | 규칙 |
|------|------|
| 모션 | shimmer는 45도 대각선으로 이동. 수평 이동보다 지도/카드 표면 위 빛이 스치는 느낌을 우선 |
| 색상 | 라이트 모드는 중성 표면 + 아주 약한 violet/cyan 하이라이트. 다크 모드는 흰색 16% 이하의 절제된 하이라이트 |
| 속도 | 약 1.9초 주기. 로딩이 길어져도 시각적으로 피로하지 않도록 부드러운 cubic-bezier 사용 |

### 어드민 GUI

| 요소 | 규칙 |
|------|------|
| 탭 | 관리자 메뉴는 `role="tablist"` 기반의 가로 스크롤 탭으로 구성. 모바일에서는 짧은 라벨을 사용해 줄바꿈과 넘침을 방지 |
| 모달 | 모바일에서는 하단 시트처럼 열리고, 데스크톱에서는 중앙 모달 유지. 오버레이 클릭으로 닫히되 내부 클릭은 전파 차단 |
| 폼 | 입력/셀렉트/텍스트영역은 토큰 기반 라운딩과 포커스 링을 사용하고 모바일에서는 라운딩을 낮춰 도구형 밀도 유지 |
| 중앙 버튼 | dimmed 메뉴가 열릴 때 floating center button은 `centerButtonLift` 모션으로 자연스럽게 상승 |

### 헤더와 상세 이미지

| 요소 | 규칙 |
|------|------|
| 상단 헤더 | 헤더는 전체 glass border 대신 clipped 1px gradient accent만 사용해 하단 라인이 이중으로 보이지 않게 유지 |
| 사진 전체보기 | 상세 페이지 lightbox/zoom overlay가 열려 있을 때는 body scroll과 horizontal back-swipe gesture를 차단 |
| 저장 페이지 버튼 | 저장/살펴보기 탭의 active 상태는 MM Story 카테고리 탭과 동일한 `gradient-btn` 스타일 사용 |
| 컬렉션 전환 버튼 | 공용 컬렉션/내 컬렉션 전환도 저장/살펴보기와 같은 `gradient-btn` active 상태와 중립 inactive 상태를 사용 |
| 스토리 번역 본문 | 일본어/중국어/독일어 등 긴 번역문은 `.mm-content`에서 viewport 밖으로 넘치지 않도록 `overflow-wrap:anywhere`와 안전한 line breaking을 유지 |
| 스토리 정보표 | 관람 정보표 셀은 모바일에서 긴 번역 문자열이 표 밖으로 밀리지 않도록 fixed table layout과 셀 단위 wrapping을 사용 |
| 컬렉션 스켈레톤 | 컬렉션 목록/상세 로딩은 외곽 카드에 `.skeleton-card`, 내부 텍스트·아바타·이미지 placeholder에 `.skeleton`을 사용해 shimmer 방향과 질감을 통일 |
| 프로필 팝업 | 데스크톱 프로필 메뉴는 header 내부 absolute가 아니라 body portal로 렌더링하고, 아바타 바로 아래에 `position: fixed`로 배치 |

### 박물관 상세

| 요소 | 규칙 |
|------|------|
| AI 요약 | `Museum.summary`가 있으면 히어로 사진 아래에 충분한 상단 여백을 두고 `AI 요약` 블록을 표시. 라이트모드는 버튼 그라데이션, 다크모드는 밝은 반전 카드 + 그라데이션 텍스트 사용 |
| AI 요약 데이터 | 운영 DB의 3,757개 박물관/미술관은 캐시된 DB 필드 기반의 한 줄 summary를 유지하며, 외부 API 호출 없이 백필 |
| 번역 로딩 | 요약문이 현재 언어로 번역 중일 때는 1-2줄 `.skeleton` shimmer를 표시해 레이아웃 흔들림을 줄임 |
| 사용처 | 저장/컬렉션/플랜/작품 카드처럼 실제 콘텐츠 구조가 곧 나타나는 영역에만 사용. 상태 표시용 LIVE/D-day 펄스와 구분 |

### 작품 표시

| 요소 | 규칙 |
|------|------|
| 작품명 | `getLocalizedArtworkTitle()`을 통해 `titleTranslations[locale]` → `titleKo/titleEn` → `title` 순서로 표시 |
| 작가명 | `getLocalizedArtistName()`을 통해 `artistTranslations[locale]` → `artistKo/artistEn` → `artist` 순서로 표시 |
| 검색 | 작품 목록 검색은 원문 제목/작가뿐 아니라 `titleTranslations`, `artistTranslations`, 미술관 `nameTranslations`까지 포함 |
| 정렬 | 작품 목록의 가나다/A-Z 정렬은 현재 locale 기준 표시 제목을 사용 |
| 데이터 품질 | Wikidata 수집 시 QID가 제목으로 노출되지 않도록 실제 언어 라벨이 있는 항목만 제목으로 사용 |

### 어드민 / 도구형 화면 밀도

| 요소 | 규칙 |
|------|------|
| 카드 반경 | 반복 카드와 데이터 패널은 `rounded-2xl` 이하를 기본값으로 사용 |
| KPI 카드 | 강한 전체 그라데이션보다 중립 표면 + 작은 색상 포인트 + 컬러 숫자를 우선 |
| 그라데이션 | 버튼/핵심 CTA와 브랜드 강조에 제한. 모바일 중앙 버튼 등 반복 요소는 CSS 토큰/클래스로 관리 |

### 지도 현재 위치 마커

| 요소 | 규칙 |
|------|------|
| 크기 | 미술관 원형 칩 반경 18px의 절반 수준인 9px ring + 4.5px dot |
| 색상 | 지도/마커 보라색과 충돌하지 않도록 blue 계열 사용. 라이트/다크 모두 흰색 또는 어두운 stroke로 분리 |
| 동작 | 현재 위치 버튼에서 GPS 획득 성공 시에만 표시. 위치 획득 실패 시 지도 상태를 변경하지 않음 |
| 레이어 | `user-location-ring`, `user-location-dot`를 별도 GeoJSON source로 관리해 미술관 클러스터 데이터와 분리 |

### 주요 애니메이션 클래스

| 클래스 | 동작 | 용도 |
|--------|------|------|
| `.animate-slideIn` | 오른쪽→왼쪽 350ms | 패널 진입 |
| `.animate-slideOutToRight` | 왼쪽→오른쪽 300ms | 패널 퇴장 |
| `.animate-slideUp` | 아래→위 300ms | 바텀시트, 선택시트 |
| `.animate-fadeIn` | 페이드인 200ms | 오버레이, 탭 전환 |
| `.animate-fadeInUp` | 위로올라오며 페이드인 400ms | 콘텐츠 등장 |
| `.animate-slideInDown` | 위에서 내려옴 350ms | 알림 리스트 |
| `.animate-slideOutUp` | 위로 사라짐 250ms | 알림 백 |
| `.animate-modalIn` | 스케일+위로 300ms | 모달 팝업 |
| `.animate-scaleSpring` | 스프링 바운스 500ms | 확장 배지 |
| `.animate-new-museum` | 보라색 아웃라인 펄스 2s 루프 | 신규 미술관 표시 |
| `.animate-fadeOutDown` | 아래로 사라짐 250ms | AI 추천 닫기 |
| `.animate-fadeOut` | 페이드아웃 200ms | 팝업/오버레이 퇴장 |
| `.animate-slideOutDown` | 아래로 슬라이드아웃 300ms | 바텀시트 퇴장 |
| `.stagger-children` | 순차 등장 (50ms 간격) | 리스트 아이템 |

### 페이지 전환

| 클래스 | 용도 |
|--------|------|
| `.page-slide-in` | 상세 페이지 진입 (오른쪽→왼쪽 280ms) |
| `.page-slide-in-back` | 백 네비게이션 (왼쪽에서 280ms) |
| `.page-slide-out` | 상세 페이지 퇴장 (오른쪽으로 200ms) |

### 로그인 페이지

| 효과 | 구현 |
|------|------|
| 페이지 디졸브 | `animate-[fadeIn_0.8s_ease]` |
| 배경 패닝 | `translateX(0 → -50%)` 50초 루프, width 200% |
| 선택 시트 | `.animate-slideUp` |
| 동의 슬라이드 | `translate-x-full → translate-x-0` 300ms spring |

---

## 5. 컴포넌트 상세

### 5-1. 지도 마커 시스템 (`MapLibreViewer.tsx`)

**마커 컬러**

| 상태 | Light | Dark |
|------|-------|------|
| 기본 | `#7C3AED` (purple-600) | `#C4B5FD` (purple-300) |
| 저장됨 | `#F97316` (orange-500) | `#FB923C` (orange-400) |

**카테고리별 SVG 맵 아이콘** (총 14종 — 각각 고유한 SVG path)

| 카테고리 Key | 한국어 | 아이콘 형태 |
|-------------|--------|-----------|
| `Contemporary Art` | 현대미술관 | ⭐ 추상 별 폭발 / 기하학 |
| `Modern Art` | 근대미술관 | 🎨 팔레트 + 붓 |
| `Fine Arts` | 미술관 | 🖌️ 페인트 브러시 |
| `Art Gallery` | 갤러리 | 🖼️ 프레임 속 그림 |
| `General Museum` | 종합 박물관 | 🏛️ 기둥이 있는 건물 |
| `Cultural Center` | 문화센터 | 🎭 극장 / 무대 |
| `History Museum` | 역사 박물관 | ✏️ 펜 / 깃펜 |
| `Natural History` | 자연사 박물관 | 🍃 잎사귀 |
| `Science Museum` | 과학관 | 🔬 현미경 |
| `Maritime Museum` | 해양 박물관 | 🐋 고래 |
| `Archaeological Museum` | 고고학 박물관 | 🔍 돋보기 |
| `Photography Museum` | 사진 박물관 | 📷 카메라 |
| `Design Museum` | 디자인 뮤지엄 | 🖥️ 모니터 |
| (기본값) | — | 📍 지도 핀 |

**클러스터**: 줌 아웃 시 인접 마커를 원형 숫자 배지로 그룹화. 클릭 시 확대.

---

### 5-2. SVG 아이콘 라이브러리 (`Icons.tsx`)

모든 아이콘은 `className`과 `size` prop을 받으며 기본값 `w-4 h-4`.

| 컴포넌트 | 이모지 | 용도 |
|---------|--------|------|
| `StarIcon` | ⭐ | 평점 별 |
| `SparkleIcon` | ✨ | 신규 배지 |
| `TicketIcon` | 🎫 | 입장권/전시 |
| `MapPinIcon` | 📍 | 위치 |
| `ClockIcon` | ⏱️ | 시간/소요시간 |
| `FrameIcon` | 🖼️ | 작품/이미지 |
| `MuseumIcon` | 🏛️ | 미술관/건물 |
| `TrophyIcon` | 🏆 | 순위/트로피 |
| `PencilIcon` | ✏️ | 편집 |
| `CameraIcon` | 📸 | 사진 촬영 |
| `ChatIcon` | 💬 | 댓글/리뷰 |
| `TrashIcon` | 🗑️ | 삭제 |
| `SearchIcon` | 🔍 | 검색 |
| `LinkIcon` | 🔗 | 링크 |
| `GlobeIcon` | 🌐 | 다국어/웹 |
| `PaletteIcon` | 🎨 | 미술/색상 |
| `PinIcon` | 📌 | 고정/핀 |
| `TrainIcon` | 🚇 | 지하철/교통 |
| `AirplaneIcon` | ✈️ | 항공/여행 |
| `DesktopIcon` | 🖥️ | 데스크탑 디바이스 |
| `MobileIcon` | 📱 | 모바일 디바이스 |
| `TabletIcon` | 📟 | 태블릿 디바이스 |
| `RefreshIcon` | 🔄 | 새로고침/재방문 |
| `MoneyIcon` | 💰 | 비용/유료 |
| `EmailIcon` | 📧 | 이메일 |
| `QuestionIcon` | ❓ | 도움말 |
| `GoogleIcon` | G | Google 어트리뷰션 |

**이모지→SVG 매핑** (`ICON_MAP`): 어드민에서 이모지를 입력하면 SVG로 자동 변환.

```ts
'🎫' → TicketIcon, '🕐' → ClockIcon, '📍' → MapPinIcon,
'🚇' → TrainIcon, '⏱️' → ClockIcon, '📌' → PinIcon,
'🌐' → GlobeIcon, '🎨' → PaletteIcon
```

---

### 5-3. 바텀시트 / 사이드패널

| | 모바일 | 데스크탑 |
|---|--------|---------|
| 형태 | 바텀시트 (하단 슬라이드) | 좌측 사이드패널 (700px) |
| 애니메이션 | `animate-slideUp` | `animate-slideIn` |
| 닫기 | 외부 클릭 / 스와이프 | 외부 클릭 / ESC |
| 배경 | `bg-white/95 backdrop-blur-xl` | 동일 |

### 5-4. 필터 드롭다운

카테고리 필터 칩 → 클릭 시 드롭다운 펼침.
```
비활성: bg-white/60 backdrop-blur-md border border-gray-200
활  성: bg-black/90 text-white shadow-md
```

### 5-5. 신규 미술관 배지 (`animate-new-museum`)

최근 3일 내 등록된 미술관에 보라색 아웃라인 펄스 적용 (2초 루프).
"새롭게 추가됐어요!" 버튼으로 확장 → 신규 미술관 리스트 표시.

### 5-6. 동의 슬라이드 패널 (로그인 페이지)

```
메인 화면 ← translate-x-full → 상세 패널
```
- 이용약관 / 개인정보처리방침 클릭 시 오른쪽에서 슬라이드 인
- 백버튼 → 메인 동의 화면으로 복귀
- "전체 보기" → `target="_blank"`로 `/settings` 새 탭
- 하단 "동의하기" 버튼 → 해당 항목 체크 + 메인 복귀

### 5-7. 알림 패널

```
진입: animate-slideInDown (위에서 350ms)
퇴장: animate-slideOutUp (위로 250ms)
```
스크롤 독립 — fixed 위치에 고정 유지.

### 5-8. 토스트 알림

성공/에러 시 화면 상단 중앙에 반투명 알림. 3초 후 자동 소멸.
```
bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl rounded-2xl shadow-lg
```

---

## 6. 반응형 규칙

| 화면 | Breakpoint | 패턴 |
|------|-----------|------|
| 모바일 | `< sm` | 바텀시트, 풀 너비 카드, `pb-24` (하단 네비) |
| 태블릿 | `sm ~ lg` | 사이드바, `pb-32` (하단 네비 간격) |
| 데스크탑 | `lg+` | 좌측 패널 (700px), `pb-8` |

### iOS Safari 대응
- 인풋 줌 방지: `font-size: 16px !important` (≤768px)
- 오버스크롤 방지: `overscroll-behavior: none`
- 스크롤바 숨김: `.scrollbar-hide`

---

## 7. 어드민 폼 시스템 (`globals.css`)

| 클래스 | 설명 |
|--------|------|
| `.admin-label` | 블록 라벨 (11px, uppercase, 트래킹) |
| `.admin-input` | 인풋 (2xl 라운딩, 포커스 시 보라색 링) |
| `.admin-textarea` | 텍스트에어리어 (min-height 100px) |
| `.admin-select` | 셀렉트 (기본 외형 제거) |
| `.admin-btn-primary` | 보라색 버튼 + 글로우 그림자 |
| `.admin-btn-secondary` | 흰색 버튼 + 보더 |
| `.admin-btn-danger` | 빨간색 버튼 |
| `.admin-btn-sm` | 작은 버튼 |
| `.admin-card` | 카드 (hover 시 shadow 확장) |

---

## 8. 보안 헤더

`next.config.ts`에서 전역 적용:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (클릭재킹 방지)
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

> CSP (Content-Security-Policy) 미적용 — 외부 이미지/폰트 의존도 높아 v1.3.0 예정.

---

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-02 | 초판 작성 |
| 2026-03-04 | 다크모드, 카테고리 아이콘, 반응형, 보안 헤더 추가 |
| 2026-03-10 | **전면 재작성** — 디자인 토큰, 애니메이션 시스템, 어드민 폼, 컴포넌트 패턴 정리 |
| 2026-03-13 | 종료 애니메이션 3종 추가 (fadeOutDown, fadeOut, slideOutDown), `.no-back-swipe` 클래스 |
| 2026-03-21 | 타이포 값 정정 (11/13/15px), 글래스모피즘 실제 CSS 클래스 반영, Gradient Palette 참조 추가 |
