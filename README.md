# Emoticon Studio

OGQ 크리에이터 스튜디오 제출을 목표로 한 **AI 이모티콘 일괄 생성 플랫폼**입니다.
Google Gemini · OpenAI · Stability AI · ChatGPT Plus(Codex OAuth) 네 가지 백엔드를 지원하며,
24개 슬롯 각각에 일본 일러스트/시네마 화각을 자동 분산 배정해 OGQ 심사 통과율을 높이도록 설계되었습니다.

> Powered by **Younglink**

---

## 🚀 5분 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. (E2E 테스트까지 돌리려면) Playwright 브라우저 설치
npx playwright install chromium

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 <http://localhost:3004> 접속 → 4단계 위저드를 따라가면 됩니다.

| 단계 | 화면 | 할 일 |
|---|---|---|
| 1 | API 설정 | 4개 프로바이더 중 하나 선택 + API 키 입력 (Codex는 키 불필요) |
| 2 | 캐릭터 정의 | 캐릭터 설명 작성, 선택적으로 참조 이미지 업로드 |
| 3 | 시나리오 선택 | 13개 프리셋 중 선택 OR 커스텀(1~24개) 모드로 직접 입력/AI 생성 |
| 4 | 이미지 생성 | 화각 분산 계획 확인 → 생성 시작 → ZIP/OGQ 패키지 다운로드 |

---

## 🎯 OGQ 제출 워크플로우

OGQ 크리에이터 스튜디오 (멈춰있는 스티커) 제출 규격:
- 스티커 **24장**, 740×640px PNG (투명 배경)
- 메인 이미지 **240×240px**
- 탭 이미지 **96×74px**

「**OGQ 패키지**」 버튼 한 번이면 위 규격 그대로 ZIP을 만들어 줍니다:

```
ogq-submission.zip
├── stickers/
│   ├── 1.png ~ 24.png       # 740×640, 투명 배경
├── main.png                  # 240×240  메인 이미지 (대표 스티커 자동 크롭)
├── tab.png                   # 96×74    탭 이미지 (대표 스티커 자동 크롭)
└── README.txt                # 제출 직전 체크리스트
```

### 심사 반려를 줄이기 위한 빌트인 가드

| 반려 사유 | 본 플랫폼의 대응 |
|---|---|
| 24장이 모두 같은 화각 | **화각 분산 시스템** (아래 섹션) — 16종 화각을 슬롯별 자동 배정 |
| 비슷한 감정/동작 반복 | **유사 프롬프트 감지** — Jaccard 유사도 0.55 이상이면 생성 전 경고 |
| 캐릭터 일관성 부족 | **캐릭터 히스토리** + 동일 character description으로 24장 묶음 생성 |
| 96×74 썸네일에서 흐릿함 | 모든 화각이 "썸네일 가독성"을 우선으로 큐레이션됨 |
| 흰 가장자리/그림자 잔존 | Canvas 후처리에서 안티앨리어싱 인지 알파 폴오프 적용 |

---

## 🎨 화각 분산 시스템 (핵심 기능)

`lib/composition.ts` 에 정의된 **16종 화각 카탈로그** — 사진/시네마/일본 일러스트 용어 통합:

| 분류 | 항목 |
|---|---|
| 일본 일러스트 | バストアップ(bust-up), どアップ(extreme close-up), アオリ(worm's-eye), フカン(bird's-eye), ちびキャラ(chibi full body), 横顔(side profile), 後ろ姿(back view) |
| 시네마 | Dutch tilt, Over-the-shoulder, Three-quarter view |
| 사진 / 모던 | Macro detail, Selfie POV, Motion diagonal, Top-down flat lay, Peek-out frame, Two-shot |

**작동 방식**:
1. 24개 슬롯에 결정론적 해시로 화각을 분산 배정 (인접 슬롯 중복 금지)
2. 캐릭터 설명에서 테마 키워드를 감지 (커플/오피스/운동/우주 등) → 어울리는 화각에 가중치 부여
3. 각 슬롯의 화각이 `/api/generate` 요청 본문에 `composition` 필드로 주입되어
   이미지 생성 프롬프트의 `**FRAMING (MUST FOLLOW)**` 블록으로 강제됨

생성 시작 전 「**화각 분산 계획**」 아코디언에서 슬롯별 배정을 미리 확인할 수 있습니다.

---

## 🔑 프로바이더별 설정

### Google Gemini (권장 — 가장 저렴)

1. <https://aistudio.google.com/apikey> 에서 키 발급 (`AIza...`)
2. Step 1에서 Google Gemini 선택, 키 붙여넣기

비용: $0.039/이미지 (24장 ≈ $0.94)

### OpenAI

1. <https://platform.openai.com/api-keys> 에서 키 발급 (`sk-...`)
2. Step 1에서 OpenAI 선택, 키 붙여넣기

비용: $0.040/이미지 (DALL·E 3), $0.020/이미지 (GPT Image)

### Stability AI

1. <https://platform.stability.ai/account/keys> 에서 키 발급 (`sk-...`)
2. Step 1에서 Stability AI 선택, 키 붙여넣기

비용: $0.030~$0.080/이미지 (모델별)

> Stability는 텍스트 생성을 지원하지 않아 AI 프롬프트 자동 생성/개선 기능이 비활성화됩니다.

### Codex (ChatGPT Plus/Pro 구독자, API 키 불필요)

ChatGPT Plus 또는 Pro 구독이 있다면 추가 비용 없이 사용 가능합니다.

```bash
# 최초 1회만 — OAuth 로그인
npx @openai/codex login
```

`~/.codex/auth.json` 이 생성되면 앱이 자동 감지하여 Step 1에 Codex 옵션이 노출됩니다.
처음 생성 요청 시 로컬 OAuth 프록시가 `127.0.0.1:10531` 에서 자동으로 기동됩니다.

비용: $0 (구독에 포함). 1장당 생성에 60~120초 소요됩니다.

---

## 📁 프로젝트 구조

```
emoticon-studio/
├── app/
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 4단계 위저드 라우팅
│   ├── globals.css
│   └── api/
│       ├── generate/route.ts        # 이미지 생성 (4 프로바이더 분기)
│       ├── generate-prompts/route.ts # AI 프롬프트 자동 생성
│       ├── improve-prompts/route.ts  # AI 프롬프트 개선
│       ├── validate-key/route.ts     # API 키 사전 검증
│       ├── codex-status/route.ts     # Codex OAuth 세션 감지
│       └── __tests__/                # API 핸들러 단위 테스트
├── components/
│   ├── StepApiConfig.tsx       # 1단계
│   ├── StepUpload.tsx          # 2단계
│   ├── StepScenario.tsx        # 3단계
│   └── StepGenerate.tsx        # 4단계 (화각 분산 패널 포함)
├── hooks/
│   ├── useCharacterHistory.ts  # localStorage 기반 캐릭터 이력
│   └── __tests__/
├── lib/
│   ├── api.ts                  # 프론트엔드 → /api/generate 클라이언트
│   ├── buildPrompt.ts          # 이미지 생성 프롬프트 빌더 (순수 함수)
│   ├── codexProxy.ts           # Codex OAuth 프록시 라이프사이클
│   ├── composition.ts          # 16종 화각 카탈로그 + 분산 알고리즘
│   ├── imageUtils.ts           # Canvas 후처리 (배경 제거, 메인/탭 생성)
│   ├── promptUtils.ts          # 유사 프롬프트 감지 (Jaccard)
│   └── __tests__/
├── e2e/                        # Playwright E2E
├── scripts/
│   └── generate-real.ts        # 실제 API 호출 검증용 일회성 도구
├── types.ts                    # TypeScript 타입
├── constants.ts                # AI 모델/시나리오/OGQ 규격 상수
├── vitest.config.ts            # 단위 테스트 설정
├── playwright.config.ts        # E2E 설정
├── next.config.js
├── tailwind.config.js
├── ecosystem.config.cjs        # PM2 설정
└── package.json
```

---

## 🧪 테스트

```bash
npm test          # vitest 단위 테스트 (1회 실행, 47개)
npm run test:watch
npm run test:e2e  # Playwright E2E (8개) — dev 서버 자동 기동
```

커버리지: `lib/composition`, `lib/promptUtils`, `lib/buildPrompt`, `lib/imageUtils`, `hooks/useCharacterHistory`, `app/api/validate-key`.

### 실제 API 호출 검증 도구

목 없이 실제 백엔드 동작을 확인하고 싶다면:

```bash
# 사전: dev 서버 실행 중이어야 함 + Codex OAuth 로그인 완료
npm run dev &
npx tsx scripts/generate-real.ts
```

4개 슬롯에 서로 다른 화각을 강제 주입해서 실제로 생성한 PNG를
`screenshots/real/slot-{n}-{composition}.png` 로 저장합니다.

---

## 🌐 API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/generate` | 이모티콘 1장 생성 (provider, model, composition, etc.) |
| GET | `/api/generate` | 헬스체크 |
| POST | `/api/generate-prompts` | 테마 → 24개 프롬프트 자동 생성 |
| POST | `/api/improve-prompts` | 기존 프롬프트를 OGQ-친화적으로 개선 |
| POST | `/api/validate-key` | 프로바이더별 API 키 사전 검증 |
| GET | `/api/codex-status` | 로컬 Codex OAuth 세션 감지 |

---

## 🚢 프로덕션 배포

```bash
npm install -g pm2
npm run build
npm run pm2:start    # ecosystem.config.cjs 사용
```

PM2 명령:
```bash
npm run pm2:stop
npm run pm2:restart
npm run pm2:logs
```

---

## 🛠 트러블슈팅

| 증상 | 원인 / 대응 |
|---|---|
| Step 1에 "Codex 미연결" 배지 | `npx @openai/codex login` 후 페이지 새로고침 |
| Codex 생성 시 "model not supported" | `app/api/generate/route.ts` 의 모델명이 `gpt-5.4` 인지 확인. 임의로 `gpt-4.1` 등으로 바꾸면 안 됨 |
| API 키 검증이 항상 통과 | `/api/validate-key` 가 404면 자동 통과로 떨어짐 — Next.js 빌드 캐시(`.next/`) 삭제 후 재시작 |
| 흰 가장자리가 보임 | `lib/imageUtils.ts` 의 `whiteThreshold` (기본 240) 를 250까지 올려 보세요 |
| 24장 생성 후 OGQ 패키지 버튼 안 나옴 | `completedCount > 0` 일 때만 표시됩니다. 최소 1장이라도 완료되어야 함 |
| 화각 분산 계획이 너무 단조로움 | 캐릭터 설명에 테마 키워드(love/fitness/space/office 등)를 추가하면 더 다양해집니다 |

---

## 🧰 지원 AI 모델

### 이미지 생성

| 프로바이더 | 모델 | 이미지당 비용 |
|------------|------|--------------|
| Google Gemini | Gemini 2.0 Flash | $0.039 |
| Google Gemini | Imagen 3 | $0.040 |
| OpenAI | DALL-E 3 | $0.040 |
| OpenAI | GPT Image | $0.020 |
| Stability AI | Stable Image Ultra | $0.080 |
| Stability AI | Stable Image Core | $0.030 |
| Stability AI | SD 3.5 Large | $0.065 |
| Stability AI | SD 3.5 Large Turbo | $0.040 |
| Codex (ChatGPT Plus/Pro) | gpt-5.4 (OAuth 프록시) | $0 (구독) |

### 텍스트 생성 (프롬프트 생성/개선)

| 프로바이더 | 모델 | 설명 |
|------------|------|------|
| Google Gemini | gemini-2.0-flash-exp | 빠르고 효율적 (기본) |
| Google Gemini | gemini-1.5-flash | 균형잡힌 성능 |
| Google Gemini | gemini-1.5-pro | 고품질 출력 |
| OpenAI | gpt-4o-mini | 빠르고 저렴 (기본) |
| OpenAI | gpt-4o | 최신 고성능 |
| OpenAI | gpt-3.5-turbo | 기본 모델 |

> Stability AI는 텍스트 생성을 지원하지 않습니다.

---

## 🖼 이미지 처리 파이프라인

1. 클라이언트 → `/api/generate` 호출 (composition 포함)
2. 서버 → 선택된 프로바이더 API 호출
3. AI → Base64 PNG 반환
4. 클라이언트 Canvas 후처리:
   - 흰 배경 제거 + 안티앨리어싱 가장자리 알파 폴오프
   - 콘텐츠 영역 자동 크롭 + 2px 패딩
   - 740×640 캔버스 중앙 정렬 (80% 비율)
5. OGQ 패키지 생성 시:
   - 대표 스티커를 240×240 메인, 96×74 탭으로 추가 리사이즈
   - JSZip 으로 한 번에 묶음

---

## 📦 의존성

### Production
- `next@^14.2.0`, `react@^18.3.1`, `react-dom@^18.3.1`
- `@google/genai@^1.31.0`, `openai@^4.73.0`
- `jszip@^3.10.1`

### Development
- `typescript@~5.8.2`, `tailwindcss@^3.4.14`, `autoprefixer@^10.4.20`, `postcss@^8.4.47`
- `vitest@^2.1.8`, `@vitejs/plugin-react@^4.3.4`, `happy-dom@^15.11.7`, `@testing-library/react@^16.1.0`
- `@playwright/test@^1.60.0`

---

## 📄 라이선스

MIT License
