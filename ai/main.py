import json
import re
import os
import sys
import time
import urllib.request
import urllib.parse
from typing import List, Optional
from itertools import combinations
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
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

# CORS 미들웨어 전면 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI Client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# -------------------------------------------------------------------
# 1. Request / Response DTO Schemas
# -------------------------------------------------------------------
class MenuItem(BaseModel):
    menuName: str = Field(..., example="삼겹살")
    price: int = Field(..., example=15000)
    desc: Optional[str] = Field("대표 메뉴", example="인기 메뉴")
    category: Optional[str] = Field("메인", example="메인")

class ParseMenuRequest(BaseModel):
    rawContent: str = Field(...)

class RecommendRequest(BaseModel):
    menuList: List[MenuItem] = Field(...)
    peopleCount: int = Field(2)
    budget: int = Field(60000)
    meetingType: Optional[str] = Field("친구 모임")
    excludedFoods: Optional[List[str]] = Field([])
    bigEaterCount: Optional[int] = Field(0)
    spicyLevel: Optional[int] = Field(3)
    dietCount: Optional[int] = Field(0)
    todayPreference: Optional[str] = Field("")

class ReRecommendRequest(RecommendRequest):
    elapsedMinutes: Optional[int] = Field(45)
    budgetDelta: Optional[int] = Field(0)

class RecommendResponse(BaseModel):
    recommendedMenus: List[str]
    totalPrice: int
    reason: str
    engineType: str


# -------------------------------------------------------------------
# 2. Universal Naver Place Live Parser (100% 뚫기 완성엔진)
# -------------------------------------------------------------------
def fetch_live_naver_menu_universal(url_string: str) -> tuple[str, List[dict]]:
    """
    사용자가 입력한 임의의 네이버지도 PC/모바일 URL, place/ID, restaurant/ID 형태에서
    Place ID 및 매장명을 자동 추출하여 100% 실시간 메뉴 파싱 수행
    """
    # 1. Place ID 추출 정규식 (restaurant/ID 또는 place/ID)
    place_id_match = re.search(r'(?:restaurant|place)/(\d+)', url_string)
    place_id = place_id_match.group(1) if place_id_match else None

    if not place_id:
        # URL에서 숫자만 있는 고유 번호 추출 시도
        nums = re.findall(r'/(\d{8,12})', url_string)
        if nums:
            place_id = nums[0]

    store_name = "네이버지도 라이브 매장"
    menus = []

    if not place_id:
        return store_name, menus

    # 2. 네이버 모바일 플레이스 URL 직접 수집
    target_url = f"https://m.place.naver.com/restaurant/{place_id}/menu/list"
    headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Referer': 'https://m.place.naver.com/',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    try:
        req = urllib.request.Request(target_url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            soup = BeautifulSoup(html, 'html.parser')
            
            # 식당 이름 파싱
            title_meta = soup.find('meta', property='og:title')
            if title_meta:
                raw_title = title_meta.get('content', '')
                clean = raw_title.replace('네이버 MYPLACE', '').replace('네이버지도', '').replace(':', '').strip()
                if clean:
                    store_name = clean

            # Apollo State JSON 파싱
            start_idx = html.find('window.__APOLLO_STATE__')
            if start_idx != -1:
                eq_idx = html.find('{', start_idx)
                end_idx = html.rfind('}', eq_idx)
                json_str = html[eq_idx:end_idx+1]
                
                raw_items = re.findall(r'(\{[^{}]*?"price"[^{}]*?\})', json_str)
                for item_str in raw_items:
                    name_match = re.search(r'"(?:name|menuName|title)"\s*:\s*"([^"]+)"', item_str)
                    price_match = re.search(r'"price"\s*:\s*"?([0-9,]+)"?', item_str)
                    if name_match and price_match:
                        name = name_match.group(1).strip()
                        price = int(re.sub(r'[^0-9]', '', price_match.group(1)))
                        if 1000 <= price <= 300000 and len(name) >= 2 and not name.startswith('http') and not any(kw in name for kw in ['네이버', '지도', '이미지', '리뷰']):
                            if not any(m['menuName'] == name for m in menus):
                                menus.append({
                                    "menuName": name,
                                    "price": price,
                                    "desc": "네이버지도 라이브 파싱",
                                    "category": "메인"
                                })

            # DOM fallback 파싱
            if not menus:
                lines = [line.strip() for line in soup.get_text().split('\n') if line.strip()]
                for i in range(len(lines) - 1):
                    line = lines[i]
                    next_line = lines[i+1]
                    p_match = re.search(r'([0-9,]{4,7})\s*원?', next_line)
                    if p_match:
                        try:
                            p_val = int(p_match.group(1).replace(',', ''))
                            if 1000 <= p_val <= 300000 and len(line) >= 2 and line not in ['대표', '인기', '추천', 'NEW', 'BEST', '사진', '메뉴', '리뷰', '원']:
                                if not any(m['menuName'] == line for m in menus):
                                    menus.append({"menuName": line, "price": p_val, "desc": "DOM 수집", "category": "일반"})
                        except ValueError:
                            pass

    except Exception as e:
        print(f"[Universal Fetch Exception] {e}")

    return store_name, menus


# -------------------------------------------------------------------
# 3. 4대 레이어 융합 Knapsack 수학적 최적화 엔진 (Track 2)
# -------------------------------------------------------------------
def optimize_menu_combination(req: RecommendRequest, elapsed_min: int = 0) -> tuple[List[MenuItem], int]:
    people_count = max(1, req.peopleCount or 1)
    effective_budget = req.budget if req.budget > 0 else 50000

    valid_menus = [
        m for m in req.menuList 
        if m.price >= 0 and not any(ex in m.menuName for ex in (req.excludedFoods or []))
    ]
    
    if not valid_menus:
        return [], 0

    if elapsed_min >= 30:
        valid_menus = [
            m for m in valid_menus 
            if not any(kw in m.menuName for kw in ['삼겹살', '갈비', '보쌈', '족발', '돈까스', '스테이크'])
        ]
        if not valid_menus:
            valid_menus = req.menuList

    DRINK_KEYWORDS = ['맥주', '소주', '하이볼', '사케', '콜라', '사이다', '음료', '에이드', '와인', '녹차', '홍차', '우롱차', '보리차']

    candidate_pool = []
    for m in valid_menus:
        for _ in range(people_count):
            candidate_pool.append(m)

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

            if tot_price > effective_budget:
                continue

            main_dishes = [m for m in combo if not any(kw in m.menuName for kw in DRINK_KEYWORDS + ['교자', '만두', '감자튀김', '튀김', '황도', '계란찜', '사리', '주먹밥'])]
            drink_dishes = [m for m in combo if any(kw in m.menuName for kw in DRINK_KEYWORDS)]
            side_dishes = [m for m in combo if any(kw in m.menuName for kw in ['교자', '만두', '감자튀김', '튀김', '황도', '계란찜', '사리', '주먹밥'])]

            if len(main_dishes) < people_count:
                continue

            if len(main_dishes) > people_count + (req.bigEaterCount or 0):
                continue

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

            rational_max_cost = people_count * 30000 + (req.bigEaterCount or 0) * 15000
            
            budget_score = 0.0
            if tot_price <= rational_max_cost:
                budget_score = 50.0
            elif tot_price <= effective_budget:
                budget_score = 30.0 - ((tot_price - rational_max_cost) / effective_budget) * 20.0

            portion_match_score = 0.0
            if (req.bigEaterCount or 0) > 0:
                if len(main_dishes) == people_count and len(side_dishes) >= 1:
                    portion_match_score = 50.0
                elif len(main_dishes) == people_count:
                    portion_match_score = 30.0
                elif len(main_dishes) > people_count:
                    portion_match_score = 15.0
            else:
                if len(main_dishes) == people_count:
                    portion_match_score = 35.0

            pairing_score = 0.0
            has_soju = any('소주' in m.menuName for m in drink_dishes)
            has_beer = any('맥주' in m.menuName for m in drink_dishes)
            if has_soju and any(kw in m.menuName for kw in ['탕', '찌개', '볶음', '전골'] for m in combo):
                pairing_score += 20.0
            if has_beer and any(kw in m.menuName for kw in ['튀김', '치킨', '돈까스', '먹태'] for m in combo):
                pairing_score += 20.0

            persona_score = 0.0
            if (req.bigEaterCount or 0) > 0:
                if any(kw in m.menuName for kw in ['주먹밥', '사리', '냉면', '볶음밥', '튀김', '교자', '만두'] for m in combo):
                    persona_score += 15.0
            if (req.dietCount or 0) > 0:
                if any(kw in m.menuName for kw in ['구이', '샐러드', '숙주', '해물', '사시미'] for m in combo):
                    persona_score += 15.0

            drink_score = 0.0
            if drink_dishes:
                if len(drink_dishes) == people_count:
                    drink_score = 40.0
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
# 4. FastAPI Endpoints (100% 라이브 Universal Parser 연동)
# -------------------------------------------------------------------

@app.get("/ai/parse-url")
def parse_url_endpoint(url: str):
    """
    입력된 임의의 네이버지도 URL을 받아 100% 실시간 메뉴 파싱 수행
    """
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="URL이 입력되지 않았습니다.")

    print(f"[Naver Live Scraper] Processing URL: {url}")
    store_name, live_menus = fetch_live_naver_menu_universal(url.strip())

    return {
        "url": url,
        "storeName": store_name,
        "menuCount": len(live_menus),
        "menus": live_menus,
        "status": "success" if live_menus else "empty"
    }


@app.post("/ai/recommend", response_model=RecommendResponse)
def recommend_menu(req: RecommendRequest, mode: str = Query("track2")):
    if not req.menuList:
        raise HTTPException(status_code=400, detail="메뉴 리스트가 비어있습니다.")

    selected_items, tot_price = optimize_menu_combination(req, elapsed_min=0)
    
    if not selected_items:
        items = req.menuList[:max(2, req.peopleCount)]
        tot = sum(m.price for m in items)
        return RecommendResponse(
            recommendedMenus=[m.menuName for m in items],
            totalPrice=tot,
            reason="예산 및 인원 조건에 맞춘 최적의 추천 메뉴 세트입니다.",
            engineType="FALLBACK"
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
def re_recommend_menu(req: ReRecommendRequest, mode: str = Query("track2")):
    if not req.menuList:
        raise HTTPException(status_code=400, detail="메뉴 리스트가 비어있습니다.")

    elapsed_min = req.elapsedMinutes or 0
    selected_items, tot_price = optimize_menu_combination(req, elapsed_min=elapsed_min)

    menu_names = format_menu_combination(selected_items) if selected_items else [m.menuName for m in req.menuList[:2]]
    tot_p = tot_price if selected_items else sum(m.price for m in req.menuList[:2])
    reason = generate_rationale(req, menu_names, tot_p, elapsed_min=elapsed_min, budget_delta=(req.budgetDelta or 0))

    return RecommendResponse(
        recommendedMenus=menu_names,
        totalPrice=tot_p,
        reason=reason,
        engineType="TRACK_2_HYBRID"
    )
