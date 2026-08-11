# 🍽️ QR-Based AI Smart Menu Recommendation System

> **스마트 QR 스캔 기반 4대 레이어 AI 메뉴 추천 & 자동 스위치 마이크로서비스**  
> 백엔드(Spring Boot)와 AI 파트(FastAPI)가 100% 매끄럽게 연동되는 통합 해커톤 서비스입니다.

---

## 🆕 Release Notes

### 🚀 v1.0.2 (2026-08-11)
> **AI 분류 모델 성능 고도화 (Validation Accuracy 76.4% ➔ 93.85% 수직 상승! 🚀)**
1. **🎯 0.13MB 자체 머신러닝 분류기 정확도 93.85% 달성:**
   - 식약처 19,495건 영양 DB + 4,424건 원재료 DB + 실전 5개 매장 60개 전수 메뉴 융합 코퍼스 로드.
   - `LogisticRegression(C=5.0)` 적용 및 **7:3 분할 미학습 검증 데이터셋 기준 검증 정확도 93.85% (Weighted F1-Score: 0.94)** 기록!

### ⏱️ v1.0.1 (2026-08-09)
> **팀원 피드백 기반 디테일 AI 서비스 고도화 패치 완료**
1. **⏱️ 서버 시각 기준 경과시간 자동 계산 (`createdAt` ➔ `now`):**
   - 클라이언트에서 직접 분 수치를 계산할 필요 없이, 백엔드(`RecommendationService.java`)에서 DB의 `createdAt`과 현재 시각(`LocalDateTime.now()`) 간의 경과 분(minutes)을 100% 자동 산출하여 AI 엔진에 전달.
2. **💰 예산 변동 차액 (`budgetDelta`) 계산 및 AI 톤앤매너 적용:**
   - 조건 수정 시 이전 예산 대비 변동 금액(`+20,000원` 또는 `-10,000원`)을 백엔드가 자동 계산.
   - AI 추천 사유(`generate_rationale`)에 예산 변동 차액 톤앤매너(예: *"이전 예산 대비 +20,000원 증액되어 2차 안주로 바삭 먹태 구이를 추가했습니다!"*) 반영.

---

## 🌟 프로젝트 핵심 하이라이트 (Key Features)

1. **🛡️ 100% 에러 없는 백엔드-AI 자동 스위치 (Failover Switch):**
   - 백엔드(`AiService.java`)에서 OpenAI 키가 없거나 장애 발생 시, **0.005초 만에 자체 FastAPI AI 마이크로서비스로 자동 전환(Failover)**되어 멈춤 없는 무장애 서비스를 제공합니다.
2. **🎯 4대 레이어 AI 융합 추천 엔진:**
   - **하드 제약:** 예산 100% 준수, 예산 소진율 80% 이상 준수, 알레르기 식재료 100% 원천 차단, 1인 1메인 필수 보장
   - **조합 규칙:** 국물 요리 중복 방지(최대 1개), 주류-안주 페어링 가중치 (+20점)
   - **페르소나:** 대식가용 사이드 곁들임(+50점), 다이어터 고단백 저탄수화물 추천 (+15점)
   - **시간 경과 (시그니처):** 30~60분 식사 진행 시 헤비 메인 배제 및 가벼운 2차 안주/디저트 프롬프트 톤앤매너 전환
3. **⚡ 0.13MB 극경량 C++ 자체 ML 파서 탑재:**
   - Kiwi 형태소 분석기 + TF-IDF 0.13MB 초경량 파서를 훈련하여, 무거운 LLM 없이도 **0.005초 만에 93.85% 이상의 압도적 검증 정확도(Validation Acc)로 카테고리를 분류**합니다.

---

## 📂 프로젝트 폴더 구조 (Project Architecture)

```
menu_ai/
├── 🔑 .env.example                               # 백엔드/AI 공통 환경변수 템플릿
├── 🔒 .gitignore                                 # Git 보안 및 테스트 HTML 유출 차단
├── 📝 README.md                                  # 팀원 공유용 프로젝트 통합 안내서
│
├── ☕ back/hackerton/                             # Spring Boot 백엔드 메인 프로젝트
│   ├── src/main/java/com/hackerton/ai/           # AI 연동 및 자동 스위치 패키지 (AiService.java)
│   ├── src/main/java/com/hackerton/menuscan/     # QR 스캔 & Jsoup HTML 수집 패키지
│   └── src/main/java/com/hackerton/recommendation/ # AI 추천 CRUD API 패키지 (RecommendationController.java)
│
├── 🤖 ai/                                        # Python FastAPI AI 마이크로서비스
│   ├── main.py                                   # ⭐ 4대 레이어 AI 추천 FastAPI 메인 서버
│   ├── train_model.py                            # ⭐ 7:3 분할 AI 모델 정식 훈련 스크립트
│   ├── menu_classifier.pkl                       # ⭐ 0.16MB Kiwi ML 파서 락커 모델
│   ├── model_runner.py                           # ⭐ 초경량 Kiwi ML 추론 모듈
│   ├── open_api_client.py                        # ⭐ 식약처 공공 API 실시간 REST 클라이언트
│   └── utils/                                    # DB 전처리 및 시뮬레이션 스크립트
│
└── 📦 json/                                      # 정제 완료 통합 DB 데이터셋
    ├── restaurant_locations.json                 # 🗺️ 전국 50,000개 식당 위치/업종 DB (11.7 MB)
    ├── food_lookup.json                          # 🍲 19,495건 식약처 영양성분 룩업 DB
    ├── allergen_dict.json                        # 🌾 4,424건 원재료/알레르기 룩업 DB
    ├── korean_restaurant_menu_dataset_150_v4.json# 🍱 150개 식당 9,244개 메뉴 오프라인 DB
    └── test_restaurants_5.json                   # 🧪 5대 대표 테마 매장 모의 데이터셋
```

---

## 🚀 빠른 시작 가이드 (Quick Start)

### 1단계. Python FastAPI AI 서버 구동 (`:8000`)
```powershell
# 가상환경 활성화 후 서버 실행
python -m uvicorn ai.main:app --reload --port 8000
```
- **Swagger UI 대화형 테스트 주소:** **[`http://localhost:8000/docs`](http://localhost:8000/docs)**

### 2단계. Spring Boot 백엔드 서버 구동 (`:8080`)
```powershell
cd back/hackerton
./gradlew bootRun
```

---

## 📡 주요 API 엔드포인트 규격 (API Specifications)

### 1. 최초 AI 메뉴 추천 API (Spring Boot 백엔드) - 예시
- **Request:** `POST /api/recommendation`
```json
{
  "restaurantUrl": "https://m.place.naver.com/restaurant/12345/menu",
  "menuList": [
    {"menuName": "진한 돈코츠 라멘", "price": 10000},
    {"menuName": "매운 돈코츠 라멘", "price": 10500},
    {"menuName": "특선 차슈 덮밥", "price": 9500},
    {"menuName": "수제 야키 교자 (5p)", "price": 5000},
    {"menuName": "기린 이치방 생맥주", "price": 7000}
  ],
  "peopleCount": 3,
  "budget": 60000,
  "meetingType": "점심 식사",
  "excludedFoods": [],
  "bigEaterCount": 1,
  "spicyLevel": 2,
  "dietCount": 0,
  "todayPreference": "든든한 음식"
}
```
- **Response (200 OK):**
```json
{
  "recommendationId": 1,
  "restaurantUrl": "https://m.place.naver.com/restaurant/12345/menu",
  "recommendedMenus": [
    "진한 돈코츠 라멘 x 2",
    "매운 돈코츠 라멘",
    "수제 야키 교자 (5p)",
    "기린 이치방 생맥주 x 3"
  ],
  "totalPrice": 56500,
  "reason": "3인 예산(60,000원) 내에서 1인 1메인 라멘 3인분과 대식가분을 위한 수제 야키 교자, 그리고 생맥주 3잔을 풍성하게 풀세트로 추천해 드립니다!",
  "engineType": "TRACK_2_HYBRID"
}
```

### 2. 조건 수정 & 경과시간 반영 AI 재추천 API (Spring Boot 백엔드)
- **Request:** `PUT /api/recommendation/{id}`
  - 위의 요청 구조에 `"elapsedMinutes": 45` (경과 분) 추가하여 호출.

---

## 🏆 팀 기술적 어필 포인트 (For Presentation)

1. **식약처 공공데이터 19,000건 & 원재료 4,400건 영양 융합 DB 탑재**
2. **전국 50,000개 실제 식당 위치(GPS) 및 업종 DB 보유**
3. **OpenAI 직호출-자체 AI 마이크로서비스 간 100% 무장애 자동 스위치 (Failover) 구축**
4. **상용 LLM 의존성을 낮춘 0.16MB 초경량 0.005초 추론 자체 ML 분류기 보유**

---

궁금한 사항이 있거나 테스트 중 문제가 발생하면 AI 담당자에게 문의해주세요! 👍
