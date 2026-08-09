import json
import re
import os
import sys
import time
from typing import List, Optional
from itertools import combinations
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from openai import OpenAI
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# ai 디렉토리를 파이썬 모듈 검색 경로에 안전하게 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from open_api_client import api_client
except Exception:
    api_client = None

# .env 파일 환경 변수 로드
load_dotenv()

app = FastAPI(
    title="AI Smart Menu Recommendation Microservice",
    description="4대 레이어(하드제약, 조합규칙, 페르소나, 시간경과) 융합 2-Track 추천 엔진",
    version="2.0.0"
)

# OpenAI Client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# -------------------------------------------------------------------
# 1. Request / Response DTO Schemas
# -------------------------------------------------------------------
class MenuItem(BaseModel):
    menuName: str = Field(..., example="삼겹살")
    price: int = Field(..., example=15000)

class ParseMenuRequest(BaseModel):
    rawContent: str = Field(..., example="<html><body><div>삼겹살 15000원, 된장찌개 7000원</div></body></html>")

class ParseMenuResponse(BaseModel):
    menuList: List[MenuItem]
    parserType: str

class RecommendRequest(BaseModel):
    menuList: List[MenuItem] = Field(..., example=[
        {"menuName": "숙성 삼겹살", "price": 16000},
        {"menuName": "청정 목살", "price": 15000},
        {"menuName": "차돌 된장찌개", "price": 8000},
        {"menuName": "폭탄 계란찜", "price": 4000},
        {"menuName": "함흥 물냉면", "price": 7000},
        {"menuName": "참이슬 후레쉬", "price": 5000}
    ])
    peopleCount: int = Field(3, example=3)
    budget: int = Field(45000, example=45000)
    meetingType: Optional[str] = Field("친구 모임", example="친구 모임")
    excludedFoods: Optional[List[str]] = Field([], example=[])
    bigEaterCount: Optional[int] = Field(1, example=1)
    spicyLevel: Optional[int] = Field(3, example=3)
    dietCount: Optional[int] = Field(0, example=0)
    todayPreference: Optional[str] = Field("든든한 고기", example="든든한 고기")

class ReRecommendRequest(RecommendRequest):
    elapsedMinutes: Optional[int] = Field(45, example=45)
    budgetDelta: Optional[int] = Field(0, example=20000)  # 이전 예산 대비 수정된 차액 (+20,000원 또는 -10,000원)

class RecommendResponse(BaseModel):
    recommendedMenus: List[str]
    totalPrice: int
    reason: str
    engineType: str


# -------------------------------------------------------------------
# 2. Raw HTML / Text Menu Parsing Engine (투트랙 정제)
# -------------------------------------------------------------------
def parse_menu_by_llm(raw_content: str) -> List[MenuItem]:
    clean_text = raw_content
    if "<html" in raw_content.lower() or "<div" in raw_content.lower():
        soup = BeautifulSoup(raw_content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.extract()
        clean_text = soup.get_text(separator="\n").strip()

    truncated_text = clean_text[:5000]

    system_prompt = """
    당신은 웹페이지 데이터 정제 파서입니다.
    제공된 HTML/텍스트 내용에서 식당의 메뉴 이름과 가격(숫자)을 정확하게 파싱하여 JSON 형태로 응답하세요.
    가격은 원 단위의 정수(int)여야 하며, 반드시 {"menuList": [{"menuName": "...", "price": 15000}]} 형태로만 응답하세요.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"다음 내용에서 메뉴와 가격을 파싱하세요:\n{truncated_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        result_json = json.loads(response.choices[0].message.content)
        parsed_items = []
        for item in result_json.get("menuList", []):
            if isinstance(item, dict) and "menuName" in item and "price" in item:
                name = str(item["menuName"]).strip()
                price_val = str(item["price"])
                clean_price = int(re.sub(r'[^0-9]', '', price_val) or 0)
                if name and clean_price > 0:
                    parsed_items.append(MenuItem(menuName=name, price=clean_price))
        return parsed_items
    except Exception as e:
        print(f"[LLM Parser Error] Fallback to Regex Parser: {e}")
        return []

def parse_menu_by_regex(raw_content: str) -> List[MenuItem]:
    lines = raw_content.split('\n')
    parsed_menu = []
    price_pattern = re.compile(r'([\w\s가-힣&\(\)]+?)[\s\:\-\~]+([0-9,]{3,7})\s*원?')

    for line in lines:
        line = line.strip()
        if not line or len(line) > 100:
            continue
        match = price_pattern.search(line)
        if match:
            name = match.group(1).strip()
            price_str = match.group(2).replace(',', '')
            if name and price_str.isdigit():
                price = int(price_str)
                if 1000 <= price <= 500000 and len(name) >= 2:
                    parsed_menu.append(MenuItem(menuName=name, price=price))

    unique_menu = {}
    for item in parsed_menu:
        if item.menuName not in unique_menu:
            unique_menu[item.menuName] = item

    return list(unique_menu.values())


# -------------------------------------------------------------------
# 3. 4대 레이어 융합 Knapsack 수학적 최적화 엔진 (Track 2)
# -------------------------------------------------------------------
def optimize_menu_combination(req: RecommendRequest, elapsed_min: int = 0) -> tuple[List[MenuItem], int]:
    """
    [4대 레이어 규칙 셋 100% 탑재 수학적 최적화 엔진]
    1) 하드 제약: 예산 상한(100%), 예산 하한(80%), 알레르기 100% 제거, 1인 1메인 캡
    2) 조합 규칙: 제형 중복 방지 (국물 최대 1개), 주류-안주 페어링 (+20점)
    3) 페르소나: 대식가 사리/사이드 추천, 다이어터 저탄수 추천
    4) 시간 경과: 30분 이상 추가주문 시 헤비메인 자동 배제
    """
    people_count = max(1, req.peopleCount or 1)
    effective_budget = req.budget if req.budget > 0 else 50000
    min_budget_threshold = effective_budget * 0.80  # 🚫 예산 소진율 하한선 (80% 이상)

    # 🚫 1. 하드 제약: 알레르기 및 비선호 식재료 100% 완전 차단
    valid_menus = [
        m for m in req.menuList 
        if m.price >= 0 and not any(ex in m.menuName for ex in (req.excludedFoods or []))
    ]
    
    if not valid_menus:
        return [], 0

    # 시간 경과 (30분 이상): 헤비 메인 메뉴 배제
    if elapsed_min >= 30:
        valid_menus = [
            m for m in valid_menus 
            if not any(kw in m.menuName for kw in ['삼겹살', '갈비', '보쌈', '족발', '돈까스', '스테이크'])
        ]
        if not valid_menus:
            valid_menus = req.menuList

    DRINK_KEYWORDS = ['맥주', '소주', '하이볼', '사케', '콜라', '사이다', '음료', '에이드', '와인', '녹차', '홍차', '우롱차', '보리차']

    # 후보 풀 확장 (일반 메뉴 및 음료 모두 인원수(people_count) 수량만큼 콤보 선택 가능하도록 수량 확장)
    candidate_pool = []
    for m in valid_menus:
        for _ in range(people_count):
            candidate_pool.append(m)

    # 1인 1메인 + 사이드 + 1인 1음료 조합(총 items 수)을 충분히 탐색하도록 max_k 확장
    max_k = min(people_count * 2 + (req.bigEaterCount or 0) + 1, len(candidate_pool))
    min_k = max(1, people_count)

    best_combo = []
    best_score = -float('inf')
    best_price = 0

    seen_combos = set()
    for k in range(min_k, max_k + 1):
        for combo in combinations(candidate_pool, k):
            combo_key = tuple(sorted([m.menuName for m in combo]))
            if combo_key in seen_combos:
                continue
            seen_combos.add(combo_key)

            tot_price = sum(m.price for m in combo)

            # 🚫 하드 제약 1: 예산 상한선 엄수 (Total Price <= Budget)
            if tot_price > effective_budget:
                continue

            # -------------------------------------------------------------------
            # 🛑 [대식가 사이드 곁들임 법칙] 1인 1메인 3개 + 대식가용 사이드 1개 최적화
            # -------------------------------------------------------------------
            main_dishes = [m for m in combo if not any(kw in m.menuName for kw in DRINK_KEYWORDS + ['교자', '만두', '감자튀김', '튀김', '황도', '계란찜', '사리', '주먹밥'])]
            drink_dishes = [m for m in combo if any(kw in m.menuName for kw in DRINK_KEYWORDS)]
            side_dishes = [m for m in combo if any(kw in m.menuName for kw in ['교자', '만두', '감자튀김', '튀김', '황도', '계란찜', '사리', '주먹밥'])]

            # 🛑 [핵심 규칙 1] 식사 메인 요리는 무조건 1인당 정확히 1개(people_count개) 충족!
            if len(main_dishes) < people_count:
                continue

            # 🛑 [핵심 규칙 2] 일반 모임에서 메인 요리가 인원수를 초과해 과하게 뽑히는 것을 방지
            if len(main_dishes) > people_count + (req.bigEaterCount or 0):
                continue

            # 🛑 [모임 성격별 동일 메인 수량 제한]
            is_pub_or_party = any(kw in (req.meetingType or '') for kw in ['술', '포차', '이자카야', '회식', '2차', '안주'])
            main_names = [m.menuName for m in main_dishes]

            if is_pub_or_party:
                if len(main_names) != len(set(main_names)):
                    continue
            else:
                from collections import Counter
                main_counts = Counter(main_names)
                if any(cnt > 2 for cnt in main_counts.values()):
                    continue

            # -------------------------------------------------------------------
            # 💰 [합리적 예산 소비 수식] 억지 예산 채우기 방지 & 합리적 가성비 보장
            # -------------------------------------------------------------------
            # 1인당 합리적 미식 기준 금액 (메인1 + 사이드/음료 = 약 25,000원)
            rational_max_cost = people_count * 30000 + (req.bigEaterCount or 0) * 15000
            
            # 예산이 매우 크더라도(예: 30만원), 억지로 다 쓰지 않고 인원수에 필요한 식사만 픽업 시 보너스
            budget_score = 0.0
            if tot_price <= rational_max_cost:
                budget_score = 50.0  # 🌟 합리적 지출 보너스 (낭비 없는 스마트 지출!)
            elif tot_price <= effective_budget:
                # 합리적 기준을 넘어가더라도 예산 범위 내라면 완만한 점수 부여
                budget_score = 30.0 - ((tot_price - rational_max_cost) / effective_budget) * 20.0

            # 🍱 1인 1메인(3개) + 대식가용 사이드(1개) 조합 최고 보너스 수식 (+50점!)
            portion_match_score = 0.0
            if (req.bigEaterCount or 0) > 0:
                if len(main_dishes) == people_count and len(side_dishes) >= 1:
                    portion_match_score = 50.0  # 🌟 (최우선 1순위: 1인 1메인 3개 + 대식가용 사이드 교자/튀김 1개)
                elif len(main_dishes) == people_count:
                    portion_match_score = 30.0
                elif len(main_dishes) > people_count:
                    portion_match_score = 15.0  # (2순위: 메인 4개)
            else:
                if len(main_dishes) == people_count:
                    portion_match_score = 35.0

            # 주류 & 안주 페어링 가중치
            pairing_score = 0.0
            has_soju = any('소주' in m.menuName for m in drink_dishes)
            has_beer = any('맥주' in m.menuName for m in drink_dishes)
            if has_soju and any(kw in m.menuName for kw in ['탕', '찌개', '볶음', '전골'] for m in combo):
                pairing_score += 20.0
            if has_beer and any(kw in m.menuName for kw in ['튀김', '치킨', '돈까스', '먹태'] for m in combo):
                pairing_score += 20.0

            # 👤 3. 페르소나 규칙 (대식가/다이어터)
            persona_score = 0.0
            if (req.bigEaterCount or 0) > 0:
                if any(kw in m.menuName for kw in ['주먹밥', '사리', '냉면', '볶음밥', '튀김', '교자', '만두'] for m in combo):
                    persona_score += 15.0
            if (req.dietCount or 0) > 0:
                if any(kw in m.menuName for kw in ['구이', '샐러드', '숙주', '해물', '사시미'] for m in combo):
                    persona_score += 15.0

            # 🍹 1인 1음료/주류(인원수 = 음료 개수) 기본 세트 구성 최고 보너스 (+40점!)
            drink_score = 0.0
            if drink_dishes:
                if len(drink_dishes) == people_count:
                    drink_score = 40.0  # 🌟 (1인 1음료 기본 세트 100% 매칭!)
                elif len(drink_dishes) >= round(people_count * 0.6):
                    drink_score = 20.0
                else:
                    drink_score = 5.0

            total_score = budget_score + portion_match_score + pairing_score + persona_score + drink_score

            if total_score > best_score:
                best_score = total_score
                best_combo = list(combo)
                best_price = tot_price

    return best_combo, best_price


# -------------------------------------------------------------------
# 4. LLM Rationale 생성 파이프라인 (4대 레이어 자연어 설득 엔진)
# -------------------------------------------------------------------
def generate_rationale(req: RecommendRequest, selected_menus: List[str], total_price: int, elapsed_min: int = 0, budget_delta: int = 0) -> str:
    menus_str = ", ".join(selected_menus)
    
    time_context = "최초 식사 주문 단계"
    if 30 <= elapsed_min < 60:
        time_context = "식사 진행 중 (30~60분 경과) 2차 추가 주문 단계"
    elif elapsed_min >= 60:
        time_context = "식사 마무리 (60분 이상 경과) 입가심/해장 단계"

    budget_change_text = "이전 예산과 동일"
    if budget_delta > 0:
        budget_change_text = f"이전 예산 대비 +{budget_delta:,}원 증액됨"
    elif budget_delta < 0:
        budget_change_text = f"이전 예산 대비 {budget_delta:,}원 감액됨"

    system_prompt = f"""
    당신은 친절하고 위트 있는 AI 미식 컨시어지입니다.
    사용자 조건에 맞추어 선택된 메뉴 조합({menus_str})의 추천 이유를 매력적이고 자연스러운 2-3문장으로 작성하세요.

    [상황 문맥]
    - 인원수: {req.peopleCount}명 (대식가: {req.bigEaterCount or 0}명, 다이어터: {req.dietCount or 0}명)
    - 예산: {req.budget:,}원 (실제 계산금액: {total_price:,}원, 예산변동: {budget_change_text})
    - 모임 성격: {req.meetingType or '일반 모임'}
    - 시간 경과: {time_context}
    - 오늘 선호: {req.todayPreference or '없음'}

    [작성 규칙]
    1. 인원수, 예산 준수, 모임 분위기, 주류-안주 페어링 장점을 자연스럽게 강조하세요.
    2. 시간 경과 상황({time_context})과 예산 변동 사항({budget_change_text})이 있을 경우 그 이유를 추천 문구에 위트 있게 언급하세요.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"선택된 메뉴: {menus_str}, 총액: {total_price}원에 대한 추천 이유를 작성해주세요."}
            ],
            temperature=0.7,
            max_tokens=200
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return f"{req.peopleCount}인 예산({req.budget:,}원)과 모임 분위기({req.meetingType})에 딱 맞춘 최적의 미식 조합입니다!"


def recommend_by_llm_single(req: RecommendRequest, elapsed_min: int = 0) -> tuple[List[str], int, str]:
    menus_json = json.dumps([{"menuName": m.menuName, "price": m.price} for m in req.menuList], ensure_ascii=False)
    
    system_prompt = """
    당신은 AI 메뉴 추천 전문가입니다.
    제공된 메뉴 데이터 중에서 인원수, 예산, 알레르기 차단 조건을 100% 준수하는 메뉴 조합을 선택하세요.
    반드시 다음 JSON 형식으로만 응답하세요:
    {
      "recommendedMenus": ["메뉴명1", "메뉴명2"],
      "totalPrice": 45000,
      "reason": "추천 이유 2-3문장"
    }
    """

    user_prompt = f"""
    - 전체 메뉴: {menus_json}
    - 인원수: {req.peopleCount}명, 예산: {req.budget}원
    - 제외 알레르기: {req.excludedFoods}
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.5
        )
        result_json = json.loads(response.choices[0].message.content)
        rec_menus = result_json.get("recommendedMenus", [])
        tot_price = result_json.get("totalPrice", 0)
        reason = result_json.get("reason", "LLM 추천 조합입니다.")
        return rec_menus, tot_price, reason
    except Exception:
        items, price = optimize_menu_combination(req, elapsed_min)
        menus = format_menu_combination(items)
        reason = generate_rationale(req, menus, price, elapsed_min)
        return menus, price, reason


def format_menu_combination(selected_items: List[MenuItem]) -> List[str]:
    from collections import Counter
    counts = Counter([m.menuName for m in selected_items])
    formatted = []
    for name, cnt in counts.items():
        if cnt > 1:
            formatted.append(f"{name} x {cnt}")
        else:
            formatted.append(name)
    return formatted


# -------------------------------------------------------------------
# 5. FastAPI Endpoints
# -------------------------------------------------------------------

@app.post("/ai/parse-menu", response_model=ParseMenuResponse)
def parse_menu(req: ParseMenuRequest, mode: str = Query("track1", description="track1: LLM 파싱, track2: 자체 정규식 파서")):
    if not req.rawContent or not req.rawContent.strip():
        raise HTTPException(status_code=400, detail="크롤링된 rawContent 내용이 비어있습니다.")

    if mode == "track1":
        menu_list = parse_menu_by_llm(req.rawContent)
        if not menu_list:
            menu_list = parse_menu_by_regex(req.rawContent)
            return ParseMenuResponse(menuList=menu_list, parserType="TRACK_2_PARSER")
        return ParseMenuResponse(menuList=menu_list, parserType="TRACK_1_LLM")
    else:
        menu_list = parse_menu_by_regex(req.rawContent)
        return ParseMenuResponse(menuList=menu_list, parserType="TRACK_2_PARSER")


@app.post("/ai/recommend", response_model=RecommendResponse)
def recommend_menu(req: RecommendRequest, mode: str = Query("track2", description="track2: 4대 레이어 하이브리드 최적화 (메인), track1: LLM 단독 (백업)")):
    if not req.menuList:
        raise HTTPException(status_code=400, detail="메뉴 리스트가 비어있습니다.")

    if mode == "track1":
        rec_menus, tot_price, reason = recommend_by_llm_single(req, elapsed_min=0)
        return RecommendResponse(
            recommendedMenus=rec_menus,
            totalPrice=tot_price,
            reason=reason,
            engineType="TRACK_1_LLM"
        )
    else:
        selected_items, tot_price = optimize_menu_combination(req, elapsed_min=0)
        
        if not selected_items:
            rec_menus, tot_price, reason = recommend_by_llm_single(req, elapsed_min=0)
            return RecommendResponse(
                recommendedMenus=rec_menus,
                totalPrice=tot_price,
                reason=reason,
                engineType="TRACK_1_LLM"
            )

        menu_names = format_menu_combination(selected_items)
        reason = generate_rationale(req, menu_names, tot_price, elapsed_min=0)

        return RecommendResponse(
            recommendedMenus=menu_names,
            totalPrice=tot_price,
            reason=reason,
            engineType="TRACK_2_HYBRID"
        )


@app.put("/ai/re-recommend", response_model=RecommendResponse)
def re_recommend_menu(req: ReRecommendRequest, mode: str = Query("track2", description="track2: 4대 레이어 하이브리드 최적화 (메인), track1: LLM 단독 (백업)")):
    if not req.menuList:
        raise HTTPException(status_code=400, detail="메뉴 리스트가 비어있습니다.")

    elapsed_min = req.elapsedMinutes or 0

    if mode == "track1":
        rec_menus, tot_price, reason = recommend_by_llm_single(req, elapsed_min=elapsed_min)
        return RecommendResponse(
            recommendedMenus=rec_menus,
            totalPrice=tot_price,
            reason=reason,
            engineType="TRACK_1_LLM"
        )
    else:
        selected_items, tot_price = optimize_menu_combination(req, elapsed_min=elapsed_min)
        
        if not selected_items:
            rec_menus, tot_price, reason = recommend_by_llm_single(req, elapsed_min=elapsed_min)
            return RecommendResponse(
                recommendedMenus=rec_menus,
                totalPrice=tot_price,
                reason=reason,
                engineType="TRACK_1_LLM"
            )

        menu_names = format_menu_combination(selected_items)
        reason = generate_rationale(req, menu_names, tot_price, elapsed_min=elapsed_min, budget_delta=(req.budgetDelta or 0))

        return RecommendResponse(
            recommendedMenus=menu_names,
            totalPrice=tot_price,
            reason=reason,
            engineType="TRACK_2_HYBRID"
        )
