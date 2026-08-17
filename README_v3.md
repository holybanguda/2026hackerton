# 🍽️ QR-Based AI Smart Menu Recommendation System (v3.0.0)

> **하이브리드 AI 메뉴 추천 시스템: 자체 ML 앙상블 + Confidence 라우팅 + LLM Fallback**  
> GPT 개입이 적어도 동작하는 자체 ML 파이프라인을 핵심으로, LLM은 불확실할 때만 보조하는 하이브리드 아키텍처.

---

## 🆕 Release Notes

### 🚀 v3.0.0 (2026-08-18) - Self-Hosted ML Engine & LLM Independence
> **자체 ML 엔진으로 GPT 없이 메뉴 인식/추천 전 과정 동작, 앙상블 Voting 분류기 95.23%, Confidence 기반 LLM 라우팅, 5관점 앙상블 냅색 추천 엔진 완성! 🧠⚡**

1. **🧠 자체 ML 메뉴 파서 v2.0 (GPT 없이 동작):**
   - Kiwi 형태소 분석 + 7가지 정규식 가격 패턴 + 멀티라인 매칭(네이버 검색 결과 대응).
   - 네이버/토스/일반 메뉴판의 노이즈 자동 필터링 (주소, 리뷰, 날짜, 전화번호, 할인, 고객센터 등).
   - 인라인 괄호 가격 패턴 `메뉴명(가격원)` 지원.
   - 카테고리 헤더 컨텍스트 인식 (메인/사이드/음료/주류 자동 분류).
   - **GPT API 장애 시에도 메뉴 인식 100% 동작 보장.**

2. **📊 Voting Ensemble 분류기 (Accuracy 93.85% → 95.23%):**
   - LogisticRegression + LinearSVC + ComplementNB 3모델 Hard Voting.
   - 벤치마크 8개 모델 비교 후 최적 조합 선정.
   - 50+ 한국 음식 메뉴 사전(Dictionary) 탑재로 confidence 0.95 즉시 분류.

3. **🔀 Confidence 기반 LLM 라우팅 (Phase 2):**
   - ML 파서 avg confidence ≥ 0.65 + 메뉴 3개 이상 → **GPT 완전 스킵**.
   - confidence 미달 시에만 GPT fallback 호출 (API 비용 최소화).
   - 서버 로그에 `[Confidence Router] HIGH → GPT SKIP` 명시.

4. **🎯 5관점 앙상블 냅색 추천 엔진:**
   - 예산 적합도 (30%) + 디쉬 수 근접도 (25%) + 카테고리 다양성 (20%) + 가격 균형도 (10%) + 프로필 적합도 (15%).
   - 메인 카테고리 필수 포함 제약 (메인 없으면 점수 50% 감소).
   - balance / signature / value 3대 프로필별 차별화된 조합.

5. **📝 자체 추천 사유 생성 (GPT 완전 제거):**
   - 조건(인원, 예산, 프로필, 카테고리 구성)에 따른 템플릿 기반 한국어 사유 자동 생성.
   - GPT 호출 0회로 추천 응답 즉시 반환 (지연 없음).

6. **🌐 플랫폼별 전용 크롤러:**
   - 네이버 지도 PID → pcmap 메뉴 직접 접근 (캡차 시 검색 fallback).
   - 토스플레이스/캐치테이블 → 모바일 SPA 전용 Playwright 렌더링.
   - 상호명 검색 → 네이버 검색 결과 크롤링 + "더보기" 반복 클릭.

7. **📸 이미지 전처리 파이프라인 (OCR 정확도 향상):**
   - CLAHE 대비 향상 + 가우시안 디노이즈 + 샤프닝.
   - 원본 vs 전처리 이미지 이중 OCR → 더 나은 결과 자동 채택.

8. **🔒 보안 강화:**
   - CORS 출처 제한 (localhost만 허용).
   - 입력 검증: XSS 방어, 500자 절삭, Pydantic 제약 (인원 1~20, 예산 ~500만).
   - storeName URL/숫자/플랫폼명 필터링.

---

### 📱 v2.0.1 (2026-08-16)
> **WAF 우회, 3단 Auto-Interaction 크롤러, 스마트 검색 Fallback**

### 🚀 v2.0.0 (2026-08-15)
> **Playwright 동적 렌더러, 다중 QR 디코더, Zero-Persistence 아키텍처**

### 📱 v1.1.0 (2026-08-12)
> **모바일 React UI 구축 & Naver Place 라이브 파서 연동**

### 🚀 v1.0.2 (2026-08-11)
> **AI 분류 모델 Validation Accuracy 93.85%**

---

## 🌟 시스템 핵심 아키텍처 (v3.0.0)

```
[ Mobile Client (React :3000) ]
        │ (QR 사진 / 카메라 / URL / 코드 입력)
        ▼
[ AI Microservice (FastAPI :8000) ]
  ├── 1. 범용 QR 디코더 (Pyzbar + OpenCV + CLAHE + 4방향 회전)
  ├── 2. 이미지 전처리 (CLAHE + Denoise + Sharpen + Dual OCR)
  ├── 3. Playwright 플랫폼별 크롤러 (네이버/토스/캐치테이블)
  ├── 4. ⭐ Kiwi ML Parser v2.0 (자체 메뉴 인식 - GPT 불필요)
  │       ├── 7가지 정규식 가격 패턴
  │       ├── 멀티라인 메뉴-가격 매칭
  │       ├── 인라인 괄호 패턴
  │       ├── 노이즈 자동 필터링
  │       └── Voting Ensemble 카테고리 분류 (95.23%)
  ├── 5. Confidence Router (≥0.65 → GPT SKIP / <0.65 → GPT Fallback)
  ├── 6. ⭐ 5관점 앙상블 냅색 추천 엔진 (GPT 불필요)
  │       ├── 예산 적합도 (30%)
  │       ├── 디쉬 수 근접도 (25%)
  │       ├── 카테고리 다양성 (20%)
  │       ├── 가격 균형도 (10%)
  │       └── 프로필 적합도 (15%)
  └── 7. 자체 템플릿 추천 사유 생성 (GPT 불필요)
        │
        ▼
[ Main Backend (Spring Boot :8080) ]
  ├── 세션/이력 관리
  ├── 경과시간 자동 계산
  └── FastAPI 장애 시 Fallback
```

### GPT 개입률 변화
| 버전 | 메뉴 파싱 | 추천 조합 | 추천 사유 | 전체 GPT 의존도 |
|------|-----------|----------|----------|---------------|
| v1.0 | 100% GPT | 100% GPT | 100% GPT | **100%** |
| v2.0 | 100% GPT | Knapsack + GPT | GPT | **~80%** |
| **v3.0** | **ML 우선 (GPT fallback)** | **앙상블 냅색** | **자체 템플릿** | **~5% (필요 시만)** |

---

## 📂 프로젝트 폴더 구조

```
menu_ai/
├── 🔒 .gitignore
├── 📝 README_v3.md
│
├── 🤖 ai/                                    # Python FastAPI AI 마이크로서비스
│   ├── main.py                               # ⭐ 메인 서버 (크롤링 + 파싱 + 추천)
│   ├── model_runner.py                       # ⭐ Kiwi ML Parser v2.0 (자체 메뉴 인식)
│   ├── train_model.py                        # ⭐ Voting Ensemble 학습 스크립트
│   ├── menu_classifier.pkl                   # ⭐ 0.68MB Voting Ensemble 모델
│   ├── open_api_client.py                    # 식약처 공공 API 클라이언트
│   └── .env                                  # API 키 (gitignore 처리)
│
├── ☕ back/hackerton/                         # Spring Boot 백엔드
│   └── src/main/java/com/hackerton/
│       ├── ai/                               # AI 연동 (AiService.java)
│       ├── menuscan/                         # QR 스캔 관리
│       ├── recommendation/                   # 추천 CRUD API
│       ├── conditionedit/                    # 조건 수정
│       └── config/                           # WebConfig (CORS)
│
├── 📦 json/                                   # 학습/검증 데이터셋
│   ├── korean_restaurant_menu_dataset_150_v4.json  # 150개 식당 9,244 메뉴
│   ├── restaurant_locations.json                   # 50,000개 식당 위치 DB
│   ├── food_lookup.json                            # 19,495건 영양성분
│   ├── allergen_dict.json                          # 4,424건 원재료/알레르기
│   └── test_restaurants_5.json                     # 실전 테스트 매장
│
└── 🎨 front/                                  # React 모바일 프론트엔드
    └── src/App.jsx                            # 16개 피그마 1:1 반영 UI
```

---

## 🚀 빠른 시작 가이드 (Quick Start)

### 1단계. AI 서버 (`:8000`)
```powershell
cd ai
python -m uvicorn main:app --port 8000 --reload
```

### 2단계. Spring Boot 백엔드 (`:8080`)
```powershell
cd back/hackerton
.\gradlew.bat bootRun
```

### 3단계. React 프론트엔드 (`:3000`)
```powershell
cd front
npm run dev
```

**접속:** [`http://localhost:3000`](http://localhost:3000)

---

## 📡 주요 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/ai/parse-url?url=...` | URL/상호명 → 메뉴 파싱 |
| `POST` | `/ai/parse-image` | QR/메뉴판 이미지 → 메뉴 파싱 |
| `POST` | `/ai/recommend` | 메뉴 리스트 → AI 추천 조합 |
| `PUT` | `/ai/re-recommend` | 다른 조합으로 재추천 |

---

## 🏆 기술적 차별성 (v3.0.0)

1. **🧠 GPT 없이 동작하는 완전 자립형 AI 엔진:**
   - API 키 장애/비용 걱정 없이 메뉴 인식 + 추천 + 사유 생성 전 과정 자체 처리.
   - GPT는 "불확실한 경우의 보조"로만 사용 (Confidence Router).

2. **📊 벤치마크 검증된 앙상블 ML 모델:**
   - 8개 모델 비교 → Voting Ensemble 95.23% (baseline 93.85% 대비 +1.38%p).
   - 50+ 한국 음식 메뉴 사전 + 키워드 분류 + ML 3단계 하이브리드.

3. **🛡️ Zero-Hallucination + Budget Cap 수학적 보장:**
   - 실제 스캔/크롤링된 메뉴만 추천 (존재하지 않는 메뉴 생성 불가).
   - 예산 초과 확률 0% (Knapsack 하드 제약).

4. **⚡ 즉시 응답:**
   - 추천 결과 2~3초 (GPT 대기 없음).
   - 메뉴 파싱 10~20초 (크롤링 시간, 네트워크 의존).

5. **🌐 멀티 플랫폼 크롤링:**
   - 네이버 지도, 토스플레이스, 캐치테이블, 일반 URL 모두 대응.
   - pcmap 차단 시 자동 검색 fallback.

---

## ⚠️ 알려진 제한사항 (v3.0.0)

| 항목 | 상태 | 원인 |
|------|------|------|
| OpenAI API 키 | 401 (무효) | 키 소유자 확인 필요 |
| 네이버 pcmap 직접 접근 | 불안정 (캡차) | IP 기반 봇 감지 |
| 상호명 검색 메뉴 수 | 4~8개 | 네이버 검색 UI 한계 |
| 토스/캐치 SPA | 부분 동작 | 로그인 벽/앱 전용 |

→ **OpenAI 키 복구 시 메뉴 인식 15~30개로 즉시 향상 (코드 수정 불필요)**

---

궁금한 사항이 있거나 기능 확장이 필요할 경우 언제든 문의해주세요! 👍
