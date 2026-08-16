// ==========================================
// 1. 전역 상태 및 스토리지 관리
// ==========================================

const initialSurveyData = {
  clientId: '',
  menuId: null,
  peopleCount: 2,
  budget: 60000,
  meetingType: '친구 모임',
  vibe: '친구 모임',
  excludedFoods: [],
  dislikedFoods: [],
  bigEaterCount: 0,
  spicyLevel: 3,
  dietCount: 0,
  todayPreference: '',
  traits: {}
};

/**
 * 스텝별 설문 데이터 저장 (localStorage & sessionStorage 동시 반영)
 */
function saveStepData(key, value) {
  let currentData = getSurveyData();
  currentData[key] = value;

  // 관련 키 alias 처리 (vibe <-> meetingType, excludedFoods <-> dislikedFoods)
  if (key === 'meetingType') currentData.vibe = value;
  if (key === 'vibe') currentData.meetingType = value;
  if (key === 'excludedFoods') currentData.dislikedFoods = value;
  if (key === 'dislikedFoods') currentData.excludedFoods = value;

  try {
    localStorage.setItem('userSurvey', JSON.stringify(currentData));
    sessionStorage.setItem('userSurvey', JSON.stringify(currentData));
    sessionStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  } catch (e) {
    console.warn('[스토리지 저장 경고]', e);
  }
  console.log(`[데이터 저장 완료] ${key}:`, value);
  return currentData;
}

/**
 * 저장된 설문 데이터 불러오기
 */
function getSurveyData() {
  try {
    const local = localStorage.getItem('userSurvey');
    const session = sessionStorage.getItem('userSurvey');
    let data = local ? JSON.parse(local) : (session ? JSON.parse(session) : null);
    if (!data) data = { ...initialSurveyData };

    // individual sessionStorage keys fallback
    if (sessionStorage.getItem('peopleCount')) data.peopleCount = Number(sessionStorage.getItem('peopleCount'));
    if (sessionStorage.getItem('budget')) data.budget = Number(sessionStorage.getItem('budget'));
    if (sessionStorage.getItem('meetingType')) data.meetingType = sessionStorage.getItem('meetingType');
    if (sessionStorage.getItem('excludedFoods')) {
      try { data.excludedFoods = JSON.parse(sessionStorage.getItem('excludedFoods')); } catch(e) {}
    }

    return data;
  } catch (e) {
    console.warn('[스토리지 읽기 에러]', e);
    return { ...initialSurveyData };
  }
}

// ==========================================
// 2. 오프라인 폴백 (Mock Data) 생성기
// ==========================================

const MOCK_MENU_DATA = {
  menuId: 101,
  restaurantName: '맛있는 스테이크 & 파스타',
  categories: ['메인', '파스타', '샐러드', '음료/와인'],
  menus: [
    { id: 1, name: '채끝 등심 스테이크', price: 28000, category: '메인', description: '미디엄 웰던 추천, 가니쉬 포함' },
    { id: 2, name: '트러플 크림 파스타', price: 16000, category: '파스타', description: '진한 트러플 향의 크림 소스' },
    { id: 3, name: '하우스 레드 와인 (2잔)', price: 14000, category: '음료/와인', description: '스테이크와 어울리는 바디감' },
    { id: 4, name: '리코타 치즈 샐러드', price: 12000, category: '샐러드', description: '신선한 야채와 고소한 리코타 치즈' },
    { id: 5, name: '매콤 알리오 올리오', price: 15000, category: '파스타', description: '마늘 향 가득한 매콤 오일 파스타' }
  ]
};

const MOCK_HISTORY_LIST = [
  { id: 1, status: '방문 완료', title: '채끝 등심 스테이크 외 2건', peopleCount: 3, meetingType: '데이트', price: 58000, icon: 'assets/history-utensils.png', createdAt: '2026-08-10' },
  { id: 2, status: '방문 완료', title: '프리미엄 모듬 스시 B세트', peopleCount: 2, meetingType: '비즈니스', price: 120000, icon: 'assets/history-fish.png', createdAt: '2026-08-08' },
  { id: 3, status: '취소됨', title: '정통 까르보나라 외 1건', peopleCount: 4, meetingType: '가족모임', price: 42000, icon: 'assets/history-pasta.png', createdAt: '2026-08-05' },
  { id: 4, status: '방문 완료', title: '매콤 제육 쌈밥 정식', peopleCount: 1, meetingType: '혼밥', price: 12000, icon: 'assets/history-vegetable.png', createdAt: '2026-08-01' }
];

function generateMockRecommendation(survey = {}) {
  const people = survey.peopleCount || 2;
  const totalBudget = survey.budget || 60000;
  const mood = survey.meetingType || survey.vibe || '데이트';
  
  const basePrice = Math.min(totalBudget - 2000, Math.max(20000, totalBudget));
  const mainPrice = Math.round(basePrice * 0.48 / 1000) * 1000;
  const sidePrice = Math.round(basePrice * 0.28 / 1000) * 1000;
  const drinkPrice = basePrice - mainPrice - sidePrice;
  const totalPrice = mainPrice + sidePrice + drinkPrice;
  const remaining = totalBudget - totalPrice;

  return {
    id: 1,
    status: '진행중',
    peopleCount: people,
    budget: totalBudget,
    meetingType: mood,
    reportSummary: `"${mood} 분위기에 맞춰 대화하기 좋은 깔끔한 메뉴 위주로 구성했습니다. 예산 내에서 즐기실 수 있는 최적의 조합입니다."`,
    menuList: [
      { id: 1, name: '채끝 등심 스테이크', description: '미디엄 웰던 추천, 가니쉬 포함', price: mainPrice, category: '메인', icon: 'assets/utensils.png', tags: ['인기', '추천'] },
      { id: 2, name: '트러플 크림 파스타', description: '진한 트러플 향의 크림 소스', price: sidePrice, category: '파스타', icon: 'assets/utensils.png', tags: [] },
      { id: 3, name: '하우스 레드 와인 (2잔)', description: '스테이크와 어울리는 바디감', price: drinkPrice, category: '음료', icon: 'assets/wine-glass.png', tags: [] }
    ],
    totalPrice: totalPrice,
    remainingBudget: remaining,
    createdAt: new Date().toISOString()
  };
}

// ==========================================
// 3. 백엔드 API 통신 함수 모음
// ==========================================

const BASE_URL = 'http://localhost:8080'; // 백엔드 서버 주소

/**
 * [API 1] STEP 1: QR 스캔 후 메뉴판 데이터 로드 (POST /api/menu/scan)
 */
async function scanQrMenu(qrUrl) {
  const requestPayload = { qrUrl: qrUrl || 'https://menu.example.com/table/1' };
  console.log('[API Call] POST /api/menu/scan', requestPayload);

  try {
    const response = await fetch(`${BASE_URL}/api/menu/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    localStorage.setItem('menuData', JSON.stringify(data));
    sessionStorage.setItem('menuId', String(data.menuId || 101));
    console.log('[API Success] QR 스캔 성공:', data);
    return data;
  } catch (error) {
    console.warn('[API Fallback] 백엔드 미연결/오류로 Mock 데이터 사용:', error.message);
    const mockData = { ...MOCK_MENU_DATA, qrUrl: requestPayload.qrUrl };
    localStorage.setItem('menuData', JSON.stringify(mockData));
    sessionStorage.setItem('menuId', String(mockData.menuId));
    return mockData;
  }
}

/**
 * [API 2] STEP 7->8: AI 메뉴 최초 추천 요청 (POST /api/recommendation)
 */
async function requestAiRecommendation(overrideData = null) {
  const surveyData = overrideData || getSurveyData();
  console.log('[API Call] POST /api/recommendation', surveyData);

  try {
    const response = await fetch(`${BASE_URL}/api/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(surveyData)
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    sessionStorage.setItem('aiResult', JSON.stringify(result));
    console.log('[API Success] AI 추천 수신 성공:', result);
    return result;
  } catch (error) {
    console.warn('[API Fallback] 백엔드 미연결/오류로 Mock AI 추천 사용:', error.message);
    const mockResult = generateMockRecommendation(surveyData);
    sessionStorage.setItem('aiResult', JSON.stringify(mockResult));
    return mockResult;
  }
}

/**
 * [API 3] STEP 9: 조건 수정 후 AI 재추천 요청 (PUT /api/recommendation/{id})
 */
async function updateRecommendation(recommendationId, updatedData) {
  const reqId = recommendationId || 1;
  console.log(`[API Call] PUT /api/recommendation/${reqId}`, updatedData);

  try {
    const response = await fetch(`${BASE_URL}/api/recommendation/${reqId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    sessionStorage.setItem('aiResult', JSON.stringify(result));
    console.log('[API Success] 추천 수정 성공:', result);
    return result;
  } catch (error) {
    console.warn('[API Fallback] 백엔드 미연결/오류로 Mock 추천 수정 사용:', error.message);
    const currentSurvey = getSurveyData();
    const mergedData = { ...currentSurvey, ...updatedData };
    saveStepData('peopleCount', mergedData.peopleCount);
    saveStepData('budget', mergedData.budget);
    
    const mockUpdatedResult = generateMockRecommendation(mergedData);
    mockUpdatedResult.id = reqId;
    sessionStorage.setItem('aiResult', JSON.stringify(mockUpdatedResult));
    return mockUpdatedResult;
  }
}

/**
 * [API 4] 히스토리: 추천 내역 전체 목록 조회 (GET /api/recommendation)
 */
async function getHistoryList() {
  console.log('[API Call] GET /api/recommendation');

  try {
    const response = await fetch(`${BASE_URL}/api/recommendation`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const list = await response.json();
    console.log('[API Success] 히스토리 목록 수신:', list);
    return list;
  } catch (error) {
    console.warn('[API Fallback] 백엔드 미연결/오류로 Mock 히스토리 사용:', error.message);
    return MOCK_HISTORY_LIST;
  }
}

/**
 * [API 5] 히스토리 단건/진행중 추천 상세 조회 (GET /api/recommendation/{id})
 */
async function getRecommendationDetail(recommendationId) {
  const reqId = recommendationId || 1;
  console.log(`[API Call] GET /api/recommendation/${reqId}`);

  try {
    const response = await fetch(`${BASE_URL}/api/recommendation/${reqId}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const detail = await response.json();
    console.log('[API Success] 추천 상세 수신:', detail);
    return detail;
  } catch (error) {
    console.warn('[API Fallback] 백엔드 미연결/오류로 Mock 상세 사용:', error.message);
    const stored = sessionStorage.getItem('aiResult');
    if (stored) {
      try { return JSON.parse(stored); } catch (e) {}
    }
    return generateMockRecommendation();
  }
}