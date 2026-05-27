# Museum Photo 운영 정책

> **최종 업데이트: 2026-03-21**  
> Google Maps Platform 정책(2025.03 변경) 및 오픈 액세스 API 사용 기준을 반영한 서비스 운영 가이드

---

## 1. 이미지 소스 분류

| 소스 | 용도 | 라이선스 | 광고 가능 | 필드 |
|---|---|---|---|---|
| **Google Places API** | 미술관 외관/실내 사진 | Google ToS (비저장 원칙) | ✅ | `placePhotos` |
| **AIC API** | 작품 이미지 | CC0 | ✅ 완전 자유 | `Artwork.image` |
| **Met API** | 작품 이미지 | CC0 | ✅ 완전 자유 | `Artwork.image` |
| **Smithsonian API** | 작품 이미지 | CC0 | ✅ 완전 자유 | `Artwork.image` |
| **Europeana API** | 작품/문화유산 이미지 | CC0 / CC-BY / 혼합 | ✅ (`reusability=open` 필터 필수) | `Artwork.image` |
| **Wikimedia Commons** | 미술관/작품 사진 | CC0 / CC-BY | ✅ (CC-BY: 출처 필수) | `imageUrl` |

---

## 2. DB 스키마 (Museum 모델)

### 2.1 이미지 관련 필드

```prisma
// ── Google Places 데이터 (TTL 스냅샷) ──
placeId            String?   @unique @map("place_id")         // 영구 저장 허용
placePhotos        Json?     @map("place_photos")              // TTL 스냅샷 (최대 2장)
lastSyncedAt       DateTime? @map("last_synced_at")            // 동기화 시점

// ── 대표 이미지 (소스 불문) ──
imageUrl           String?                                      // 대표 이미지 URL
sourceAttribution  Json?     @map("source_attribution")        // 출처 메타 (아래 구조 참고)

// ── Google 평가 (TTL 스냅샷) ──
googleRating       Float?
googleRatingsTotal Int?
openingHours       Json?
```

### 2.2 `sourceAttribution` 구조 명세

```json
{
  "source": "google_places" | "wikimedia" | "manual",
  "text": "Powered by Google",
  "authorName": "사진작가 이름 (옵션)",
  "authorUrl": "https://...",
  "license": "CC0" | "CC-BY-SA" | "Google ToS",
  "sourceUrl": "원본 URL"
}
```

> **프론트엔드**: `source` 값으로 Google 로고/CC 표기 등 UI 분기  
> **백엔드**: 갱신 시 `source`에 따라 TTL 적용 여부 결정

### 2.3 `imageUrl` 사용 가이드

| imageUrl 소스 | 식별 방법 | 영구 저장 | 출처 표기 |
|---|---|---|---|
| Google Places | URL에 `googleapis.com` 포함 | ⚠️ TTL 갱신 필요 | "Powered by Google" |
| Wikimedia | URL에 `wikimedia.org` 포함 | ✅ 가능 | CC0이면 불필요, CC-BY면 필수 |
| 직접 등록 | 기타 | ✅ 가능 | 상황에 따라 |

> **향후 고도화**: `primaryImageSource`, `primaryImageLicense`, `primaryImageAttribution` 필드 분리 권장

---

## 3. 사진 호출 전략

### 3.1 기본 호출 구조

```
리스트 (홈/검색):  imageUrl (캐시된 대표 1장) → 과금 없음
상세 (MuseumDetail): placePhotos (최대 2장) → TTL 체크
백그라운드 갱신:     월 1회 배치 스크립트
```

### 3.2 TTL 갱신: Stale-While-Revalidate 방식

❌ **하면 안 되는 것**: 만료 시 사용자 요청에서 즉시 Places API 재호출  
✅ **올바른 방식**: stale-while-revalidate

```
사용자가 상세 진입
  ↓
lastSyncedAt < 180일?
  ├─ YES → 캐시된 stale 데이터 바로 표시
  └─ NO  → 캐시된 stale 데이터 바로 표시 (동일)
            + 백그라운드에서 Places API 재호출
            + DB 갱신
            → 다음 요청부터 새 데이터 적용
```

**장점:**
- 동시 접속 시 API 폭주 방지
- 사용자 체감 지연 없음
- Places API 호출 최소화

### 3.3 비용 관리

| SKU | 가격 (1,000건) | 갱신 전략 |
|---|---|---|
| Place Details Photos | $7.00~ | 상세 진입 시에만, stale-while-revalidate |
| Place Details | $5.00~ | 배치 또는 백그라운드 갱신 |
| Text Search | $10.00~ | placeId 등록 시 1회만 |

---

## 4. 삭제 및 교체 정책

| 상황 | 처리 규칙 |
|---|---|
| Places 응답에 **사진 없음** | `placePhotos = null`, `imageUrl` 유지 (fallback) |
| `placeId` **재매칭 성공** (이전과 다른 ID) | 기존 `placePhotos` 스냅샷 전체 교체 |
| API 호출 **3회 연속 실패** | stale 데이터 유지 + admin 플래그 설정 |
| 미술관 **폐관 확인** | `placeId` null 처리 + 수동 이미지로 전환 |
| 사진 **URL 만료** (404) | 다음 배치 갱신 시 자동 교체 |

---

## 5. 출처 표기 (Attribution)

### 현재 구현 상태
- ✅ `MuseumDetailCard.tsx` — Google Places attribution 표시
- ✅ `collections/[id]/page.tsx` — Google attribution 표시
- ✅ `Icons.tsx` — Google attribution 아이콘 컴포넌트

### 필수 조건
- Google Places 사진 → "Powered by Google" 또는 Google 로고
- 제3자 사진 attribution → 해당 attribution 같이 표시
- Wikimedia CC-BY → `© 작가명` + 라이선스 표시

---

## 6. 현재 정책 위반 사항: ✅ 없음

| 항목 | 상태 |
|---|---|
| place_id 저장 | ✅ `placeId` 필드 추가 완료 |
| 사진 URL 캐싱 | ✅ TTL 갱신 구조 마련 (`lastSyncedAt`) |
| Attribution 표시 | ✅ Google Places 사진 사용 시 표시 |
| 작품 이미지 분리 | ✅ CC0 오픈 액세스 API 사용 |
| 과호출 방지 | ✅ 리스트=캐시, 상세=stale-while-revalidate |

---

## 7. 운영 스크립트

### `scripts/sync_places.js`

```bash
# placeId 등록 + 만료분 갱신
node scripts/sync_places.js

# placeId만 등록
node scripts/sync_places.js --register

# 만료분만 갱신
node scripts/sync_places.js --refresh

# 전체 강제 갱신
node scripts/sync_places.js --refresh-all
```

### 권장 운영 주기

| 작업 | 주기 | 비용 (300개 미술관 기준) |
|---|---|---|
| placeId 등록 | 신규 등록 시 1회 | ~$3 |
| TTL 갱신 | 월 1회 | ~$2-3 |
| 전체 강제 갱신 | 분기 1회 | ~$2-3 |

---

## 8. 오픈 액세스 API 사용 가이드

| API | 라이선스 | 상업적 사용 | 비고 |
|---|---|---|---|
| **AIC** | CC0 | ✅ | ~1955 사후 70년 작가 |
| **Met** | CC0 | ✅ | ~1955 사후 70년 작가 |
| **Smithsonian** | CC0 | ✅ | SAAM, Hirshhorn |
| **Europeana** | CC0/CC-BY/혼합 | ✅ (필터 필수) | `reusability=open` 파라미터 + 화이트리스트 이중 검증, 5천만+ 유럽 문화유산 |
| **Artsy** | 비상업 전용 | ❌ | 광고 불가 |
