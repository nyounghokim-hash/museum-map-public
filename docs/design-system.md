# DESIGN.md — Museum Map

> AI 에이전트가 읽고 실행할 수 있는 디자인 시스템 문서 (Stitch 표준 규격 기반)
> 모든 토큰은 `src/app/globals.css`에 정의되어 있음
>
> 마지막 업데이트: **2026-04-27**

---

## 1. 시각적 테마 및 분위기 (Visual Theme & Atmosphere)

| 항목 | 설명 |
|------|------|
| **밀도** | 중간~높음. 모바일 우선, 컴팩트한 카드 배치. 여백으로 시선의 쉼을 부여 |
| **무드** | 세련된 문화적 탐험. 보라색 그라데이션의 우아함 + 오렌지 포인트의 활력 |
| **철학** | "글라스모피즘으로 지도 위에 떠있는 느낌". 반투명 패널과 블러가 지도 콘텐츠와 UI의 경계를 자연스럽게 연결 |
| **다크 모드** | 기본 지원. 모든 토큰에 라이트/다크 쌍 존재. 다크 모드에서 보라색은 더 밝게 (lavender), 표면은 중성 그레이 |
| **브랜드 정체성** | Purple(보라) = 문화/예술/프리미엄, Orange(주황) = 저장/개인화/활력. 두 색의 조합이 핵심 |

### 앱 진입 스플래시

| 항목 | 지침 |
|------|------|
| **컨셉** | "지도 위에서 시작되는 미술관 여행". 다크 맵 그리드와 위치 핀을 사용해 서비스 성격을 즉시 전달 |
| **구성** | 로고, 서비스명, 짧은 다국어 서브카피, 프로그레스바, 제작자 인스타그램 링크, 버전 칩 |
| **다국어** | 서브카피, kicker, 로딩 문구, 제작자 라벨, 접근성 라벨은 현재 언어 기준으로 표시 |
| **색상** | 배경은 `#0b0d12`, 강조는 purple `#8b5cf6` / orange `#fb923c` |
| **라운딩** | 로고 컨테이너 28px, 제작자/버전 칩 full radius |
| **모션** | 지도 그리드 drift, 핀 pulse, 서브카피 fade-in. React 로드 전 오버레이와 자연스럽게 이어지며 reduced-motion에서는 중단 |
| **주의** | 버전 번호는 명시적 버전업 작업 없이는 변경하지 않음 |

### 스켈레톤 로딩

| 항목 | 지침 |
|------|------|
| **베이스** | 라이트: 중성 백색 표면, 다크: 낮은 불투명도의 흰색 표면 |
| **하이라이트** | 보라/주황을 강하게 쓰지 않고 violet + cyan 계열을 10% 이하로 섞어 현대적인 금속성 빛 느낌 |
| **방향** | 45도 대각선 이동. 카드/이미지/텍스트 모두 같은 shimmer 규칙 사용 |
| **속도** | 1.9초 내외, `cubic-bezier(0.4,0,0.2,1)` |
| **사용 범위** | 로딩 placeholder는 `.skeleton`으로 통일. `animate-pulse`는 LIVE/D-day 같은 상태 신호에만 제한 |

### 어드민 / 도구형 화면

| 항목 | 지침 |
|------|------|
| **라운딩** | 반복 카드와 데이터 패널은 `rounded-2xl` 이하를 기본값으로 사용 |
| **KPI 카드** | 강한 전체 그라데이션 배경 대신 중립 표면 + 작은 semantic accent + 컬러 숫자 조합 |
| **그라데이션** | CTA와 브랜드 강조에 제한. 반복 UI의 그라데이션은 CSS token/class로 관리 |

### 디자인 원칙
1. **지도 중심**: 지도가 주인공. UI 요소는 지도 위에 떠있는 글라스 패널
2. **발견의 즐거움**: 클러스터 펄스 애니메이션, 셔플 기능, 스프링 바운스로 탐험 경험 강화
3. **다국어 우선**: 6개 언어(KO, EN, JA, DE, FR, ES) 지원. 텍스트 길이 변동에 유연한 레이아웃
4. **모바일 퍼스트**: 바텀 시트, 스와이프 제스처, 바텀 네비게이션이 주요 인터랙션

---

## 2. 색상 팔레트 및 역할 (Color Palette & Roles)

### 브랜드 색상

| 토큰 | Light | Dark | 역할 |
|------|-------|------|------|
| `--mm-brand` | `#7C3AED` (purple-600) | `#A78BFA` (purple-400) | 주요 버튼, 링크, 활성 상태 |
| `--mm-brand-light` | `#A78BFA` | `#C4B5FD` | 호버 상태, 보조 강조 |
| `--mm-brand-bg` | `#F5F3FF` | `rgba(124,58,237,0.1)` | 태그 배경, 하이라이트 영역 |
| `--mm-brand-glow` | `rgba(124,58,237,0.2)` | `rgba(167,139,250,0.15)` | 버튼 그림자, 포커스 링 |

### 표면 색상

| 토큰 | Light | Dark | 역할 |
|------|-------|------|------|
| `--mm-surface` | `#FFFFFF` | `#171717` | 카드, 패널 배경 |
| `--mm-surface-secondary` | `#F9FAFB` | `#262626` | 페이지 배경, 빈 상태 |
| `--mm-surface-border` | `#F3F4F6` | `#262626` | 카드 테두리, 구분선 |

### 텍스트 색상

| 토큰 | Light | Dark | 역할 | 접근성 |
|------|-------|------|------|--------|
| `--mm-text-primary` | `#111827` | `#F3F4F6` | 제목, 본문 | WCAG AAA |
| `--mm-text-secondary` | `#6B7280` | `#9CA3AF` | 캡션, 메타데이터 | WCAG AA |
| `--mm-text-tertiary` | `#6B7280` (AA 5.0:1) | `#9CA3AF` (AA 5.9:1) | 플레이스홀더, 레이블 | WCAG AA |

### 의미론적 색상 (Semantic Colors)

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--mm-danger` | `#EF4444` | `#F87171` | 삭제 버튼, 오류 상태 |
| `--mm-danger-hover` | `#DC2626` | `#EF4444` | 위험 버튼 호버 |
| `--mm-danger-bg` | `rgba(239,68,68,0.1)` | `rgba(248,113,113,0.1)` | 위험 아이콘 호버 배경 |
| `--mm-success` | `#22C55E` | `#4ADE80` | 활성, 인증 상태 |
| `--mm-success-bg` | `rgba(34,197,94,0.1)` | `rgba(74,222,128,0.1)` | 성공 배지 배경 |
| `--mm-warning` | `#F59E0B` | `#FBBF24` | 대기 상태 |
| `--mm-warning-bg` | `rgba(245,158,11,0.1)` | `rgba(251,191,36,0.1)` | 경고 배지 배경 |
| `--mm-info` | `= --mm-brand` | `= --mm-brand` | 정보, 브랜드 강조 |

### 그라데이션 팔레트 (Purple x Orange)

| 토큰 | Light | Dark |
|------|-------|------|
| `--gradient-purple` | `135deg, #7C3AED -> #A78BFA` | `135deg, #A78BFA -> #C4B5FD` |
| `--gradient-orange` | `135deg, #F97316 -> #FB923C` | `135deg, #FB923C -> #FDBA74` |
| `--gradient-purple-orange` | `#6D28D9 -> #8B5CF6 -> #F97316` | `#8B5CF6 -> #A855F7 -> #FB923C` |
| `--gradient-purple-orange-soft` | 미묘한 보라-오렌지 배경 | 미묘한 보라-오렌지 배경 |
| `--gradient-border` | 50%/30% 불투명도 테두리 | 더 밝은 테두리 |
| `--gradient-glow` | 박스 섀도 글로우 | 더 밝은 글로우 |

---

## 3. 타이포그래피 규칙 (Typography Rules)

### 서체

| 용도 | 서체 |
|------|------|
| 전체 UI | **Pretendard** + **Inter** + **Noto Sans KR/JP/SC/TC** (`--font-mm-sans`) |
| 코드, 수치 | **Geist Mono** (`--font-geist-mono`) |

앱 전체는 `Pretendard` 우선의 다국어 고딕 계열 Sans 스택을 기본으로 사용한다. 한글과 영문/유럽어는 `Pretendard`와 `Inter`, 일본어는 `Noto Sans JP`, 중국어는 `Noto Sans SC/TC`를 fallback으로 둔다.

### 타이포그래피 스케일 (Mobile-first, PC 1024px+에서 오버라이드)

| 토큰 | Mobile | PC (1024px+) | 용도 |
|------|--------|-------------|------|
| `--mm-font-xs` | **11px** (0.6875rem) | - | 마이크로 레이블, `tracking-widest` |
| `--mm-font-sm` | **13px** (0.8125rem) | **14px** (0.875rem) | 캡션, 메타데이터 |
| `--mm-font-base` | **15px** (0.9375rem) | **16px** (1rem) | 본문 텍스트 |
| `--mm-font-lg` | **18px** (1.125rem) | - | 소제목 |
| `--mm-font-xl` | **24px** (1.5rem) | - | 섹션 제목 |
| `--mm-font-2xl` | **32px** (2rem) | - | 페이지 타이틀 |

### 폰트 두께

| 두께 | Tailwind 클래스 | 용도 |
|------|-----------------|------|
| 500 | `font-medium` | 일반 강조 |
| 700 | `font-bold` | 카드 제목, 버튼 |
| 800 | `font-extrabold` | 섹션 제목 |
| 900 | `font-black` | 페이지 타이틀, 브랜드 네임 |

### 본문 콘텐츠

- 모바일: `line-height: 1.85`
- PC: `line-height: 1.7`
- 최대 줄 길이: `max-w-prose` (65ch)

---

## 4. 컴포넌트 스타일링 (Component Stylings)

### 카드 (`.mm-card`)
```
배경: var(--mm-surface)
테두리: 1px solid var(--mm-surface-border)
둥글기: var(--mm-radius-2xl) (24px)
호버: shadow-lg + translateY(-2px)
활성: scale(0.98)
```

### 칩 (`.mm-chip`)
```
둥글기: var(--mm-radius-full) (9999px)
글꼴: var(--mm-font-xs) (11px), font-weight: 700
변형:
  --brand: 보라색 배경/텍스트
  --muted: 회색 배경/텍스트
```

### 버튼
- **그라데이션 버튼** (`.gradient-btn`): Purple->Orange 배경, 호버 시 글로우 + 살짝 떠오름
- **FAB** (`.mm-fab`): 3.5rem 원형, `blur(12px)`, `shadow-lg`
- **일반 버튼**: `rounded-xl`, `px-4 py-2`, `font-bold text-sm`

### 드롭다운 / 셀렉트
```
패딩: px-3 py-1.5
둥글기: rounded-xl
글꼴: text-xs font-semibold
테두리: border border-gray-200 dark:border-neutral-700
배경: bg-white dark:bg-neutral-800
그림자: shadow-sm
포커스: ring-2 ring-purple-300
```

### 인풋 / 검색
```
패딩: pl-9 pr-9 py-3
둥글기: rounded-2xl
배경: var(--glass-bg) with backdrop-blur
테두리: 1px solid var(--glass-border)
그림자: var(--glass-shadow)
포커스: ring-2 ring-purple-500/50
```

### 스켈레톤 로딩
```
클래스: .skeleton / .skeleton-text / .skeleton-title / .skeleton-circle / .skeleton-card
효과: 45도 대각선 시머 애니메이션 (약 1.9s 반복)
다크 모드: 낮은 대비 표면 + 미묘한 violet/cyan 하이라이트
```

### 테이블 (`.mm-info-table`)
```
줄무늬 행 배경
첫 번째 열: 볼드 레이블 (30% 너비)
두 번째 열: 값
```

---

## 5. 레이아웃 및 간격 (Layout & Spacing)

### 간격 시스템 (8px 기반)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--mm-space-xs` | 4px (0.25rem) | 아이콘 간격, 인라인 요소 |
| `--mm-space-sm` | 8px (0.5rem) | 컴팩트 패딩, 칩 내부 |
| `--mm-space-md` | 16px (1rem) | 기본 패딩, 카드 내부 |
| `--mm-space-lg` | 24px (1.5rem) | 섹션 간 간격 |
| `--mm-space-xl` | 32px (2rem) | 큰 섹션 간격 |
| `--mm-space-2xl` | 48px (3rem) | 페이지 레벨 간격 |

### 여백 철학
- **카드 내부**: `p-4` ~ `p-6` (16px ~ 24px)
- **카드 간 갭**: `gap-3` ~ `gap-5` (12px ~ 20px)
- **섹션 간격**: `mb-6` ~ `mb-8` (24px ~ 32px)
- **페이지 패딩**: `px-4 py-4` (모바일) / `px-8 py-8` (PC)
- **바텀 안전 영역**: `pb-32` (모바일 네비게이션 바) / `pb-8` (PC)

### 그리드 시스템
- **갤러리**: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`
- **리스트**: 단일 열, `max-w-[1080px]`
- **지도 레이아웃**: 전체 화면 지도 + 사이드 패널 (PC: 700px)

---

## 6. 깊이 및 고도 (Depth & Elevation)

### 그림자 체계

| 토큰 | Light | Dark | 사용 레벨 |
|------|-------|------|----------|
| `--mm-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` | 칩, 배지, 인풋 |
| `--mm-shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | `0 4px 6px -1px rgba(0,0,0,0.4)` | 카드, 드롭다운 |
| `--mm-shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | `0 10px 15px -3px rgba(0,0,0,0.5)` | 모달, 팝업, 호버 카드 |
| `--glass-shadow` | 보라색 틴트 + 이너 하이라이트 | 보라색 틴트 강화 | 글라스 패널 |
| `--glass-shadow-lg` | 더 큰 보라색 글로우 | 더 큰 보라색 글로우 | 바텀 시트, 모달 |

### Z-index 레이어

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--mm-z-dropdown` | `10` | 드롭다운, 툴팁 |
| `--mm-z-sticky` | `20` | 스티키 헤더, FAB |
| `--mm-z-nav` | `30` | 네비게이션 바 |
| `--mm-z-overlay` | `50` | 백드롭 오버레이 |
| `--mm-z-modal` | `100` | 모달, 어드민 모달 |
| `--mm-z-toast` | `200` | 토스트 알림 |

### 글라스모피즘 체계

| 클래스 | 블러 | 용도 |
|--------|------|------|
| `.glass-panel` | `blur(20px) saturate(180%)` | 표준 글라스 카드 |
| `.glass-nav` | `blur(24px) saturate(200%)` | 네비게이션 바 (더 진한 글라스) |
| `.glass-popup` | `blur(20px) saturate(180%)` | 팝업/툴팁 (92% 불투명 — 가독성 확보) |

---

## 7. 권장 및 금지 사항 (Do's and Don'ts)

### DO (권장)

- 카드 호버 시 `shadow-lg + translateY(-2px)` 조합으로 떠오르는 느낌 부여
- 다크 모드에서 표면 구분은 `#171717` / `#262626` 두 단계로 간결하게
- 보라색 그라데이션은 주요 CTA에만. 보조 액션은 단색 보라색 사용
- 아이콘은 `currentColor` 사용하여 텍스트 색상 자동 상속
- 리스트 아이템에 `active:scale-95` / `active:scale-[0.98]` 으로 터치 피드백
- 스프링 이징 (`--mm-ease-spring`) 으로 모달, 슬라이드 인 등 자연스러운 움직임
- 숫자, ID, 타임스탬프에는 **Geist Mono** 사용
- `appearance-none` 제거 후 기본 셀렉트 스타일 사용 (네이티브 드롭다운 UX 유지)
- 모든 버튼에 `rounded-xl` 통일 (`rounded-lg` 금지). 카드는 `rounded-2xl`
- 모든 인터랙티브 요소에 `focus:outline-none focus:ring-2 focus:ring-purple-500` 포커스 링 추가
- 아이콘 전용 버튼에 반드시 `aria-label` 속성 추가

### DON'T (금지)

- 인라인 스타일로 색상 하드코딩 금지. 반드시 CSS 토큰 사용
- 카드 간 구분에 두꺼운 `border` 사용 금지. `shadow-sm` 또는 배경색 차이로 구분
- 오렌지 색상을 기본 액션에 사용 금지. 오렌지는 저장/개인화 전용
- `z-index` 임의 값 사용 금지. 반드시 `--mm-z-*` 토큰 사용
- 텍스트에 `opacity`로 대비 조절 금지. 전용 텍스트 토큰 사용 (접근성)
- 글라스모피즘을 텍스트가 많은 영역에 과도하게 사용 금지 (가독성 저하)
- 데스크톱 레이아웃에서 모바일 바텀 네비게이션 표시 금지
- 애니메이션 `duration` 300ms 초과 금지 (UX 지연감 발생)
- 버튼에 `rounded-lg` 사용 금지. 반드시 `rounded-xl` 사용
- `<div onClick>` 대신 `<button>` 사용 (키보드 접근성)
- 아이콘 전용 버튼에 `aria-label` 없이 배포 금지

---

## 8. 반응형 동작 (Responsive Behavior)

### 브레이크포인트

| 화면 | Tailwind | 레이아웃 |
|------|----------|----------|
| 모바일 | `< sm` (640px) | 바텀 시트, 전폭 카드, 바텀 네비게이션 (`pb-24`) |
| 태블릿 | `sm ~ lg` | 사이드 패널, `pb-32` |
| 데스크톱 | `lg+` (1024px) | 좌측 패널 (700px), 상단 필터, `pb-8` |

### 모바일 → 데스크톱 전환 패턴

| 요소 | 모바일 | 데스크톱 |
|------|--------|----------|
| 뮤지엄 상세 | 바텀 시트 (슬라이드 업) | 사이드 패널 (슬라이드 인) |
| 필터 | 헤더 내부 칩 스크롤 | 지도 위 플로팅 글라스 패널 |
| 네비게이션 | 바텀 네비게이션 바 | 사이드바 또는 상단 네비게이션 |
| 검색 | 전폭 검색바 | 컴팩트 검색 + 필터 조합 |
| 갤러리 | 2열 그리드 | 4열 그리드 |

### iOS Safari 대응

- 인풋 확대 방지: `font-size: 16px !important` (768px 이하)
- 오버스크롤 방지: `overscroll-behavior: none`
- 스크롤바 숨김: `.scrollbar-hide`
- 뒤로가기 스와이프 방지: `.no-back-swipe`

---

## 9. 에이전트 프롬프트 가이드 (Agent Prompt Guide)

### AI가 UI를 생성할 때 참조할 핵심 규칙

1. **색상 선택**: `--mm-brand` (보라) 계열을 주요 액션에, `orange-500` 계열은 저장/북마크/개인화 기능에만 사용
2. **카드 생성**: `.mm-card` 클래스 기반. `rounded-2xl`, `border`, `shadow-sm`, 호버 시 `shadow-lg + -translate-y-0.5`
3. **텍스트 계층**: 제목 `font-black text-2xl`, 소제목 `font-extrabold text-lg`, 본문 기본, 메타 `text-xs text-gray-400`
4. **간격**: 8px 기반 배수. 요소 간 `gap-3` ~ `gap-5`, 섹션 간 `mb-6` ~ `mb-8`
5. **인터랙션**: 모든 클릭 요소에 `cursor-pointer`, 터치 피드백 `active:scale-95`, 전환 `transition-all duration-200`
6. **다크 모드**: 모든 색상에 `dark:` 변형 필수. 표면 `dark:bg-neutral-900`, 텍스트 `dark:text-white`
7. **글라스 패널**: 지도 위 UI는 `glass-panel` 사용. `backdrop-blur + var(--glass-bg)`
8. **로딩**: `.skeleton` 클래스 사용. 실제 콘텐츠 크기와 일치하는 스켈레톤
9. **애니메이션**: 진입 `animate-fadeInUp` (400ms), 모달 `animate-modalIn` (300ms), 퇴장 `animate-fadeOut` (200ms)
10. **접근성**: 모든 인터랙티브 요소에 `aria-label`, 색상 대비 WCAG AA 이상

### 그라데이션 유틸리티 클래스

| 클래스 | 효과 |
|--------|------|
| `.gradient-btn` | Purple->Orange 배경 버튼, 호버 글로우 + 리프트 |
| `.gradient-text` | Purple->Orange 텍스트 (`background-clip: text`) |
| `.gradient-accent-bar` | 2px 장식용 그라데이션 라인 |
| `.gradient-border` | 의사 요소 그라데이션 테두리 |
| `.gradient-border-subtle` | 연한 그라데이션 테두리 |
| `.gradient-shimmer` | 미묘한 시머 오버레이 (3s 반복) |

### 애니메이션 카탈로그

#### 진입 애니메이션

| 클래스 | 효과 | 지속 시간 |
|--------|------|----------|
| `.animate-fadeIn` | 페이드 인 | 200ms |
| `.animate-fadeInUp` | 위로 12px + 페이드 | 400ms spring |
| `.animate-slideIn` | 왼쪽에서 슬라이드 | 350ms |
| `.animate-slideUp` | 아래에서 슬라이드 | 300ms spring |
| `.animate-slideInDown` | 위에서 슬라이드 | 350ms spring |
| `.animate-modalIn` | 스케일 0.92->1 + 위로 16px | 300ms spring |
| `.animate-backdropIn` | 백드롭 페이드 | 200ms |
| `.stagger-children` | 자식 순차 페이드 인 | 50ms 간격 |

#### 퇴장 애니메이션

| 클래스 | 효과 | 지속 시간 |
|--------|------|----------|
| `.animate-fadeOut` | 페이드 아웃 | 200ms |
| `.animate-fadeOutDown` | 아래로 16px + 페이드 | 250ms |
| `.animate-slideOutToRight` | 오른쪽으로 슬라이드 | 300ms |
| `.animate-slideOutDown` | 아래로 슬라이드 | 300ms |

#### 특수 애니메이션

| 클래스 | 효과 |
|--------|------|
| `.animate-new-museum` | 보라색 아웃라인 펄스 (2s 반복) |
| `.animate-bookmark-bounce` | 저장 시 바운스 (500ms) |
| `.animate-bookmark-shrink` | 저장 해제 시 축소 (400ms) |
| `.animate-scaleSpring` | 1->1.12->0.97->1 (500ms) |

### GlassPanel React 컴포넌트

```tsx
import { GlassPanel } from '@/components/ui/glass';

// intensity: "light" | "medium" (기본값) | "heavy"
// gradient: 그라데이션 테두리 활성화
<GlassPanel intensity="heavy" gradient>
  Content
</GlassPanel>
```

---

## 트랜지션 토큰

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--mm-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | 표준 전환 |
| `--mm-ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` | 바운시 애니메이션 (모달, 슬라이드 인) |
| `--mm-duration-fast` | `150ms` | 호버, 포커스 상태 |
| `--mm-duration-normal` | `200ms` | 표준 전환 |
| `--mm-duration-slow` | `300ms` | 페이지 전환, 모달 |

---

## 둥글기 (Border Radius)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--mm-radius-sm` | 8px (0.5rem) | 체크박스, 작은 요소 |
| `--mm-radius-md` | 12px (0.75rem) | 버튼, 인풋 |
| `--mm-radius-lg` | 16px (1rem) | 카드 내부 요소 |
| `--mm-radius-xl` | 20px (1.25rem) | 카드, 패널 |
| `--mm-radius-2xl` | 24px (1.5rem) | 모달, 시트 |
| `--mm-radius-full` | 9999px | 아바타, 필, 칩 |

---

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-03-03 | 초판: CSS Custom Properties 토큰화 |
| 2026-03-04 | Glassmorphism, Form, Highlight Box 패턴 추가 |
| 2026-03-21 | 전면 재작성 — 정확한 토큰값 반영, 전체 시스템 문서화 |
| 2026-04-16 | **DESIGN.md 형식 전환** — Stitch 표준 9섹션 규격 적용 (시각적 테마, 색상, 타이포그래피, 컴포넌트, 레이아웃, 깊이, 권장/금지, 반응형, 에이전트 가이드) |
| 2026-04-17 | **디자인 일관성 감사 및 수정** — ChallengesPage 다크모드 추가, 버튼 `rounded-lg` → `rounded-xl` 통일, NavHeader 아이콘 버튼 `aria-label` + `focus:ring` 추가, 드롭다운 스타일 통일, plans 버튼 포커스 링 추가 |
