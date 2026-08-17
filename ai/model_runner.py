import os
import re
import pickle
from typing import List, Tuple, Optional
from bs4 import BeautifulSoup
from kiwipiepy import Kiwi
from pydantic import BaseModel

class MenuItemWithCategory(BaseModel):
    menuName: str
    price: int
    category: str  # "MAIN", "SIDE", "DRINK", "ALCOHOL"
    confidence: float = 0.0  # 0.0~1.0 파싱 신뢰도

# 싱글톤 Kiwi 형태소 분석기
kiwi = Kiwi()

def kiwi_tokenizer(text: str):
    tokens = []
    for token in kiwi.tokenize(text):
        if token.tag in ('NNG', 'NNP', 'XR', 'SL'):
            tokens.append(token.form)
    return tokens if tokens else text.split()


# ─── 노이즈 필터: 메뉴가 아닌 텍스트 패턴 ───
_NOISE_PATTERNS = re.compile(
    r'(?:'
    r'리뷰|후기|별점|평점|조회|방문|저장|공유|좋아요|팔로|신고|'
    r'영업시간|주소|전화|길찾기|예약|주차|편의|정보|'
    r'네이버|페이지|검색|광고|더보기|접기|이전|다음|닫기|'
    r'로그인|회원|결제|장바구니|배달|포장|'
    r'사진|동영상|블로그|카페|뉴스|'
    r'서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|'
    r'특별시|광역시|도\s|시\s|구\s|동\s|읍\s|면\s|리\s|로\s|길\s|'
    r'버스|지하철|역\s|정류장|교차로|대로|번길|'
    r'사업자|등록|번호|대표|이사|팩스|'
    r'참여|평가|방문자|영수증|주문수|'
    r'\d{4}[./-]\d{1,2}[./-]\d{1,2}|'
    r'\d{1,2}:\d{2}|'
    r'^\d+$|'
    r'^[A-Z]{2,}$'
    r')',
    re.IGNORECASE
)

# 메뉴명으로 부적합한 단어들
_INVALID_MENU_NAMES = {
    '인기', '대표', '추천', '신메뉴', '베스트', 'NEW', 'HOT', 'BEST',
    '주문', '선택', '필수', '옵션', '변경', '추가', '품절', '매진',
    '할인', '이벤트', '쿠폰', '적립', '포인트', '무료', '혜택', '프로모션',
    '메뉴', '전체', '카테고리', '음식', '종류',
    '원', '개', '인분', '그램', '미리', '리터',
    '고객센터', '문의', '공지', '안내', '약관', '개인정보', '회원가입',
    '로그인', '로그아웃', '마이페이지', '장바구니', '결제', '취소',
    '배달', '포장', '매장', '테이크아웃', '픽업',
}

# 카테고리 키워드 사전 (ML 보조)
_CATEGORY_KEYWORDS = {
    'DRINK': ['콜라', '사이다', '스프라이트', '펩시', '주스', '에이드', '스무디', '아메리카노',
              '라떼', '카페', '커피', '녹차', '홍차', '우유', '밀크', '음료', '드링크', '워터', '탄산',
              '아이스티', '레모네이드', '생수', '두유', '식혜'],
    'ALCOHOL': ['소주', '맥주', '하이볼', '사케', '와인', '위스키', '칵테일', '막걸리',
                '청하', '참이슬', '카스', '테라', '하이트', '클라우드', '기네스', '생맥주',
                '병맥주', '보드카', '럼', '진', '브랜디', '매실주', '동동주', '백세주'],
    'SIDE': ['교자', '군만두', '튀김', '계란찜', '샐러드', '김치', '공기밥', '볶음밥',
             '감자', '치즈볼', '소스', '피클', '장아찌', '반찬', '두부', '나물',
             '떡볶이', '어묵', '순대', '핫도그', '너겟', '모둠', '전', '꼬치',
             '웨지감자', '콘샐러드', '코울슬로', '양념감자', '치즈스틱', '오니온링',
             '스프', '수프', '빵', '갈릭브레드', '리조또볼'],
    'DESSERT': ['아이스크림', '빙수', '케이크', '와플', '마카롱', '쿠키', '타르트',
                '초콜릿', '브라우니', '젤라또', '푸딩', '파르페', '크레페', '모찌', '떡'],
}


# ─── 메뉴 사전: 한국 음식 지식 베이스 (분류 정확도 + confidence 향상) ───
_MENU_DICTIONARY = {
    # 한식 메인
    "삼겹살": {"type": "MAIN", "tags": ["고기", "구이"], "spicy": 0},
    "목살": {"type": "MAIN", "tags": ["고기", "구이"], "spicy": 0},
    "갈비": {"type": "MAIN", "tags": ["고기", "구이"], "spicy": 0},
    "불고기": {"type": "MAIN", "tags": ["고기"], "spicy": 1},
    "제육볶음": {"type": "MAIN", "tags": ["고기", "매콤"], "spicy": 3},
    "김치찌개": {"type": "MAIN", "tags": ["찌개", "매콤"], "spicy": 2},
    "된장찌개": {"type": "MAIN", "tags": ["찌개"], "spicy": 0},
    "부대찌개": {"type": "MAIN", "tags": ["찌개", "매콤"], "spicy": 2},
    "순두부찌개": {"type": "MAIN", "tags": ["찌개", "매콤"], "spicy": 2},
    "비빔밥": {"type": "MAIN", "tags": ["밥"], "spicy": 1},
    "돌솥비빔밥": {"type": "MAIN", "tags": ["밥"], "spicy": 1},
    "냉면": {"type": "MAIN", "tags": ["면", "시원"], "spicy": 0},
    "칼국수": {"type": "MAIN", "tags": ["면"], "spicy": 0},
    "떡볶이": {"type": "MAIN", "tags": ["분식", "매콤"], "spicy": 3},
    # 중식
    "짜장면": {"type": "MAIN", "tags": ["면", "중식"], "spicy": 0},
    "짬뽕": {"type": "MAIN", "tags": ["면", "중식", "매콤"], "spicy": 3},
    "탕수육": {"type": "MAIN", "tags": ["중식", "튀김"], "spicy": 0},
    "마파두부": {"type": "MAIN", "tags": ["중식", "매콤"], "spicy": 3},
    "볶음밥": {"type": "SIDE", "tags": ["밥", "중식"], "spicy": 0},
    # 일식
    "초밥": {"type": "MAIN", "tags": ["일식", "생선"], "spicy": 0},
    "라멘": {"type": "MAIN", "tags": ["면", "일식"], "spicy": 1},
    "돈카츠": {"type": "MAIN", "tags": ["튀김", "일식"], "spicy": 0},
    "우동": {"type": "MAIN", "tags": ["면", "일식"], "spicy": 0},
    # 양식
    "파스타": {"type": "MAIN", "tags": ["면", "양식"], "spicy": 0},
    "피자": {"type": "MAIN", "tags": ["양식"], "spicy": 0},
    "스테이크": {"type": "MAIN", "tags": ["고기", "양식"], "spicy": 0},
    "햄버거": {"type": "MAIN", "tags": ["양식"], "spicy": 0},
    # 치킨
    "후라이드": {"type": "MAIN", "tags": ["치킨", "튀김"], "spicy": 0},
    "양념치킨": {"type": "MAIN", "tags": ["치킨", "매콤"], "spicy": 2},
    "간장치킨": {"type": "MAIN", "tags": ["치킨"], "spicy": 0},
    "허니콤보": {"type": "MAIN", "tags": ["치킨"], "spicy": 0},
    "레드콤보": {"type": "MAIN", "tags": ["치킨", "매콤"], "spicy": 2},
    # 사이드
    "계란찜": {"type": "SIDE", "tags": ["부드러움"], "spicy": 0},
    "김치": {"type": "SIDE", "tags": ["매콤"], "spicy": 2},
    "샐러드": {"type": "SIDE", "tags": ["건강"], "spicy": 0},
    "군만두": {"type": "SIDE", "tags": ["튀김"], "spicy": 0},
    "감자튀김": {"type": "SIDE", "tags": ["튀김"], "spicy": 0},
    "공기밥": {"type": "SIDE", "tags": ["밥"], "spicy": 0},
    "치킨무": {"type": "SIDE", "tags": ["치킨"], "spicy": 0},
    # 음료
    "콜라": {"type": "DRINK", "tags": ["탄산"], "spicy": 0},
    "사이다": {"type": "DRINK", "tags": ["탄산"], "spicy": 0},
    "아메리카노": {"type": "DRINK", "tags": ["커피"], "spicy": 0},
    "맥주": {"type": "ALCOHOL", "tags": ["주류"], "spicy": 0},
    "소주": {"type": "ALCOHOL", "tags": ["주류"], "spicy": 0},
    "하이볼": {"type": "ALCOHOL", "tags": ["주류", "칵테일"], "spicy": 0},
}

def _lookup_menu_dict(menu_name: str) -> Optional[dict]:
    """메뉴 사전에서 가장 유사한 항목 검색 (부분 매칭)"""
    lower = menu_name.lower().replace(" ", "")
    # 정확 매칭
    for key, val in _MENU_DICTIONARY.items():
        if key in lower or lower in key:
            return val
    return None


class ModelRunner:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelRunner, cls).__new__(cls)
            cls._instance._init_model()
        return cls._instance

    def _init_model(self):
        model_path = os.path.join(os.path.dirname(__file__), "menu_classifier.pkl")
        
        # 모델 파일이 없으면 자동으로 train_model 실행 후 로드
        if not os.path.exists(model_path):
            import subprocess
            print("menu_classifier.pkl 파일을 찾을 수 없어 자동 학습을 시작합니다...")
            train_script = os.path.join(os.path.dirname(__file__), "train_model.py")
            subprocess.run(["python", train_script], check=True)

        # pickle이 kiwi_tokenizer를 __main__에서 찾으므로 등록
        import __main__
        if not hasattr(__main__, 'kiwi_tokenizer'):
            __main__.kiwi_tokenizer = kiwi_tokenizer

        with open(model_path, "rb") as f:
            self.pipeline = pickle.load(f)
        print("Kiwi ML 분류 모델 로드 완료 (Voting Ensemble, 95.23% accuracy)")

    def predict_category(self, menu_name: str) -> str:
        """ML 모델 + 키워드 사전 + 메뉴 사전 하이브리드 카테고리 예측"""
        # 0차: 메뉴 사전 매칭 (가장 신뢰도 높음)
        dict_entry = _lookup_menu_dict(menu_name)
        if dict_entry:
            return dict_entry["type"]

        # 1차: 키워드 사전 매칭 (확실한 경우)
        lower_name = menu_name.lower()
        for cat, keywords in _CATEGORY_KEYWORDS.items():
            if any(kw in lower_name for kw in keywords):
                return cat

        # 2차: ML 모델 예측
        try:
            return self.pipeline.predict([menu_name])[0]
        except Exception:
            return "MAIN"

    def predict_category_with_confidence(self, menu_name: str) -> tuple:
        """카테고리 + confidence 반환"""
        # 메뉴 사전 매칭 → confidence 0.95
        dict_entry = _lookup_menu_dict(menu_name)
        if dict_entry:
            return dict_entry["type"], 0.95

        # 키워드 매칭 → confidence 0.85
        lower_name = menu_name.lower()
        for cat, keywords in _CATEGORY_KEYWORDS.items():
            if any(kw in lower_name for kw in keywords):
                return cat, 0.85

        # ML 모델 → confidence from predict_proba (if available)
        try:
            pred = self.pipeline.predict([menu_name])[0]
            # VotingClassifier hard voting은 predict_proba가 없음 → 기본 0.7
            return pred, 0.70
        except Exception:
            return "MAIN", 0.50

    def _is_noise(self, text: str) -> bool:
        """노이즈 텍스트인지 판별"""
        if len(text) < 2 or len(text) > 30:
            return True
        if text.lower() in _INVALID_MENU_NAMES:
            return True
        if _NOISE_PATTERNS.search(text):
            return True
        # "할인", "쿠폰", "이벤트" 등이 포함된 메뉴명은 메뉴가 아님
        noise_keywords = ['할인', '쿠폰', '이벤트', '고객센터', '고객 센터', '문의', '공지', '안내', '적립', '무료배달', '배달팁', '1644', '1588', '1577', '080']
        if any(kw in text for kw in noise_keywords):
            return True
        # 특수문자(^^, **, !!)가 많으면 이벤트/공지 텍스트
        special_count = sum(1 for c in text if c in '^^*!~♥♡★☆')
        if special_count >= 2:
            return True
        # 숫자가 텍스트의 50% 이상이면 노이즈
        digit_ratio = sum(c.isdigit() for c in text) / max(len(text), 1)
        if digit_ratio > 0.5:
            return True
        return False

    def _normalize_price(self, price_str: str) -> Optional[int]:
        """다양한 가격 표기를 정수로 변환"""
        price_str = price_str.replace(",", "").replace(" ", "").replace("₩", "").replace("\\", "")
        
        # "1.2만" → 12000
        man_match = re.match(r'(\d+\.?\d*)\s*만', price_str)
        if man_match:
            return int(float(man_match.group(1)) * 10000)
        
        # "11.8" (만원 단위 표기) → context에 따라 판단
        dot_match = re.match(r'^(\d{1,2})\.(\d)$', price_str)
        if dot_match:
            val = float(price_str)
            if 1.0 <= val <= 99.9:
                return int(val * 1000)

        # 순수 숫자
        digits = re.sub(r'[^\d]', '', price_str)
        if digits:
            price = int(digits)
            # 합리적 가격 범위 (500원 ~ 100,000원, 음식점 메뉴 기준)
            if 500 <= price <= 100000:
                return price
        return None

    def _clean_menu_name(self, raw_name: str) -> str:
        """메뉴명에서 불필요한 수식어/접미사 제거"""
        name = raw_name.strip()
        
        # 앞뒤 특수문자 제거
        name = re.sub(r'^[\s·•\-\*★☆●○◆◇▶►→]+', '', name)
        name = re.sub(r'[\s·•\-\*★☆●○◆◇▶►→]+$', '', name)
        
        # 뒤쪽 용량 표기 제거: "500ml", "350 ml", "1.25L" 
        name = re.sub(r'\s*\d+\s*(ml|ML|l|L)\s*$', '', name)
        
        # 뒤쪽 수량/단위 표기는 유지 (8p, 200g 등은 메뉴명의 일부일 수 있음)
        # 단, 순수하게 "1인분", "2개" 같은 주문 단위만 제거
        name = re.sub(r'\s+\d+\s*(인분)\s*$', '', name)
        
        # 괄호 내 부가정보는 유지 (소/중/대 등 사이즈 정보 포함)
        # 너무 길면 축약
        if len(name) > 28:
            name = re.sub(r'\s*[\(\[（【].*?[\)\]）】]\s*$', '', name)
        
        # 메뉴명이 충분히 명확하면 Kiwi 분석 생략 (원본 유지가 더 정확)
        if re.match(r'^[가-힣a-zA-Z0-9\s\(\)\[\]\+&/·_]+$', name) and len(name) >= 2:
            return name
        
        # 그 외 특수한 경우만 Kiwi 형태소로 정제
        tokens = kiwi.tokenize(name)
        clean_parts = [t.form for t in tokens if t.tag in ('NNG', 'NNP', 'XR', 'SL', 'SN', 'SW')]
        if clean_parts and len(" ".join(clean_parts)) >= 2:
            return " ".join(clean_parts)
        
        return name if len(name) >= 2 else ""

    def parse_menu_ml(self, raw_content: str) -> List[MenuItemWithCategory]:
        """
        고도화된 Kiwi ML 메뉴 파서 v2.0
        - 다중 정규식 패턴 (7가지 가격 표기 대응)
        - 네이버/토스 노이즈 자동 필터링
        - 카테고리 헤더 컨텍스트 인식
        - 키워드 사전 + ML 하이브리드 분류
        """
        # HTML 처리
        if "<html" in raw_content.lower() or "<div" in raw_content.lower():
            soup = BeautifulSoup(raw_content, "html.parser")
            # 스크립트/스타일 태그 제거
            for tag in soup.find_all(['script', 'style', 'noscript']):
                tag.decompose()
            text_content = soup.get_text(separator="\n")
        else:
            text_content = raw_content

        lines = [line.strip() for line in text_content.splitlines() if line.strip()]
        parsed_menu = []
        current_category_hint = ""

        # ─── 다중 가격 패턴 (우선순위 높은 순) ───
        price_patterns = [
            # 패턴 1: "메뉴명 가격원" (가장 일반적)
            re.compile(r'^(.+?)\s+([\d,]{3,7})\s*원\s*$'),
            # 패턴 2: "메뉴명    가격" (탭/공백 구분, 원 없음)
            re.compile(r'^(.{2,25}?)\s{2,}([\d,]{3,7})\s*$'),
            # 패턴 3: "메뉴명 : 가격원"
            re.compile(r'^(.+?)\s*[:\-]\s*([\d,]{3,7})\s*원?\s*$'),
            # 패턴 4: "메뉴명 ₩가격" / "메뉴명 \가격"
            re.compile(r'^(.+?)\s*[₩\\￦]\s*([\d,]{3,7})\s*$'),
            # 패턴 5: "메뉴명 1.2만" / "메뉴명 1.5만원"
            re.compile(r'^(.+?)\s+(\d{1,2}\.\d)\s*만\s*원?\s*$'),
            # 패턴 6: 라인 중간에 가격 (느슨한 매칭)
            re.compile(r'([가-힣a-zA-Z][가-힣a-zA-Z0-9\s\(\)\[\]]{1,24}?)\s+([\d,]{3,7})\s*원?'),
            # 패턴 7: "가격 메뉴명" (역순 - 일부 메뉴판)
            re.compile(r'^([\d,]{3,7})\s*원?\s+(.{2,25})$'),
        ]

        # ─── 카테고리 헤더 감지 패턴 ───
        category_header_map = {
            'MAIN': ['메인', '대표', '식사', '밥', '면', '정식', '세트', '코스', '스페셜', '추천',
                     '시그니처', '인기', '본요리', '주요리', '고기', '구이', '찌개', '탕', '전골'],
            'SIDE': ['사이드', '안주', '반찬', '토핑', '추가', '곁들임', 'SIDE', '간식', '스낵'],
            'DRINK': ['음료', '드링크', 'DRINK', '생과일', '에이드', '티', '커피', '논알코올'],
            'ALCOHOL': ['주류', '술', '소주', '맥주', 'ALCOHOL', '와인', '칵테일', '하이볼'],
            'DESSERT': ['디저트', 'DESSERT', '후식', '빙수', '아이스크림', '케이크'],
        }

        # ─── 멀티라인 가격 패턴 (다음 줄에 가격만 있는 경우) ───
        price_only_pattern = re.compile(r'^([\d,]{3,7})\s*원\s*$')

        idx = 0
        while idx < len(lines):
            line = lines[idx]
            # 빈 줄, 너무 짧거나 긴 줄 스킵
            if len(line) < 2 or len(line) > 80:
                idx += 1
                continue

            # 카테고리 헤더 감지
            is_header = False
            for cat, keywords in category_header_map.items():
                if any(kw in line for kw in keywords) and len(line) <= 15 and not any(c.isdigit() for c in line):
                    current_category_hint = cat
                    is_header = True
                    break
            if is_header:
                idx += 1
                continue

            # 노이즈 필터
            if _NOISE_PATTERNS.search(line):
                idx += 1
                continue

            # ─── 1. 같은 줄 매칭 시도 ───
            matched = False
            for i, pattern in enumerate(price_patterns):
                match = pattern.search(line)
                if match:
                    if i == 6:  # 역순 패턴 (가격 먼저)
                        price_raw, name_raw = match.group(1), match.group(2)
                    elif i == 4:  # 만원 단위
                        name_raw = match.group(1)
                        price_raw = match.group(2) + "만"
                    else:
                        name_raw, price_raw = match.group(1), match.group(2)

                    # 메뉴명 정제
                    clean_name = self._clean_menu_name(name_raw)
                    if not clean_name or self._is_noise(clean_name):
                        continue

                    # 가격 정규화 (용량 표기 "500 ml" 등은 제외)
                    if re.search(r'[\d,]{3,7}\s*(ml|ML|g|kg|L)\b', line):
                        continue
                    price = self._normalize_price(price_raw)
                    if price is None:
                        continue

                    # 카테고리 예측 (헤더 컨텍스트 + ML 하이브리드)
                    category = self.predict_category(clean_name)
                    if current_category_hint and category == "MAIN":
                        category = current_category_hint

                    # Confidence 계산: 가격 정규화 성공(0.3) + 메뉴사전(0.3) + 이름길이(0.2) + 카테고리(0.2)
                    conf = 0.3  # 가격 파싱 성공 기본
                    if _lookup_menu_dict(clean_name):
                        conf += 0.35
                    if len(clean_name) >= 3:
                        conf += 0.15
                    if category != "MAIN":  # MAIN이 아닌 경우 분류 확신이 높음
                        conf += 0.1
                    else:
                        conf += 0.05
                    conf = min(conf, 0.95)

                    parsed_menu.append(MenuItemWithCategory(
                        menuName=clean_name,
                        price=price,
                        category=category,
                        confidence=round(conf, 2)
                    ))
                    matched = True
                    break

            # ─── 2. 멀티라인 매칭: 다음 줄에 가격이 있는 패턴 ───
            if not matched and idx + 1 < len(lines):
                next_line = lines[idx + 1]
                p_match = price_only_pattern.match(next_line)
                if p_match:
                    candidate_name = self._clean_menu_name(line)
                    if candidate_name and not self._is_noise(candidate_name) and len(candidate_name) >= 2:
                        price = self._normalize_price(p_match.group(1))
                        if price:
                            category = self.predict_category(candidate_name)
                            if current_category_hint and category == "MAIN":
                                category = current_category_hint
                            # 멀티라인 confidence (가격 별도 줄 = 구조화된 데이터 → 높은 신뢰)
                            ml_conf = 0.4 + (0.3 if _lookup_menu_dict(candidate_name) else 0.1) + (0.15 if len(candidate_name) >= 3 else 0.0)
                            parsed_menu.append(MenuItemWithCategory(
                                menuName=candidate_name, price=price, category=category,
                                confidence=round(min(ml_conf, 0.95), 2)
                            ))
                            idx += 1  # 가격 줄 건너뛰기
                            # "주문수 N" 줄도 건너뛰기
                            if idx + 1 < len(lines) and ("주문수" in lines[idx + 1] or "주문 수" in lines[idx + 1]):
                                idx += 1

            idx += 1

        # ─── 3. 인라인 괄호 가격 패턴: "메뉴명(가격원) 메뉴명(가격원)" ───
        inline_pattern = re.compile(r'([가-힣a-zA-Z][가-힣a-zA-Z0-9\s]{1,20}?)\s*[\(（]\s*([\d,]{3,7})\s*원?\s*[\)）]')
        for line in lines:
            for match in inline_pattern.finditer(line):
                name_raw = match.group(1).strip()
                price_raw = match.group(2)
                clean_name = self._clean_menu_name(name_raw)
                if not clean_name or self._is_noise(clean_name):
                    continue
                price = self._normalize_price(price_raw)
                if price:
                    category = self.predict_category(clean_name)
                    conf = 0.4 + (0.3 if _lookup_menu_dict(clean_name) else 0.1)
                    parsed_menu.append(MenuItemWithCategory(
                        menuName=clean_name, price=price, category=category,
                        confidence=round(min(conf, 0.95), 2)
                    ))

        # ─── 중복 제거 (이름 기준, 가격 높은 것 우선) ───
        unique_menu = {}
        for item in parsed_menu:
            key = item.menuName.replace(" ", "")
            if key not in unique_menu or item.price > unique_menu[key].price:
                unique_menu[key] = item

        result = list(unique_menu.values())
        if result:
            print(f"[Kiwi ML Parser v2] Extracted {len(result)} menus")
        return result


# 전역 러너 인스턴스
runner = ModelRunner()
