# 프론트엔드 변경 안내: 기본 장 저장

관리자가 시즌 중 추가한 장을 다음 시즌에도 유지할 수 있도록 기본 장 저장 기능이 추가됐다.

## 1. Market 타입 변경

모든 Market 응답에 다음 필드가 포함된다.

```ts
type SeedSource = "FILE" | "ADMIN" | null;

interface Market {
  // 기존 필드 유지
  seedSource: SeedSource;
  seededAt: string | null;
}
```

- `FILE`: JSON 파일에서 생성된 기본 장
- `ADMIN`: 관리자가 기본 장으로 저장한 장
- `null`: 현재 시즌에만 유지되는 일반 장

## 2. 기본 장 저장 API

```http
POST /admin/markets/:marketId/save-to-seed
Authorization: Bearer <ADMIN_ACCESS_TOKEN>
```

- 요청 본문 없음
- 성공: `200 OK`와 갱신된 Market 반환
- 오류: `401`, `403`, `404`

## 3. 장 생성 화면 연동

`다음 시즌에도 유지` 체크박스를 추가하고 선택된 경우 다음 순서로 호출한다.

1. `POST /admin/markets`
2. 생성 응답의 `id`로 `POST /admin/markets/:id/save-to-seed`

두 번째 요청이 실패해도 장 생성은 완료된 상태이므로 저장 실패만 별도로 안내하고 재시도할 수 있게 한다.

## 4. 관리자 목록 표시

`GET /admin/markets?includeInactive=true` 응답의 `seedSource`로 `파일 기본 장`, `관리자 저장 장`, `시즌 한정 장` 상태를 표시한다. 저장 성공 후 관리자 장 목록과 공개 장 목록 캐시를 갱신한다.

장을 기본값으로 저장해도 소속 종목은 자동 저장되지 않는다. 다음 시즌에도 유지할 종목은 기존 `POST /admin/stocks/:stockId/save-to-seed` API로 각각 저장해야 한다.
