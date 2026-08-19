# ─── AI Engine Docker Image (Railway 배포용) ───
# PyTorch CPU + EasyOCR + Playwright + Chromium 포함
# 예상 이미지 크기: ~1.5GB / 빌드 시간: 5~10분 (캐시 후 1~2분)

FROM python:3.11-slim

# 시스템 패키지 (Playwright/Chromium/pyzbar 의존성)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libzbar0 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1-mesa-glx \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libcups2 \
    libxkbcommon0 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리
WORKDIR /app

# 의존성 먼저 설치 (Docker 캐시 활용 - 코드 변경 시 재설치 불필요)
COPY requirements.txt .

# PyTorch CPU 버전 설치 (2GB → ~200MB로 경량화)
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch --index-url https://download.pytorch.org/whl/cpu

# 나머지 패키지 설치
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium 설치
RUN playwright install chromium && playwright install-deps chromium

# 소스 코드 복사
COPY . .

# EasyOCR 모델 사전 다운로드 (첫 요청 지연 방지)
RUN python -c "import easyocr; easyocr.Reader(['ko', 'en'], gpu=False, verbose=False)" || true

# 포트 설정 (Railway는 $PORT 환경변수 사용)
ENV PORT=8000
EXPOSE 8000

# 서버 실행
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
