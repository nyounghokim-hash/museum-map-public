# API 비용 최적화 정책

> 최종 수정: 2026-03-21

---

## ⚠️ 비용 사고 기록

### 2026-03-17 — `sync_places.js --all` 불필요 실행

**발생 경위:**
- 신규 10개 박물관 데이터 보강 요청 시 `sync_places.js --all` 실행
- 대상을 신규 10개로 제한하지 않고 placeId 없는 전체 352개에 실행
- Phase 1 (Text Search) + Phase 2 (Place Details) 전체 실행 → **약 ₩40,000+ 추가 비용 발생**

**실제 상황:**
- Supabase 사진 캐시는 이미 3,732개(99.3%) 완료 상태
- placeId 없는 352개 = 최근 30일 이내 신규 추가분 (이전 sync에서 누락)
- Phase 2에서 수집한 평점/사진 URL은 이미 캐싱된 데이터라 실질적 가치 없음

**교훈 — 앞으로 반드시 지켜야 할 규칙:**
1. **Google Places API 호출 전 반드시 대상 범위·예상 비용 먼저 고지하고 승인받을 것**
2. 신규 박물관 보강 시 `WHERE id IN (...)` 또는 `WHERE createdAt > X`로 대상 한정할 것
3. `--all` 플래그 사용 금지 — 항상 `--register`(신규만) 또는 대상 ID 지정
4. 이미 캐싱된 데이터 상태 먼저 확인 후 실행 여부 결정

---

## 1. 비용 발생 경로 및 대응

| API | 용도 | 비용 구조 | 최적화 상태 |
|-----|------|----------|------------|
| Google Places (New) | 사진, 평점, 리뷰 수집 | $20/1K (Place Details) | ✅ 배치 전용, 90일 TTL, TOP 500 우선 |
| Google Places Photos | 사진 표시 | $7/1K (Photo) | ✅ **Supabase Storage 캐시** (API 호출 0) |
| Google Maps Geocoding | 좌표→주소 변환 | $5/1K | ✅ 배치 전용, DB 저장 |
| Google Gemini | 번역, 추천, 요약 | 무료 (Free tier) | ✅ 실시간 서비스 |
| Google Reviews | 박물관 리뷰/평점 | $32/1K (Text Search) + $17/1K (Details) | ✅ DB 저장 데이터 사용 (API 호출 제거) |

## 2. Photo 캐싱 정책 (Supabase Storage)

### 아키텍처
```
[배치 - 월 1회]
  DB placePhotos (googleusercontent URL) → 직접 다운로드 → Supabase Storage 업로드
  → DB cachedPhotoUrls 업데이트, lastPhotoSync 갱신

[사용자 접속]
  DB cachedPhotoUrls → Supabase Storage 직접 서빙 (Google API 호출 0)
  폴백: cachedPhotoUrls 없으면 → 기존 Google 프록시 사용
```

### 비용
- **배치 다운로드**: ₩0 (googleusercontent URL은 무료 CDN)
- **Supabase Storage**: ₩0 (Pro 플랜 포함, 100GB 저장 / 250GB 대역폭)
- **사용자 트래픽**: ₩0 (Google API 호출 완전 제거)

### 규칙
- `cachedPhotoUrls` 있으면 → Supabase URL 직접 사용
- `cachedPhotoUrls` 없으면 → 기존 Google 프록시 폴백
- `lastPhotoSync` 기준 90일마다 갱신 (인기도 상위 500개 우선)

### 관련 파일
- `src/lib/supabase.ts` — Supabase 클라이언트
- `src/lib/photo-proxy.ts` — URL 변환 (cachedPhotoUrls 우선)
- `src/app/api/photos/place/route.ts` — 프록시 API (폴백용)
- `scripts/cache_photos_to_storage.ts` — 배치 캐시 스크립트

## 3. Google Reviews → DB 전환

### 변경 전 (비용 발생)
```
사용자 박물관 조회 → /api/museums/[id]/reviews/google
  → Google Text Search API ($32/1K)
  → Google Place Details API ($17/1K)
  = 건당 ~₩70, 월 1000뷰 시 ~₩70,000
```

### 변경 후 (비용 $0)
```
사용자 박물관 조회 → /api/museums/[id]/reviews/google
  → DB에서 googleRating, googleRatingsTotal 조회
  → 앱 Review 모델에서 사용자 리뷰 조회
  = 건당 ₩0
```

## 4. 실시간 Billing 모니터링

- Admin > AI 탭에서 확인 가능
- GCP Cloud Monitoring API로 30일 API 사용량 자동 조회
- 서비스별 호출 수 + 단가 기반 추정 비용 표시
- 관련 파일: `src/app/api/admin/billing/route.ts`

## 5. 데이터 갱신 (수동)

### 사진 캐시 갱신 (90일마다)
```bash
npx tsx scripts/cache_photos_to_storage.ts          # 미갱신분만
npx tsx scripts/cache_photos_to_storage.ts --force   # 전체 재갱신
```

### Places 데이터 갱신 (90일 TTL, TOP 500 우선)
```bash
node scripts/sync_places.js --refresh       # 만료된 인기 TOP 500만 갱신
node scripts/sync_places.js --refresh-all   # 전체 강제 갱신 (비상시만)
```
- TTL 90일 기준, 인기도(popularityScore) 상위 500개만 주기적 갱신
- 나머지는 초기 수집 데이터 유지 (수동 갱신 가능)
- 예상 비용: 500건 × $0.02 × 4회/년 = **$40/년 (≈₩58,000/년)**

> ⚠️ 향후 Vercel Cron 또는 GitHub Actions로 자동화 예정

## 6. 데이터 최신성 면책

- UI에 "정보는 최신이 아닐 수 있습니다. 공식 웹사이트를 확인하세요" 안내 표시
- 이용약관 면책 조항에 데이터 갱신 주기 명시 (90일 TTL)
- 평점/운영시간은 수집 시점 기준 참고 정보로만 제공
