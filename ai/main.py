import json
import re
import os
import sys
import time
import base64
import random
import urllib.request
import urllib.parse
from typing import List, Optional, Dict, Any
from itertools import combinations
from collections import Counter

from fastapi import FastAPI, HTTPException, Query, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from openai import OpenAI
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import cv2
import numpy as np
import asyncio

# Playwright (없으면 크롤링 비활성화, 나머지 기능 정상 동작)
try:
    from playwright.async_api import async_playwright
    from playwright.sync_api import sync_playwright
    has_playwright = True
except ImportError:
    has_playwright = False
    print("[Notice] Playwright not installed - web crawling disabled, URL/search parsing will use httpx fallback")

# ai 디렉토리를 파이썬 모듈 검색 경로에 안전하게 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# .env 파일 환경 변수 로드 (override=True로 OS 더미 환경변수 방지)
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path, override=True)

# 1. EasyOCR 딥러닝 라이브러리 (Lazy Load - 첫 요청 시 로드)
reader_instance = None
_easyocr_loaded = False

def _get_ocr_reader():
    """EasyOCR을 첫 사용 시에만 로드 (메모리 절약)"""
    global reader_instance, _easyocr_loaded
    if _easyocr_loaded:
        return reader_instance
    _easyocr_loaded = True
    try:
        import easyocr
        reader_instance = easyocr.Reader(['ko', 'en'], gpu=False, verbose=False)
        print("[EasyOCR] Model loaded (lazy)")
    except Exception as e:
        print(f"[EasyOCR] Not available: {e}")
        reader_instance = None
    return reader_instance

# 2. Pyzbar 범용 QR/바코드 라이브러리
try:
    from pyzbar.pyzbar import decode as zbar_decode
    has_pyzbar = True
except Exception as e:
    print(f"[Pyzbar Init Notice] {e}")
    has_pyzbar = False

# Windows asyncio Proactor 정책 설정
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# -------------------------------------------------------------------
# 0. [Playwright 동적 렌더링 크롤러] SPA / React / Vue 실시간 DOM 수집기
# -------------------------------------------------------------------
def _sync_scrape_worker(target_url: str) -> tuple[str, str]:
    print(f"[Playwright Sync Worker] Navigating to: {target_url}")
    final_url = target_url
    rendered_text = ""

    # Playwright 미설치 시 httpx fallback
    if not has_playwright:
        print("[Playwright] Not available - using httpx fallback")
        try:
            req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                final_url = resp.geturl()
                html = resp.read().decode('utf-8', errors='ignore')
                soup = BeautifulSoup(html, 'html.parser')
                rendered_text = soup.get_text(separator='\n', strip=True)[:8000]
        except Exception as e2:
            rendered_text = f"URL: {target_url}"
        return final_url, rendered_text

    # ─── 토스/캐치테이블 URL 감지 (SPA 모바일 전용 렌더링) ───
    _TOSS_PATTERNS = ["toss.im/order", "to.toss.im", "tossplace.com", "front.toss.im"]
    _CATCH_PATTERNS = ["catchtable.co.kr", "app.catchtable"]
    is_toss = any(pat in target_url for pat in _TOSS_PATTERNS)
    is_catch = any(pat in target_url for pat in _CATCH_PATTERNS)

    # 네이버 플레이스 PID 감지 → 매장명 추출 후 검색으로 전환
    pid_match = re.search(r'(?:place|restaurant)/(\d{5,12})', target_url)
    actual_url = target_url
    if pid_match and not is_toss and not is_catch:
        pid = pid_match.group(1)
        # PID → 원본 URL에서 매장명 빠르게 추출 → pcmap 메뉴 시도 → 실패 시 검색 fallback
        # 1단계: 원본 네이버 지도 URL에서 매장명만 추출 (domcontentloaded, 빠름)
        _store_name_hint = ""
        try:
            with sync_playwright() as p:
                _b = p.chromium.launch(headless=True)
                _pg = _b.new_page()
                _pg.goto(target_url, wait_until="domcontentloaded", timeout=6000)
                _pg.wait_for_timeout(1500)
                _t = _pg.title() or ""
                for _s in [" : 네이버 지도", "- 네이버지도", "- 네이버 지도", " : 네이버", "네이버 플레이스"]:
                    _t = _t.replace(_s, "").strip()
                if len(_t) >= 2 and "네이버" not in _t and not _t.startswith("http"):
                    _store_name_hint = _t
                _b.close()
                print(f"[Playwright] PID {pid} title extract: '{_store_name_hint}'")
        except Exception:
            pass

        # 2단계: pcmap 메뉴 페이지 직접 시도 (메뉴 많음)
        actual_url = f"https://pcmap.place.naver.com/restaurant/{pid}/menu/list"
        print(f"[Playwright] PID {pid} → pcmap menu direct")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            
            # 토스/캐치테이블은 모바일 뷰포트
            if is_toss or is_catch:
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                    viewport={"width": 390, "height": 844}
                )
                page = context.new_page()
                page.goto(actual_url, wait_until="networkidle", timeout=15000)
                page.wait_for_timeout(3000)  # SPA 렌더링 대기
                
                # 메뉴 탭/버튼 클릭
                try:
                    for sel in ["text='메뉴'", "text='전체 메뉴'", "text='메뉴 보기'", "text='주문하기'"]:
                        btn = page.locator(sel).first
                        if btn and btn.is_visible():
                            btn.click(timeout=2000, force=True)
                            page.wait_for_timeout(2000)
                            break
                except Exception:
                    pass
                
                # 스크롤
                for _ in range(3):
                    try:
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(500)
                    except Exception:
                        break
                
                platform = "Toss" if is_toss else "CatchTable"
                print(f"[Playwright] {platform} SPA mode")
                iframe_text = ""  # 토스/캐치는 iframe 없음
            else:
                # 네이버/일반 → 데스크탑
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
                    viewport={"width": 1280, "height": 900}
                )
                page = context.new_page()
                page.goto(actual_url, wait_until="networkidle", timeout=15000)
                page.wait_for_timeout(3000)
                
                # 메뉴 탭 클릭 시도 (네이버 플레이스)
                try:
                    for tab_text in ["메뉴", "전체메뉴", "메뉴판"]:
                        btn = page.locator(f"text='{tab_text}'").first
                        if btn and btn.is_visible():
                            btn.click(timeout=2000, force=True)
                            page.wait_for_timeout(1500)
                            break
                except Exception:
                    pass

                # "더보기" 반복 클릭 (최대 5회 - 전체 메뉴 로드)
                for _ in range(5):
                    try:
                        more_btn = page.locator("a:has-text('더보기'), button:has-text('더보기')").first
                        if more_btn and more_btn.is_visible():
                            more_btn.click(timeout=2000, force=True)
                            page.wait_for_timeout(1000)
                        else:
                            break
                    except Exception:
                        break

                # 스크롤 반복 (메뉴 더 로드)
                for _ in range(5):
                    try:
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(500)
                    except Exception:
                        break

                # iframe 내부 텍스트도 수집 (네이버 플레이스 위젯)
                iframe_text = ""
                try:
                    for frame in page.frames:
                        if frame != page.main_frame:
                            try:
                                ft = frame.inner_text("body")
                                if len(ft) > 50 and ("원" in ft or "메뉴" in ft):
                                    iframe_text += "\n" + ft
                            except Exception:
                                pass
                except Exception:
                    pass

            final_url = page.url
            rendered_text = page.inner_text("body")
            # iframe 텍스트 병합 (네이버 플레이스 위젯)
            if iframe_text:
                rendered_text += iframe_text
            
            # pcmap 캡차/차단 감지 → 검색 fallback
            if pid_match and (len(rendered_text) < 200 or "보안 확인" in rendered_text or "페이지를 찾을 수 없습니다" in rendered_text):
                pid = pid_match.group(1)
                print(f"[Playwright] pcmap blocked/empty → trying search fallback")
                search_query = _store_name_hint if _store_name_hint else ""
                
                if not search_query:
                    # 타이틀에서 재시도
                    raw_title = page.title() or ""
                    for suf in [" : 네이버", "- 네이버지도", "네이버 플레이스"]:
                        raw_title = raw_title.replace(suf, "").strip()
                    if len(raw_title) >= 2 and "네이버" not in raw_title:
                        search_query = raw_title
                
                if search_query:
                    fallback_url = f"https://search.naver.com/search.naver?query={urllib.parse.quote(search_query + ' 메뉴')}"
                else:
                    fallback_url = f"https://search.naver.com/search.naver?query=네이버플레이스+{pid}+메뉴"
                
                page.goto(fallback_url, wait_until="networkidle", timeout=12000)
                page.wait_for_timeout(2000)
                # 더보기 클릭
                try:
                    for _ in range(3):
                        btn = page.locator("a:has-text('더보기'), button:has-text('더보기')").first
                        if btn and btn.is_visible():
                            btn.click(timeout=2000, force=True)
                            page.wait_for_timeout(800)
                        else:
                            break
                except Exception:
                    pass
                rendered_text = page.inner_text("body")
                final_url = page.title() or search_query or final_url

            # 상호명 추출 (타이틀에서)
            raw_title = page.title() or ""
            for suffix in ["- 네이버지도", "- 네이버 지도", "네이버 플레이스", ": 네이버", " : 네이버",
                          "토스 픽업주문", "토스오더", "| 토스", "- 토스", "| 캐치테이블", "- CatchTable"]:
                raw_title = raw_title.replace(suffix, "").strip()
            if raw_title and len(raw_title) >= 2 and not raw_title.startswith("http"):
                final_url = raw_title
            
            browser.close()
            print(f"[Playwright Sync Worker] Scraped {len(rendered_text)} chars, hint=[{final_url}]")
            return final_url, rendered_text[:8000]
    except Exception as e:
        print(f"[Playwright Worker Fallback Exception] {e}")
        try:
            req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)'})
            with urllib.request.urlopen(req, timeout=6) as resp:
                final_url = resp.geturl()
                html = resp.read().decode('utf-8', errors='ignore')
                soup = BeautifulSoup(html, 'html.parser')
                rendered_text = soup.get_text(separator='\n', strip=True)[:8000]
        except Exception as e2:
            rendered_text = f"URL: {target_url}"
            
    return final_url, rendered_text

async def scrape_dynamic_web_content(target_url: str) -> tuple[str, str]:
    return await asyncio.to_thread(_sync_scrape_worker, target_url)

app = FastAPI(
    title="AI Smart Menu Master Orchestrator Pro",
    description="범용 QR + EasyOCR + GPT-4o-mini + 앙상블 냅색 프로필 추천 엔진",
    version="10.0.0"
)

# ─── 보안: CORS 허용 출처 제한 (개발/프로덕션 분리) ───
_ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
)

# ─── 보안: Rate Limiting (IP별 요청 제한) ───
from collections import defaultdict
_rate_limit_store: Dict[str, List[float]] = defaultdict(list)
_RATE_LIMIT_MAX = int(os.getenv("RATE_LIMIT_MAX", "30"))  # 분당 최대 요청
_RATE_LIMIT_WINDOW = 60.0  # 초

def _check_rate_limit(client_ip: str) -> bool:
    """IP 기반 간단한 rate limiting (분당 30회)"""
    now = time.time()
    timestamps = _rate_limit_store[client_ip]
    # 윈도우 밖 타임스탬프 정리
    _rate_limit_store[client_ip] = [t for t in timestamps if now - t < _RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[client_ip]) >= _RATE_LIMIT_MAX:
        return False
    _rate_limit_store[client_ip].append(now)
    return True

# ─── 보안: 입력 검증 유틸리티 ───
def _sanitize_url_input(url_input: str) -> str:
    """URL/상호명 입력 검증 및 정제"""
    if not url_input or not url_input.strip():
        return ""
    sanitized = url_input.strip()[:500]  # 최대 500자 제한
    # XSS/인젝션 기본 방어: 스크립트 태그 제거
    sanitized = re.sub(r'<script[^>]*>.*?</script>', '', sanitized, flags=re.IGNORECASE | re.DOTALL)
    sanitized = re.sub(r'[<>]', '', sanitized)
    return sanitized

# OpenAI Client
openai_api_key = os.getenv("OPENAI_API_KEY", "")
client = OpenAI(api_key=openai_api_key)

# -------------------------------------------------------------------
# 1. Request / Response DTO Schemas
# -------------------------------------------------------------------
class MenuItem(BaseModel):
    menuName: str = Field(..., example="직화 돼지갈비", min_length=1, max_length=100)
    price: int = Field(..., example=25000, ge=0, le=1000000)
    desc: Optional[str] = Field("대표 메뉴", example="인기 메뉴", max_length=200)
    category: Optional[str] = Field("메인", example="메인", max_length=20)

class RecommendedItem(BaseModel):
    menuName: str
    price: int
    count: int = 1
    totalItemPrice: int
    desc: Optional[str] = ""
    category: Optional[str] = "메인"

class RecommendRequest(BaseModel):
    menuList: List[MenuItem] = Field(..., max_length=100)
    peopleCount: int = Field(2, ge=1, le=20)
    budget: int = Field(60000, ge=0, le=5000000)
    meetingType: Optional[str] = Field("친구 모임", max_length=50)
    excludedFoods: Optional[List[str]] = Field([], max_length=50)
    bigEaterCount: Optional[int] = Field(0, ge=0, le=10)
    spicyLevel: Optional[int] = Field(3, ge=0, le=5)
    dietCount: Optional[int] = Field(0, ge=0, le=10)
    todayPreference: Optional[str] = Field("", max_length=100)
    excludedCombos: Optional[List[List[str]]] = Field([], max_length=20)
    presetProfile: Optional[str] = Field("balance") # balance, signature, value

class ReRecommendRequest(RecommendRequest):
    elapsedMinutes: Optional[int] = Field(45)
    budgetDelta: Optional[int] = Field(0)

class RecommendResponse(BaseModel):
    recommendedItems: List[RecommendedItem]
    recommendedMenus: List[str]
    totalPrice: int
    reason: str
    engineType: str
    profile: str


# -------------------------------------------------------------------
# 2. [범용 다중 엔진 QR 디텍터] Multi-Engine Universal QR Pipeline
# -------------------------------------------------------------------
from PIL import Image
import io

def universal_decode_qr(img_bytes: bytes) -> Optional[str]:
    try:
        # 0차: PIL Image 직접 디코딩 (가장 안정적)
        if has_pyzbar:
            try:
                pil_img = Image.open(io.BytesIO(img_bytes))
                pil_decoded = zbar_decode(pil_img)
                if pil_decoded:
                    url = pil_decoded[0].data.decode('utf-8', errors='ignore').strip()
                    if url.startswith("http"):
                        print(f"[Universal QR 0차: Pyzbar PIL] {url}")
                        return url
            except Exception as e_pil:
                pass

        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        # 1차: pyzbar 원본 및 그레이스케일 스캔
        if has_pyzbar:
            decoded = zbar_decode(img)
            if decoded:
                url = decoded[0].data.decode('utf-8', errors='ignore').strip()
                if url.startswith("http"):
                    print(f"[Universal QR 1차: Pyzbar Raw] {url}")
                    return url

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            decoded_gray = zbar_decode(gray)
            if decoded_gray:
                url = decoded_gray[0].data.decode('utf-8', errors='ignore').strip()
                if url.startswith("http"):
                    print(f"[Universal QR 1차: Pyzbar Gray] {url}")
                    return url

            # CLAHE (대비 향상) 적용 후 스캔
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            enhanced = clahe.apply(gray)
            decoded_clahe = zbar_decode(enhanced)
            if decoded_clahe:
                url = decoded_clahe[0].data.decode('utf-8', errors='ignore').strip()
                if url.startswith("http"):
                    print(f"[Universal QR 1차: Pyzbar CLAHE] {url}")
                    return url

            # 4방향 회전 스캔 (90도, 180도, 270도)
            for angle in [cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_180, cv2.ROTATE_90_COUNTERCLOCKWISE]:
                rotated = cv2.rotate(gray, angle)
                decoded_rot = zbar_decode(rotated)
                if decoded_rot:
                    url = decoded_rot[0].data.decode('utf-8', errors='ignore').strip()
                    if url.startswith("http"):
                        print(f"[Universal QR 1차: Pyzbar Rotated] {url}")
                        return url

        # 2차: OpenCV QRCodeDetector 다각도 스캔
        qr_detector = cv2.QRCodeDetector()
        for frame in [img, cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)]:
            data, bbox, _ = qr_detector.detectAndDecode(frame)
            if data and data.strip().startswith("http"):
                print(f"[Universal QR 2차: OpenCV] {data.strip()}")
                return data.strip()

    except Exception as e:
        print(f"[Universal QR Exception] {e}")

    return None


# -------------------------------------------------------------------
# 3. [메뉴 인식 서포트] EasyOCR + 전처리 비전 스캐너
# -------------------------------------------------------------------
def scan_raw_text_with_easyocr(img_bytes: bytes) -> tuple[List[str], List[dict]]:
    reader = _get_ocr_reader()
    if not reader:
        return [], []

    try:
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return [], []

        # ─── 이미지 전처리 파이프라인 (OCR 정확도 향상) ───
        h, w = img.shape[:2]
        # 1. 리사이즈 (너무 크면 축소)
        if max(h, w) > 2000:
            scale = 2000 / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        # 2. 너무 작으면 확대 (OCR 정확도 향상)
        elif max(h, w) < 800:
            scale = 800 / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

        # 3. 그레이스케일 변환 후 조건부 전처리
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 4. 대비 향상 (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # 5. 노이즈 제거 (가우시안 블러 경량)
        denoised = cv2.GaussianBlur(enhanced, (3, 3), 0)
        
        # 6. 샤프닝
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
        sharpened = cv2.filter2D(denoised, -1, kernel)
        
        # 원본 + 전처리 양쪽 모두 OCR 시도, 더 나은 결과 채택
        results_orig = reader.readtext(img)
        results_enhanced = reader.readtext(sharpened)
        
        # 더 많은 결과를 가져온 쪽 선택 (동일하면 confidence 높은 쪽)
        if len(results_enhanced) > len(results_orig):
            results = results_enhanced
            print(f"[EasyOCR] Enhanced preprocessing used ({len(results_enhanced)} vs {len(results_orig)} texts)")
        else:
            results = results_orig

    except Exception as e:
        print(f"[EasyOCR Read Exception] {e}")
        return [], []

    raw_lines = []
    ocr_blocks = []
    for bbox, text, prob in results:
        t = text.strip()
        if prob >= 0.15 and len(t) >= 1:
            raw_lines.append(t)
            ocr_blocks.append({
                "text": t,
                "confidence": round(prob, 2),
                "y": (bbox[0][1] + bbox[2][1]) / 2.0
            })

    return raw_lines, ocr_blocks


# -------------------------------------------------------------------
# 4. [메뉴 인식 총책임] Confidence-based Routing (ML 우선 → GPT fallback)
# -------------------------------------------------------------------
_CONFIDENCE_THRESHOLD = 0.65  # 이 이상이면 GPT 스킵

def orchestrate_menu_parsing_with_gpt(image_bytes: Optional[bytes] = None, web_raw_text: Optional[str] = None, store_name_hint: str = "") -> tuple[str, List[dict]]:
    # store_name 초기화: URL이면 "스캔 매장"으로 설정
    if store_name_hint and not store_name_hint.startswith("http") and "/" not in store_name_hint and "=" not in store_name_hint:
        store_name = store_name_hint
    else:
        store_name = "스캔 매장"
    menus = []
    
    INVALID_PLATFORM_NAMES = [
        "토스 픽업주문", "토스 픽업", "토스오더", "토스플레이스", 
        "네이버 주문", "네이버 플레이스", "네이버지도", 
        "배달의민족", "쿠팡이츠", "요기요", "테이블링", "캐치테이블", "스캔 매장", "추천 매장"
    ]

    # 사용자가 직접 입력한 명확한 상호명이 있는 경우 우선 채택
    if store_name_hint and not store_name_hint.startswith("http") and not any(inv in store_name_hint for inv in INVALID_PLATFORM_NAMES):
        # 네이버 검색 결과 타이틀 정제 ("교촌치킨 홍대점 메뉴  검색" → "교촌치킨 홍대점")
        cleaned_hint = store_name_hint.strip()
        for suffix in [" 메뉴  검색", " 메뉴 검색", " 검색", " : 네이버 검색", " : 검색"]:
            cleaned_hint = cleaned_hint.replace(suffix, "").strip()
        if len(cleaned_hint) >= 2:
            store_name = cleaned_hint

    easyocr_lines = []
    if image_bytes:
        easyocr_lines, _ = scan_raw_text_with_easyocr(image_bytes)
        print(f"[EasyOCR Support] Scanned {len(easyocr_lines)} text tokens")
    
    ocr_summary = f"{store_name_hint}\n" + ("\n".join(easyocr_lines) if easyocr_lines else (web_raw_text or ""))

    system_prompt = """
    당신은 대한민국 최고 권위의 식당 메뉴판 전문 AI 초고속 정제 파서(Master Menu Parser)입니다.
    제공된 [실시간 크롤링 텍스트 / OCR 스캔 텍스트 / 이미지 원본]을 분석하여 다음 원칙에 따라 JSON으로만 응답하세요:
    
    [엄격한 매장명 및 메뉴 정제 원칙 - 100% 실시간 무상태 원칙]
    1. 'storeName': 
       - 입력된 텍스트/이미지 상단에 실제로 나타난 고유 브랜드 상호명을 그대로 추출하세요.
       - [절대 금지]: '토스 픽업주문', '토스오더', '토스플레이스', '네이버 주문', '배달의민족', '추천 매장', '스캔 매장', '주문내역' 등 서비스/플랫폼 명칭은 상호명으로 사용할 수 없습니다.
    2. 'menus': 실제 텍스트에 판매 중인 것으로 나타난 진짜 메뉴 목록 배열. (최대 40개 대표 메뉴)
       - [가장 중요 - 날조 절대 금지]: 반드시 제공된 텍스트/이미지에 실제로 적혀 있는 음식/음료 이름과 실제 가격만 추출하세요! 텍스트에 없는 가짜 메뉴는 절대 포함하지 마세요.
       - 'menuName': 오직 순수한 음식/음료 이름만 추출.
       - 'price': 숫자로 된 정확한 원화 판매 가격 (예: 1500, 3900, 11000).
       - 'category': '메인', '세트', '사이드', '음료', '디저트', '주류' 중 하나.
    3. 빠른 응답을 위해 반드시 유효한 경량 JSON 형식 {"storeName": string, "menus": [{"menuName": str, "price": int, "category": str}]} 으로만 응답하세요.
    """

    messages = [{"role": "system", "content": system_prompt}]
    user_content = []
    user_content.append({"type": "text", "text": f"[입력 데이터]\n{ocr_summary[:3500]}"})

    if image_bytes:
        base64_img = base64.b64encode(image_bytes).decode('utf-8')
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{base64_img}"}
        })

    messages.append({"role": "user", "content": user_content})

    # ─── Phase 2: ML 파서 우선 시도 (Confidence 라우팅) ───
    ml_text = "\n".join(easyocr_lines) if easyocr_lines else (web_raw_text or "")
    if ml_text and len(ml_text.strip()) > 20:
        try:
            from model_runner import ModelRunner
            ml_runner = ModelRunner()
            ml_results = ml_runner.parse_menu_ml(ml_text)
            if ml_results:
                avg_confidence = sum(m.confidence for m in ml_results) / len(ml_results)
                print(f"[ML Parser] {len(ml_results)} menus found, avg confidence: {avg_confidence:.2f}")
                
                if avg_confidence >= _CONFIDENCE_THRESHOLD and len(ml_results) >= 3:
                    # Confidence 충분 → GPT 스킵, 자체 처리
                    print(f"[Confidence Router] HIGH ({avg_confidence:.2f} >= {_CONFIDENCE_THRESHOLD}) → GPT SKIP")
                    cat_map = {"MAIN": "메인", "SIDE": "사이드", "DRINK": "음료", "ALCOHOL": "주류", "DESSERT": "디저트", "SET": "세트"}
                    for item in ml_results:
                        menus.append({
                            "menuName": item.menuName,
                            "price": item.price,
                            "desc": "",
                            "category": cat_map.get(item.category, "메인")
                        })
                    return store_name, menus
                else:
                    print(f"[Confidence Router] LOW ({avg_confidence:.2f} < {_CONFIDENCE_THRESHOLD}) → GPT 호출 시도")
        except Exception as e_ml_pre:
            print(f"[ML Pre-parse Exception] {e_ml_pre}")

    try:
        print(f"[GPT-4o-mini Master Parser] Orchestrating menu recognition for '{store_name}'...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=4000
        )
        content_str = response.choices[0].message.content
        try:
            res_json = json.loads(content_str)
        except Exception as json_err:
            print(f"[JSON Parse Retry Warning] {json_err}, attempting partial extraction...")
            import re
            m_match = re.search(r'\{.*\}', content_str, re.DOTALL)
            if m_match:
                res_json = json.loads(m_match.group(0))
            else:
                res_json = {"storeName": store_name, "menus": []}
        
        parsed_name = res_json.get("storeName", "").strip()
        if parsed_name and not parsed_name.startswith("http") and not any(inv in parsed_name for inv in INVALID_PLATFORM_NAMES):
            store_name = parsed_name
        elif store_name_hint and not store_name_hint.startswith("http") and not any(inv in store_name_hint for inv in INVALID_PLATFORM_NAMES):
            store_name = store_name_hint

        raw_menus = res_json.get("menus", [])
        for rm in raw_menus:
            if isinstance(rm, dict) and "menuName" in rm and "price" in rm:
                try:
                    p_val = int(rm["price"])
                except Exception:
                    continue
                m_name = rm["menuName"].strip()
                if 500 <= p_val <= 500000 and len(m_name) >= 2 and m_name != store_name:
                    if not any(m['menuName'] == m_name for m in menus):
                        menus.append({
                            "menuName": m_name,
                            "price": p_val,
                            "desc": rm.get("desc", f"{store_name} 대표 메뉴"),
                            "category": rm.get("category", "메인")
                        })
        print(f"[GPT-4o-mini Master Parser] Parsed {len(menus)} clean menus for '{store_name}'")
    except Exception as e:
        print(f"[GPT-4o-mini Parser Exception] {e}")

    # ─── Phase 1: GPT 실패 시 자체 Kiwi ML 파서 fallback ───
    if not menus and (web_raw_text or easyocr_lines):
        try:
            from model_runner import ModelRunner
            ml_runner = ModelRunner()
            raw_text = "\n".join(easyocr_lines) if easyocr_lines else (web_raw_text or "")
            ml_results = ml_runner.parse_menu_ml(raw_text)
            for item in ml_results:
                cat_map = {"MAIN": "메인", "SIDE": "사이드", "DRINK": "음료", "ALCOHOL": "주류", "DESSERT": "디저트", "SET": "세트"}
                menus.append({
                    "menuName": item.menuName,
                    "price": item.price,
                    "desc": f"{store_name} 메뉴",
                    "category": cat_map.get(item.category, "메인")
                })
            if menus:
                print(f"[Kiwi ML Fallback] Parsed {len(menus)} menus for '{store_name}'")
        except Exception as e_ml:
            print(f"[Kiwi ML Fallback Exception] {e_ml}")

    return store_name, menus


# -------------------------------------------------------------------
# 5. [앙상블 냅색 추천 엔진] 5관점 가중 투표 + 카테고리 다양성
# -------------------------------------------------------------------

def _score_budget_fit(combo: list, effective_budget: int) -> float:
    """스코어러 1: 예산 적합도 (예산의 60~90% 사용 시 최고점)"""
    tot = sum(m.price for m in combo)
    if tot > effective_budget:
        return 0.0
    ratio = tot / max(effective_budget, 1)
    if 0.60 <= ratio <= 0.90:
        return 100.0
    elif 0.50 <= ratio < 0.60:
        return 80.0
    elif 0.90 < ratio <= 0.95:
        return 85.0
    elif 0.40 <= ratio < 0.50:
        return 60.0
    elif ratio < 0.40:
        return 30.0
    return 70.0

def _score_dish_count(combo: list, target_count: int) -> float:
    """스코어러 2: 적정 디쉬 수 근접도"""
    diff = abs(len(combo) - target_count)
    if diff == 0:
        return 100.0
    elif diff == 1:
        return 75.0
    elif diff == 2:
        return 40.0
    return 10.0

def _score_category_diversity(combo: list) -> float:
    """스코어러 3: 카테고리 다양성 (메인+사이드+음료 조합 시 보너스)"""
    categories = set()
    for m in combo:
        cat = (m.category or "메인").lower()
        if any(kw in cat for kw in ["메인", "main", "세트", "set"]):
            categories.add("main")
        elif any(kw in cat for kw in ["사이드", "side"]):
            categories.add("side")
        elif any(kw in cat for kw in ["음료", "drink"]):
            categories.add("drink")
        elif any(kw in cat for kw in ["주류", "alcohol"]):
            categories.add("alcohol")
        else:
            categories.add("main")
    
    # 메인 필수, 사이드/음료 있으면 보너스
    score = 50.0
    if "main" in categories:
        score += 25.0
    if len(categories) >= 2:
        score += 15.0
    if len(categories) >= 3:
        score += 10.0
    return score

def _score_price_balance(combo: list) -> float:
    """스코어러 4: 가격 균형도 (극단적 비싼+극단적 싼 조합 패널티)"""
    if len(combo) <= 1:
        return 70.0
    prices = [m.price for m in combo]
    avg_price = sum(prices) / len(prices)
    # 변동계수(CV)가 낮을수록 균형 잡힘
    std_dev = (sum((p - avg_price) ** 2 for p in prices) / len(prices)) ** 0.5
    cv = std_dev / max(avg_price, 1)
    if cv < 0.3:
        return 100.0  # 매우 균형적
    elif cv < 0.5:
        return 80.0
    elif cv < 0.8:
        return 60.0
    return 40.0

def _score_profile_match(combo: list, profile: str, effective_budget: int) -> float:
    """스코어러 5: 프로필(balance/signature/value) 적합도"""
    tot = sum(m.price for m in combo)
    ratio = tot / max(effective_budget, 1)
    avg_price = tot / max(len(combo), 1)
    
    if profile == "signature":
        # 시그니처: 고가 메뉴 비중 높을수록 좋음
        return min(100.0, (avg_price / 15000) * 50 + 30)
    elif profile == "value":
        # 가성비: 많은 메뉴를 저렴하게
        return min(100.0, (len(combo) * 20) + (1.0 - ratio) * 50)
    else:
        # 밸런스: 예산의 65~80% 사용 + 적정 수량
        balance_score = 70.0
        if 0.65 <= ratio <= 0.80:
            balance_score = 100.0
        elif 0.55 <= ratio <= 0.90:
            balance_score = 85.0
        return balance_score


def custom_recommendation_engine_support(req: RecommendRequest, profile: str = "balance") -> tuple[List[MenuItem], int, List[dict]]:
    """앙상블 추천 엔진: 5개 스코어러의 가중 투표로 최적 조합 선정"""
    people_count = max(1, min(req.peopleCount or 1, 20))  # 보안: 인원 수 제한
    effective_budget = req.budget if 0 < req.budget <= 5000000 else (people_count * 35000)  # 보안: 예산 상한

    # 1. 알레르기 및 제외 음식 필터링 (보안: excludedFoods 길이 제한)
    excluded = (req.excludedFoods or [])[:50]
    valid_menus = [
        m for m in req.menuList[:100]  # 보안: 메뉴 리스트 최대 100개
        if 500 <= m.price <= 500000 and not any(ex in m.menuName for ex in excluded)
    ]
    if not valid_menus:
        valid_menus = [m for m in req.menuList[:100] if 500 <= m.price <= 500000]
    if not valid_menus:
        return [], 0, []

    # 2. 프로필별 후보 풀 구성 (다양한 정렬 전략)
    if profile == "signature":
        valid_menus.sort(key=lambda x: x.price, reverse=True)
    elif profile == "value":
        valid_menus.sort(key=lambda x: x.price)
    else:
        random.seed(int(time.time() * 1000) % 10000)
        random.shuffle(valid_menus)

    # 디쉬 수 목표
    target_dish_count = max(1, people_count + (req.bigEaterCount or 0) - (req.dietCount or 0))
    min_k = max(1, target_dish_count - 1)
    max_k = min(len(valid_menus), target_dish_count + 2)

    candidate_pool = valid_menus[:min(len(valid_menus), 18)]
    candidates = []
    seen_combos = set()

    # 이전 추천 조합 제외
    excluded_keys = set()
    for ex in (req.excludedCombos or [])[:20]:  # 보안: 제외 조합 수 제한
        excluded_keys.add(tuple(sorted(ex)))

    # ─── 앙상블 스코어러 가중치 ───
    WEIGHTS = {
        "budget_fit": 0.30,
        "dish_count": 0.25,
        "category_diversity": 0.20,
        "price_balance": 0.10,
        "profile_match": 0.15,
    }

    for k in range(min_k, max_k + 1):
        for combo in combinations(candidate_pool, k):
            combo_names = tuple(sorted([m.menuName for m in combo]))
            if combo_names in seen_combos or combo_names in excluded_keys:
                continue
            seen_combos.add(combo_names)

            tot_price = sum(m.price for m in combo)
            # 예산 초과 불가 (하드 제약)
            if tot_price > effective_budget:
                continue

            # ─── 5개 스코어러 앙상블 투표 ───
            s1 = _score_budget_fit(combo, effective_budget)
            s2 = _score_dish_count(combo, target_dish_count)
            s3 = _score_category_diversity(combo)
            s4 = _score_price_balance(combo)
            s5 = _score_profile_match(combo, profile, effective_budget)

            ensemble_score = (
                WEIGHTS["budget_fit"] * s1 +
                WEIGHTS["dish_count"] * s2 +
                WEIGHTS["category_diversity"] * s3 +
                WEIGHTS["price_balance"] * s4 +
                WEIGHTS["profile_match"] * s5
            )

            # 메인 카테고리 필수 포함 보너스/페널티
            has_main = any((m.category or "메인").lower() in ("메인", "main", "세트", "set") for m in combo)
            if not has_main and len(combo) >= 2:
                ensemble_score *= 0.5  # 메인 없으면 점수 절반

            candidates.append({
                "items": list(combo),
                "totalPrice": tot_price,
                "score": ensemble_score
            })

    candidates.sort(key=lambda c: c["score"], reverse=True)

    if candidates:
        best = candidates[0]
        return best["items"], best["totalPrice"], candidates[:3]

    # Fallback
    fallback_combo = valid_menus[:min(target_dish_count, len(valid_menus))]
    fallback_price = sum(m.price for m in fallback_combo)
    return fallback_combo, fallback_price, [{"items": fallback_combo, "totalPrice": fallback_price, "score": 50.0}]


# -------------------------------------------------------------------
# 6. [추천 총책임] GPT-4o-mini Master Concierge & 정밀 객체 매핑
# -------------------------------------------------------------------
def orchestrate_recommendation_with_gpt(
    req: RecommendRequest, 
    custom_best_combo: List[MenuItem], 
    custom_tot_price: int, 
    profile: str = "balance"
) -> tuple[List[RecommendedItem], List[str], int, str]:

    # 원본 메뉴 매핑 테이블 구축 (메뉴명 -> MenuItem)
    menu_dict: Dict[str, MenuItem] = {m.menuName: m for m in req.menuList}
    
    # 냅색 선택 결과 수량 집계
    combo_counts = Counter([m.menuName for m in custom_best_combo])
    
    # 1. 냅색이 선택한 기본 객체 생성
    recommended_items: List[RecommendedItem] = []
    for m_name, count in combo_counts.items():
        orig_menu = menu_dict.get(m_name, MenuItem(menuName=m_name, price=15000))
        item_tot = orig_menu.price * count
        recommended_items.append(RecommendedItem(
            menuName=m_name,
            price=orig_menu.price,
            count=count,
            totalItemPrice=item_tot,
            desc=orig_menu.desc or "대표 인기 메뉴",
            category=orig_menu.category or "메인"
        ))

    calculated_tot_price = sum(item.totalItemPrice for item in recommended_items)
    formatted_menu_names = [f"{item.menuName} x {item.count}" if item.count > 1 else item.menuName for item in recommended_items]

    # 2. 자체 추천 사유 생성 (LLM 불필요)
    final_reason = _generate_recommendation_reason(req, recommended_items, calculated_tot_price, profile)

    return recommended_items, formatted_menu_names, calculated_tot_price, final_reason


def _generate_recommendation_reason(
    req: RecommendRequest, 
    items: List[RecommendedItem], 
    total_price: int, 
    profile: str
) -> str:
    """자체 템플릿 기반 추천 사유 생성 (GPT 없이)"""
    people = req.peopleCount
    budget = req.budget
    mood = req.meetingType or "모임"
    per_person = total_price // max(people, 1)
    utilization = int(total_price / max(budget, 1) * 100)
    num_items = len(items)
    
    # 카테고리 분석
    categories = set(it.category or "메인" for it in items)
    has_main = any(c in ("메인", "세트") for c in categories)
    has_side = "사이드" in categories
    has_drink = any(c in ("음료", "주류") for c in categories)
    
    # 가격대 분석
    prices = [it.price for it in items]
    max_price_item = max(items, key=lambda x: x.price) if items else None
    
    # ─── 첫 문장: 조건 매칭 설명 ───
    first_sentences = []
    
    if profile == "signature" and max_price_item:
        first_sentences.append(f"{people}인 {mood}에 어울리는 시그니처 메뉴 '{max_price_item.menuName}'을 중심으로 구성했어요.")
    elif profile == "value":
        first_sentences.append(f"{people}인 기준 1인당 {per_person:,}원으로 {num_items}가지 메뉴를 알차게 담았어요.")
    elif people == 1:
        first_sentences.append(f"혼밥에 딱 맞는 메뉴를 예산 내에서 골랐어요.")
    elif people >= 4:
        first_sentences.append(f"{people}명이 함께 즐길 수 있도록 {num_items}가지 메뉴를 다양하게 구성했어요.")
    else:
        first_sentences.append(f"{people}인의 {mood}에 맞춰 예산({budget:,}원)의 {utilization}%를 활용한 조합이에요.")
    
    # ─── 두 번째 문장: 조합 특성 설명 ───
    second_sentences = []
    
    if has_main and has_side and has_drink:
        second_sentences.append("메인 요리부터 곁들임, 음료까지 균형 잡힌 한 끼를 완성합니다.")
    elif has_main and has_side:
        second_sentences.append("든든한 메인과 깔끔한 사이드 조합으로 만족스러운 식사가 될 거예요.")
    elif has_main and has_drink:
        second_sentences.append("맛있는 메인 요리에 음료를 곁들여 완벽한 한 끼를 즐겨보세요.")
    elif num_items >= 3:
        second_sentences.append("다양한 메뉴를 골고루 맛볼 수 있는 알찬 구성이에요.")
    elif num_items == 1:
        second_sentences.append("딱 한 메뉴에 집중해서 제대로 즐겨보세요.")
    else:
        second_sentences.append("예산 안에서 최적의 만족도를 드릴 수 있는 조합입니다.")
    
    # 대식가/다이어터 특화
    if req.bigEaterCount and req.bigEaterCount > 0:
        second_sentences.append(f"대식가 {req.bigEaterCount}명을 고려해 넉넉한 양을 반영했어요.")
    if req.dietCount and req.dietCount > 0:
        second_sentences.append(f"다이어터를 위해 가벼운 메뉴 위주로 구성했어요.")
    
    first = random.choice(first_sentences) if first_sentences else f"{people}인 {mood}에 맞춘 추천이에요."
    second = second_sentences[0] if second_sentences else "맛있게 드세요!"
    
    return f"{first} {second}"


# -------------------------------------------------------------------
# 7. FastAPI Endpoints
# -------------------------------------------------------------------

@app.post("/ai/parse-image")
async def parse_image_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    print(f"[Universal Menu Parser] Processing image size: {len(contents)} bytes, filename: {file.filename}")

    # 1. 범용 다중 엔진 QR 코드 검사 (Pyzbar + OpenCV CLAHE + 회전)
    qr_url = universal_decode_qr(contents)
    if qr_url:
        print(f"[Universal QR Decoded Successfully] {qr_url}")
        # 🌐 Playwright 실시간 동적 렌더링 수집기 실행
        final_dest_url, live_scraped_text = await scrape_dynamic_web_content(qr_url)
        
        store_name, live_menus = orchestrate_menu_parsing_with_gpt(
            image_bytes=None, 
            web_raw_text=live_scraped_text, 
            store_name_hint=final_dest_url
        )
        if live_menus:
            return {
                "filename": file.filename,
                "storeName": store_name,
                "menuCount": len(live_menus),
                "menus": live_menus,
                "status": "success",
                "qrUrl": qr_url,
                "finalUrl": final_dest_url,
                "architecture": "PLAYWRIGHT_DYNAMIC_DOM_GPT_PARSER"
            }

    # 2. EasyOCR + GPT-4o-mini Vision 융합 스캔
    store_name, ocr_menus = orchestrate_menu_parsing_with_gpt(image_bytes=contents, store_name_hint=file.filename)

    return {
        "filename": file.filename,
        "storeName": store_name,
        "menuCount": len(ocr_menus),
        "menus": ocr_menus,
        "status": "success" if ocr_menus else "empty",
        "architecture": "GPT_4O_MINI_EASYOCR_VISION_SUPPORT"
    }


@app.get("/ai/parse-url")
async def parse_url_endpoint(url: str):
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="URL 또는 상호명이 입력되지 않았습니다.")

    # 보안: 입력 검증 및 정제
    input_str = _sanitize_url_input(url)
    if not input_str:
        raise HTTPException(status_code=400, detail="유효하지 않은 입력입니다.")

    print(f"[Master Web Scraper] Processing Input: {input_str}")
    
    is_url = input_str.startswith("http://") or input_str.startswith("https://")

    if is_url:
        final_dest_url, raw_html_text = await scrape_dynamic_web_content(input_str)
        store_name, live_menus = orchestrate_menu_parsing_with_gpt(
            image_bytes=None, 
            web_raw_text=raw_html_text, 
            store_name_hint=final_dest_url
        )
    else:
        # 상호명 입력 시: 네이버 검색으로 실제 메뉴 데이터 수집
        search_url = f"https://search.naver.com/search.naver?query={urllib.parse.quote(input_str + ' 메뉴')}"
        final_dest_url, raw_html_text = await scrape_dynamic_web_content(search_url)
        store_name, live_menus = orchestrate_menu_parsing_with_gpt(
            image_bytes=None, 
            web_raw_text=raw_html_text, 
            store_name_hint=input_str
        )

    # storeName 최종 정제 (URL/숫자/플랫폼명이면 기본값)
    if (store_name.startswith("http") or store_name.startswith("www.") or 
        store_name.isdigit() or len(store_name) > 50 or
        "toss" in store_name.lower() or "naver" in store_name.lower() or
        "/" in store_name or "=" in store_name or ".com" in store_name):
        store_name = "스캔 매장"

    return {
        "url": url,
        "storeName": store_name,
        "menuCount": len(live_menus),
        "menus": live_menus,
        "status": "success" if live_menus else "empty",
        "architecture": "ENSEMBLE_ML_SCRAPER_V2"
    }


@app.post("/ai/recommend", response_model=RecommendResponse)
def recommend_menu(req: RecommendRequest, mode: str = Query("hybrid")):
    if not req.menuList:
        raise HTTPException(status_code=400, detail="메뉴 리스트가 비어있습니다.")

    profile = req.presetProfile or "balance"
    custom_items, custom_price, candidates = custom_recommendation_engine_support(req, profile=profile)
    
    rec_items, rec_names, final_price, final_reason = orchestrate_recommendation_with_gpt(
        req=req,
        custom_best_combo=custom_items,
        custom_tot_price=custom_price,
        profile=profile
    )

    return RecommendResponse(
        recommendedItems=rec_items,
        recommendedMenus=rec_names,
        totalPrice=final_price,
        reason=final_reason,
        engineType="ENSEMBLE_KNAPSACK_ML_V2",
        profile=profile
    )


@app.put("/ai/re-recommend", response_model=RecommendResponse)
def re_recommend_menu(req: ReRecommendRequest, mode: str = Query("hybrid")):
    if not req.menuList:
        raise HTTPException(status_code=400, detail="메뉴 리스트가 비어있습니다.")

    # 다른 조합 추천 시 프로필 순환 (balance -> signature -> value)
    current_profile = req.presetProfile or "balance"
    profile_cycle = {"balance": "signature", "signature": "value", "value": "balance"}
    next_profile = profile_cycle.get(current_profile, "balance")

    custom_items, custom_price, candidates = custom_recommendation_engine_support(req, profile=next_profile)
    
    rec_items, rec_names, final_price, final_reason = orchestrate_recommendation_with_gpt(
        req=req,
        custom_best_combo=custom_items,
        custom_tot_price=custom_price,
        profile=next_profile
    )

    return RecommendResponse(
        recommendedItems=rec_items,
        recommendedMenus=rec_names,
        totalPrice=final_price,
        reason=final_reason,
        engineType="ENSEMBLE_KNAPSACK_ML_V2",
        profile=next_profile
    )
