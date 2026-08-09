// {1} 상태 관리


// STEP 2~6 입력값 저장용 기본 객체
const initialSurveyData = {
  peopleCount: 0,      // STEP 2: 인원수
  budget: 0,           // STEP 3: 예산
  vibe: '',            // STEP 4: 분위기
  dislikedFoods: [],   // STEP 5: 못먹는 음식
  traits: {}           // STEP 6: 대식가, 매운맛 등 인원 특징
};

// 스텝별 데이터 저장 함수 (STEP 2~6에서 호출)
function saveStepData(key, value) {
  let currentData = JSON.parse(localStorage.getItem('userSurvey')) || initialSurveyData;
  currentData[key] = value;
  localStorage.setItem('userSurvey', JSON.stringify(currentData));
  console.log(`[데이터 저장 완료] ${key}:`, value);
}

// {2} 백엔드 API 통신 함수 모음

const BASE_URL = 'http://localhost:8080'; // 백엔드 서버 주소

// [API 1] STEP 1: QR 스캔 후 메뉴판 데이터 로드 (POST /api/menu/scan)
async function scanQrMenu(qrUrl) {
  try {
    const response = await fetch(`${BASE_URL}/api/menu/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrUrl: qrUrl })
    });
    const data = await response.json();
    localStorage.setItem('menuData', JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("QR 스캔 API 에러:", error);
  }
}

// [API 2] STEP 7->8: AI 메뉴 최초 추천 요청 (POST /api/recommendation)
async function requestAiRecommendation() {
  const surveyData = JSON.parse(localStorage.getItem('userSurvey'));
  
  try {
    const response = await fetch(`${BASE_URL}/api/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(surveyData)
    });
    const result = await response.json();
    return result; // STEP 8 추천 결과 데이터 반환
  } catch (error) {
    console.error("AI 추천 요청 에러:", error);
  }
}

// [API 3] STEP 9: 조건 수정 후 AI 재추천 요청 (PUT /api/recommendation/{id})
async function updateRecommendation(recommendationId, updatedData) {
  try {
    const response = await fetch(`${BASE_URL}/api/recommendation/${recommendationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    return await response.json();
  } catch (error) {
    console.error("추천 수정 API 에러:", error);
  }
}

// [API 4] 히스토리: 추천 내역 전체 목록 조회 (GET /api/recommendation)
async function getHistoryList() {
  try {
    const response = await fetch(`${BASE_URL}/api/recommendation`);
    return await response.json();
  } catch (error) {
    console.error("히스토리 조회 에러:", error);
  }
}

// [API 5] 히스토리 단건/진행중 추천 상세 조회 (GET /api/recommendation/{id})
async function getRecommendationDetail(recommendationId) {
  try {
    const response = await fetch(`${BASE_URL}/api/recommendation/${recommendationId}`);
    return await response.json();
  } catch (error) {
    console.error("상세 내역 조회 에러:", error);
  }
}