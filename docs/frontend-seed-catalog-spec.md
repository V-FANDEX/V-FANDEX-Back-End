# 프론트엔드 연동 명세: 시즌 기본 종목 저장

## 1. 기능 목적

시즌 도중 관리자가 새로 상장한 종목은 기본적으로 해당 시즌에만 존재하며, 시즌 초기화 시 삭제된다. 관리자가 특정 종목을 기본 카탈로그에 저장하면 다음 시즌 초기화에서도 해당 종목과 소속 시장이 유지된다.

기본 종목은 다음 두 출처로 구분한다.

- `FILE`: `prisma/seed-data.example.json` 또는 운영용 로컬 시드 파일에서 생성된 종목
- `ADMIN`: 관리자가 API를 통해 기본 카탈로그로 승격한 종목
- `null`: 시즌 초기화 시 삭제되는 일반 종목

## 2. API 기본 정보

- 운영 API 기본 주소: `https://v-fandex-back-end.onrender.com`
- 모든 관리자 API는 `Authorization: Bearer <accessToken>` 헤더가 필요하다.
- 관리자 권한이 아닌 사용자는 접근할 수 없다.
- 금액 관련 Decimal 필드는 JSON 응답에서 문자열로 내려온다.

## 3. 종목 응답 변경

기존 `Stock` 응답에 다음 필드가 추가된다. `GET /stocks`, `GET /stocks/:id`, `GET /admin/stocks` 등 종목 전체 정보를 반환하는 API에 동일하게 포함된다.

```ts
export type SeedSource = "FILE" | "ADMIN" | null;

export interface Stock {
  // 기존 필드 유지
  id: string;
  marketId: string;
  name: string;
  initialPrice: string;

  seedSource: SeedSource;
  seedPrice: string | null;
  seededAt: string | null;
}
```

필드 의미:

- `seedSource`: 기본 카탈로그 저장 출처
- `seedPrice`: 시즌 초기화 시 복원할 가격
- `seededAt`: 관리자가 마지막으로 기본 카탈로그에 저장한 시각. 파일 시드 종목은 `null`일 수 있다.

## 4. 기본 카탈로그 저장 API

### 요청

```http
POST /admin/stocks/:stockId/save-to-seed
Authorization: Bearer <ADMIN_ACCESS_TOKEN>
Content-Type: application/json
```

초기 상장 가격을 다음 시즌의 시작 가격으로 사용:

```json
{}
```

관리자가 별도의 다음 시즌 시작 가격을 지정:

```json
{
  "seedPrice": 12500
}
```

```ts
export interface SaveStockToSeedRequest {
  seedPrice?: number;
}
```

검증 규칙:

- `seedPrice`는 생략할 수 있다.
- 입력할 경우 `0.0001` 이상의 숫자여야 한다.
- 생략하면 해당 종목의 `initialPrice`가 저장된다. 현재 변동 중인 `currentPrice`가 자동 저장되는 것이 아니다.

### 성공 응답

HTTP `200 OK`와 함께 갱신된 전체 `Stock` 객체를 반환한다.

```json
{
  "id": "stock_cuid",
  "marketId": "market_cuid",
  "name": "신규 종목",
  "initialPrice": "10000.0000",
  "seedSource": "ADMIN",
  "seedPrice": "12500.0000",
  "seededAt": "2026-07-15T15:00:00.000Z",
  "status": "LISTED"
}
```

응답에는 위 예시에서 생략한 기존 Stock 필드도 모두 포함된다.

같은 종목을 다시 호출하면 `seedPrice`와 `seededAt`이 최신 요청 기준으로 갱신된다.

### 오류 응답

- `400 Bad Request`: `seedPrice` 형식 또는 최솟값 위반
- `401 Unauthorized`: 로그인 토큰 없음 또는 만료
- `403 Forbidden`: ADMIN 권한 없음
- `404 Not Found`: 존재하지 않는 `stockId`

## 5. 관리자 화면 권장 동작

### 종목 목록

`GET /admin/stocks?includeUnlisted=true` 결과의 `seedSource`를 사용해 다음 상태를 표시한다.

- `FILE`: `파일 기본 종목`
- `ADMIN`: `관리자 저장 종목`
- `null`: `시즌 한정 종목`

`seedSource=null`인 종목에는 `기본 종목으로 저장` 명령을 제공한다. `ADMIN` 종목에는 저장 가격을 변경할 수 있도록 같은 명령을 `기본 설정 수정`으로 표시할 수 있다. 현재 기본 카탈로그 해제 API는 제공하지 않는다.

### 저장 모달

다음 두 모드를 제공한다.

1. `초기 상장 가격 사용`: 빈 객체 `{}` 전송
2. `직접 지정`: 숫자 입력 후 `{ seedPrice }` 전송

저장 성공 후에는 응답 객체로 해당 종목 캐시를 즉시 교체한다. 최소 갱신 대상은 다음 쿼리다.

- 관리자 종목 목록
- 해당 종목 상세
- 시장별 종목 목록

### 신규 상장 직후 저장

관리자 종목 생성 화면에 `다음 시즌에도 유지` 체크박스를 둘 수 있다. 체크한 경우 다음 순서로 호출한다.

1. `POST /admin/stocks`로 종목 생성
2. 생성 응답의 `id`로 `POST /admin/stocks/:id/save-to-seed` 호출

두 번째 요청이 실패해도 종목 생성 자체는 성공한 상태이므로, 사용자에게 `상장은 완료됐지만 기본 종목 저장에 실패했습니다`라고 구분해 안내하고 다시 시도할 수 있게 한다.

## 6. 시즌 초기화 응답 변경

`POST /admin/seasons/:id/reset` 응답에 다음 필드가 추가된다.

```ts
export interface SeasonResetResult {
  // 기존 필드 유지
  seedMarketsApplied: number;
  seedStocksApplied: number;
  adminSeedMarketsPreserved: number;
  adminSeedStocksRestored: number;
  seedPriceHistoriesCreated: number;
}
```

- `adminSeedMarketsPreserved`: 관리자 저장 종목 때문에 유지된 시장 수
- `adminSeedStocksRestored`: 저장 가격으로 초기화된 관리자 기본 종목 수

초기화 완료 화면에서 파일 기본 종목 수와 관리자 저장 종목 수를 구분해 보여줄 수 있다.

## 7. 시즌 초기화 동작

관리자 기본 종목은 시즌 초기화 시 다음과 같이 처리된다.

- 종목과 소속 시장 유지
- `currentPrice`, `previousPrice`, `initialPrice`를 `seedPrice`로 복원
- 상장 상태로 복원하고 거래 정지 및 상장폐지 상태 해제
- 진행 중이던 목표 가격 이동 상태 제거
- 새 시즌용 가격 히스토리 재생성

보유 자산, 거래 내역, 조건 주문 등 시즌 데이터는 기존 초기화 정책대로 삭제된다.

## 8. 이미지 변경 사항

아오쿠모 린, 유즈하 리코, 텐코 시부키, 하나코 나나, 이로은의 `imageUrl`이 각각의 실제 프로필 이미지로 수정됐다. 프론트 API 계약 변경은 없으며 기존처럼 응답의 `imageUrl`을 사용하면 된다. 이미지 로딩 실패에 대비한 공통 fallback UI는 유지한다.

## 9. 프론트 구현 체크리스트

- Stock 타입에 `seedSource`, `seedPrice`, `seededAt` 추가
- 관리자 종목 목록에 기본 종목 상태 표시
- 기본 종목 저장/수정 모달 구현
- `POST /admin/stocks/:id/save-to-seed` API 함수 추가
- 신규 종목 생성 후 선택적인 저장 API 연속 호출
- 성공 응답으로 종목 관련 캐시 갱신
- 시즌 초기화 결과 타입과 완료 화면에 관리자 기본 종목 통계 추가
- 400/401/403/404 오류별 사용자 메시지 처리
