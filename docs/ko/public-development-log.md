# 공개 개발 로그 요약

마지막 업데이트: 2026-05-27

이 문서는 private repository의 raw log와 운영 비밀을 제외하고, 평가자가 확인할 수 있는 개발/검증 이력만 요약한 공개용 문서입니다.

## 2026-05 Production Stabilization

- 모바일 지도 horizontal overflow 문제를 수정했습니다.
- splash/hydration 불안정성을 줄이고 service worker controller change 시 강제 reload를 제거했습니다.
- 작품 상세에서 browser back 시 기존 박물관 detail panel이 다시 열리도록 수정했습니다.
- 데스크톱 지도 높이와 detail panel layout/motion을 복구했습니다.
- 여행 계획 목록을 생성일 기준으로 정렬하도록 개선했습니다.

## Security and Cost Hardening

- admin story rewrite, token usage, blog draft/mutation API에 admin session 인증을 강화했습니다.
- public translate/recommend endpoint에 입력 제한과 rate control을 추가했습니다.
- translation cache 삭제 권한을 admin으로 제한했습니다.
- AI token usage tracking과 비용 관리 문서를 정리했습니다.

## Data Quality and Media

- visibility metadata가 없는 박물관도 public으로 처리하도록 수정했습니다.
- 지도 검색, AI 추천 카드, story 관련 박물관 chip, 신규 박물관 dropdown에서 이미지 fallback 순서를 통일했습니다.
- Google Places original image URL 대신 Supabase cached URL을 우선 사용하도록 정리했습니다.
- 공개 박물관 사진 fallback coverage를 100%로 맞췄습니다.
- generic `Art Museum` 카테고리를 더 구체적인 분류로 정리했습니다.
