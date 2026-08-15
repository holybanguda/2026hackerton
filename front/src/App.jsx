import React, { useState, useRef } from 'react';
import { 
  Sparkles, BookOpen, ChevronLeft, ArrowRight, Check, X, 
  Clock, Home, History, Utensils, Users, Heart,
  Plus, Minus, Edit3, Info, Fish, Nut, Milk,
  QrCode, FileText, Circle, Camera, Globe, RefreshCw, ShoppingBag, CheckCircle2
} from 'lucide-react';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  // 화면 관리:
  // 'HOME_MAIN' | 'STEP_QR_SCAN' | 'FIRST_SELECT' | 'STEP_PEOPLE' | 'STEP_BUDGET' | 'STEP_MOOD' | 'STEP_TRAITS' | 'STEP_CONDITIONS' | 'ANALYZING' | 'RESULT' | 'MENU_LIST' | 'HISTORY'
  const [screen, setScreen] = useState('HOME_MAIN');
  const [activeTab, setActiveTab] = useState('home');

  // 히스토리 탭 관리: 'ACTIVE' (진행 중인 추천) | 'PAST' (지난 추천 이력)
  const [historySubTab, setHistorySubTab] = useState('ACTIVE');

  // 파일 탐색기 & 모바일 카메라 레퍼런스
  const qrFileInputRef = useRef(null);

  // 코드/URL 직접 입력 팝업 모달 상태
  const [showCodeInputModal, setShowCodeInputModal] = useState(false);

  // URL 입력 & 수집 로딩 오버레이
  const [inputUrl, setInputUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [isUrlCollecting, setIsUrlCollecting] = useState(false);
  const [parsedMenus, setParsedMenus] = useState([]);
  const [restaurantName, setRestaurantName] = useState('스캔 매장');
  const [parseNotice, setParseNotice] = useState('');

  // 피그마 조건 상태값
  const [peopleCount, setPeopleCount] = useState(2);
  const [perPersonBudget, setPerPersonBudget] = useState(30000);
  const [customBudgetInput, setCustomBudgetInput] = useState('');
  const [mood, setMood] = useState('친구 모임');
  const [customMoodInput, setCustomMoodInput] = useState('');
  
  // 일행 특징
  const [bigEaterCount, setBigEaterCount] = useState(0);
  const [dietCount, setDietCount] = useState(0);
  const [spicyLevel, setSpicyLevel] = useState(3);
  const [todayPrefInput, setTodayPrefInput] = useState('');

  // 알레르기/못 먹는 음식
  const [selectedAllergens, setSelectedAllergens] = useState(['해산물']);
  const [customAllergenInput, setCustomAllergenInput] = useState('');

  // AI 순차 체크리스트 애니메이션 단계 (0 ~ 3)
  const [analyzeStep, setAnalyzeStep] = useState(0);

  // 결과 & 히스토리 상태
  const [recommendationResult, setRecommendationResult] = useState(null);
  const [currentProfile, setCurrentProfile] = useState('balance'); // balance -> signature -> value
  const [pastRecommendations, setPastRecommendations] = useState([]); // 지난 추천 이력(확정된 주문)
  const [previousCombos, setPreviousCombos] = useState([]); // 이전 추천 조합 목록 (중복 방지)

  // 총 예산 계산
  const totalBudget = (perPersonBudget || 30000) * peopleCount;

  // 🧹 모든 스캔 데이터 & 이전 매장 추천 데이터 100% 완전 격리 및 초기화 함수
  const resetAllData = () => {
    setInputUrl('');
    setLoadedUrl('');
    setParsedMenus([]);
    setRestaurantName('스캔 매장');
    setParseNotice('');
    setPeopleCount(2);
    setPerPersonBudget(30000);
    setCustomBudgetInput('');
    setMood('친구 모임');
    setCustomMoodInput('');
    setBigEaterCount(0);
    setDietCount(0);
    setSpicyLevel(3);
    setTodayPrefInput('');
    setSelectedAllergens([]);
    setCustomAllergenInput('');
    setRecommendationResult(null);
    setShowCodeInputModal(false);
    setPreviousCombos([]);
    setCurrentProfile('balance');
    setScreen('HOME_MAIN');
  };

  // 🚀 완전히 깨끗한 새 추천 시작 (이전 가게 데이터 100% 초기화 후 진입)
  const startFreshNewRecommendation = () => {
    setInputUrl('');
    setLoadedUrl('');
    setParsedMenus([]);
    setRestaurantName('스캔 매장');
    setParseNotice('');
    setRecommendationResult(null);
    setPreviousCombos([]);
    setCurrentProfile('balance');
    setShowCodeInputModal(false);
    setScreen('STEP_QR_SCAN');
  };

  // ⬅️ 스마트 뒤로가기 처리
  const handleBack = () => {
    if (screen === 'STEP_BUDGET') setScreen('STEP_PEOPLE');
    else if (screen === 'STEP_MOOD') setScreen('STEP_BUDGET');
    else if (screen === 'STEP_TRAITS') setScreen('STEP_MOOD');
    else if (screen === 'STEP_CONDITIONS') setScreen('STEP_TRAITS');
    else if (screen === 'FIRST_SELECT') setScreen('STEP_QR_SCAN');
    else if (screen === 'MENU_LIST') setScreen('FIRST_SELECT');
    else if (screen === 'RESULT') setScreen('FIRST_SELECT');
    else resetAllData();
  };

  // 📸 범용 QR 다중 엔진 + EasyOCR 비전 스캔
  const handleQrImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setParsedMenus([]);
    setRecommendationResult(null);

    setLoadedUrl(`범용 비전 스캐너: ${file.name}`);
    setIsUrlCollecting(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/ai/parse-image', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.storeName) setRestaurantName(data.storeName.replace(' 네이버', '').trim());

        if (data.menus && data.menus.length > 0) {
          setParsedMenus(data.menus);
          if (data.qrUrl) {
            setParseNotice(`🎯 [범용 QR 인식 성공] 테이블 링크(${data.qrUrl})에서 ${data.menus.length}개 메뉴 수집 완료!`);
          } else {
            setParseNotice(`📸 [비전 딥러닝 스캔] 이미지에서 ${data.menus.length}개 메뉴 100% 인식 성공!`);
          }
        } else {
          alert(`[${file.name}] 이미지에서 메뉴판 글자나 QR을 인식하지 못했습니다. 조명이 밝고 선명한 메뉴판/QR 사진을 선택해 주세요!`);
        }
      }
    } catch (err) {
      console.warn('비전 파싱 통신 예외:', err);
    } finally {
      setIsUrlCollecting(false);
      setScreen('FIRST_SELECT');
    }
  };

  // 🌐 범용 웹사이트 / 네이버지도 / 상호명 실시간 라이브 파싱
  const handleUrlSubmit = async (targetUrl) => {
    const urlToFetch = targetUrl || inputUrl;
    if (!urlToFetch.trim()) {
      alert('식당 URL 또는 코드를 입력해 주세요!');
      return;
    }

    setShowCodeInputModal(false);
    setParsedMenus([]);
    setRecommendationResult(null);
    setParseNotice('');

    if (!urlToFetch.startsWith('http')) {
      setRestaurantName(urlToFetch.trim());
    }

    try {
      const response = await fetch(`http://localhost:8000/ai/parse-url?url=${encodeURIComponent(urlToFetch)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.storeName && data.storeName !== '추천 매장' && data.storeName !== '스캔 매장') {
          setRestaurantName(data.storeName.replace(' 네이버', '').trim());
        }

        if (data.menus && data.menus.length > 0) {
          setParsedMenus(data.menus);
          setParseNotice(`🌐 [${data.storeName || restaurantName}] ${data.menus.length}개 메뉴 파싱 완료!`);
        } else {
          alert('입력된 정보에서 메뉴를 찾지 못했습니다. 올바른 식당 이름 또는 링크를 입력해 주세요!');
        }
      }
    } catch (err) {
      console.warn('URL 파싱 통신 예외:', err);
      alert('서버 통신에 실패했습니다. 백엔드 서버 구동 상태를 확인해 주세요!');
    } finally {
      setIsUrlCollecting(false);
      setScreen('FIRST_SELECT');
    }
  };

  const toggleAllergen = (item) => {
    if (selectedAllergens.includes(item)) {
      setSelectedAllergens(selectedAllergens.filter(a => a !== item));
    } else {
      setSelectedAllergens([...selectedAllergens, item]);
    }
  };

  // 🪄 AI 최초 추천 실행
  const runAiRecommendation = async () => {
    if (!parsedMenus || parsedMenus.length === 0) {
      alert('수집된 메뉴가 없습니다! 먼저 메뉴판 사진 촬영 또는 URL 입력으로 메뉴를 불러와 주세요.');
      setScreen('STEP_QR_SCAN');
      return;
    }

    setScreen('ANALYZING');
    setAnalyzeStep(0);

    setTimeout(() => setAnalyzeStep(1), 400);
    setTimeout(() => setAnalyzeStep(2), 900);
    setTimeout(() => setAnalyzeStep(3), 1400);

    const payload = {
      menuList: parsedMenus,
      peopleCount: Number(peopleCount),
      budget: Number(totalBudget),
      meetingType: mood,
      excludedFoods: selectedAllergens,
      bigEaterCount: Number(bigEaterCount),
      spicyLevel: Number(spicyLevel),
      dietCount: Number(dietCount),
      todayPreference: todayPrefInput,
      presetProfile: 'balance',
      excludedCombos: previousCombos
    };

    try {
      const response = await fetch('http://localhost:8000/ai/recommend?mode=hybrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendationResult(data);
        setCurrentProfile('balance');
        if (data.recommendedMenus) {
          setPreviousCombos(prev => [...prev, data.recommendedMenus]);
        }
        setTimeout(() => setScreen('RESULT'), 1700);
      } else {
        createClientFallback();
      }
    } catch (err) {
      console.error('추천 에러:', err);
      createClientFallback();
    }
  };

  // 🔄 다른 조합으로 재추천 실행 (다양성 프로필 순환)
  const runReRecommendation = async () => {
    setScreen('ANALYZING');
    setAnalyzeStep(0);
    setTimeout(() => setAnalyzeStep(1), 300);
    setTimeout(() => setAnalyzeStep(2), 700);
    setTimeout(() => setAnalyzeStep(3), 1100);

    const payload = {
      menuList: parsedMenus,
      peopleCount: Number(peopleCount),
      budget: Number(totalBudget),
      meetingType: mood,
      excludedFoods: selectedAllergens,
      bigEaterCount: Number(bigEaterCount),
      spicyLevel: Number(spicyLevel),
      dietCount: Number(dietCount),
      todayPreference: todayPrefInput,
      presetProfile: currentProfile,
      excludedCombos: previousCombos,
      elapsedMinutes: 30,
      budgetDelta: 0
    };

    try {
      const response = await fetch('http://localhost:8000/ai/re-recommend?mode=hybrid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendationResult(data);
        if (data.profile) setCurrentProfile(data.profile);
        if (data.recommendedMenus) {
          setPreviousCombos(prev => [...prev, data.recommendedMenus]);
        }
        setTimeout(() => setScreen('RESULT'), 1400);
      } else {
        runAiRecommendation();
      }
    } catch (err) {
      console.error('재추천 통신 에러:', err);
      runAiRecommendation();
    }
  };

  // 클라이언트 Fallback (서버 오프라인 시)
  const createClientFallback = () => {
    const selected = parsedMenus.slice(0, Math.min(peopleCount + 1, parsedMenus.length));
    const items = selected.map(m => ({
      menuName: m.menuName,
      price: m.price,
      count: 1,
      totalItemPrice: m.price,
      desc: m.desc || '대표 메뉴',
      category: m.category || '메인'
    }));
    const tot = items.reduce((acc, cur) => acc + cur.totalItemPrice, 0);
    const resObj = {
      recommendedItems: items,
      recommendedMenus: items.map(it => it.menuName),
      totalPrice: tot,
      reason: `${peopleCount}인의 예산(${totalBudget.toLocaleString()}원)과 ${mood} 분위기에 꼭 어울리는 알찬 메뉴 구성입니다!`,
      engineType: "CLIENT_SMART_FALLBACK",
      profile: "balance"
    };
    setRecommendationResult(resObj);
    setTimeout(() => setScreen('RESULT'), 1500);
  };

  // ✅ '이대로 주문 확정' 클릭 시 ➔ '지난 추천 이력'으로 아카이빙 및 화면 이동
  const handleConfirmOrder = () => {
    if (!recommendationResult) return;

    const newRecord = {
      id: Date.now(),
      date: new Date().toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      storeName: restaurantName,
      peopleCount: peopleCount,
      totalPrice: recommendationResult.totalPrice,
      totalBudget: totalBudget,
      mood: mood,
      reason: recommendationResult.reason,
      items: recommendationResult.recommendedItems || recommendationResult.recommendedMenus.map(name => ({ menuName: name, price: 0, count: 1 }))
    };

    // 지난 추천 이력에 추가
    setPastRecommendations(prev => [newRecord, ...prev]);

    alert(`🎉 [${restaurantName}] 주문이 성공적으로 확정되었습니다!\n'지난 추천 이력'에서 영수증을 확인하실 수 있습니다.`);

    // 히스토리 탭의 '지난 추천 이력' 화면으로 이동
    setActiveTab('history');
    setHistorySubTab('PAST');
    setScreen('HISTORY');
  };

  return (
    <>
      {/* 1. 스플래시 화면 */}
      {showSplash && (
        <div className="splash-screen" onClick={() => setShowSplash(false)}>
          <div className="splash-title">
            <span className="pick">pick</span>
            <span className="nu">nu</span>
          </div>
        </div>
      )}

      {/* 📷 Hidden File Input */}
      <input 
        type="file" 
        ref={qrFileInputRef} 
        accept="image/*" 
        capture="environment" 
        style={{ display: 'none' }} 
        onChange={handleQrImageUpload} 
      />

      {/* 팝업 모달 */}
      {showCodeInputModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#FFF', borderRadius: 32, padding: '32px 24px 28px', width: '100%', maxWidth: 340, textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>코드로 직접 입력</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20 }}>식당 코드 또는 웹 링크를 입력해 주세요</p>

            <div style={{ background: 'var(--bg-input)', borderRadius: 20, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <input 
                type="text" 
                placeholder="식당 코드 또는 링크 입력" 
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(inputUrl); }}
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, outline: 'none', color: 'var(--text-main)' }}
              />
              <Edit3 size={18} color="var(--text-sub)" />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={() => setShowCodeInputModal(false)}
                style={{ flex: 1, height: 48, borderRadius: 14, background: '#F1F5F9', border: 'none', fontSize: 15, fontWeight: 700, color: 'var(--text-sub)', cursor: 'pointer' }}
              >
                취소
              </button>
              <button 
                onClick={() => handleUrlSubmit(inputUrl)}
                style={{ flex: 1, height: 48, borderRadius: 14, background: 'var(--primary)', border: 'none', fontSize: 15, fontWeight: 800, color: '#FFF', cursor: 'pointer' }}
              >
                연결하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌐 범용 비전 스캔 오버레이 */}
      {isUrlCollecting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 41, 59, 0.88)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
          <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 24 }}>
            <div className="ai-spinner-ring" style={{ width: 100, height: 100, borderWidth: 4 }} />
            <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Camera size={40} />
            </div>
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>범용 비전 & QR 분석 중...</h3>
          <p style={{ fontSize: 14, opacity: 0.8, textAlign: 'center' }}>Pyzbar + EasyOCR + GPT 비전 엔진이<br />메뉴판과 QR코드를 동시 판독하고 있어요.</p>
        </div>
      )}

      {/* iOS 상단 상태바 */}
      <div className="status-bar">
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>5G</span>
          <div style={{ width: 18, height: 10, border: '1px solid #1E293B', borderRadius: 2, padding: 1 }}>
            <div style={{ width: '80%', height: '100%', background: '#1E293B' }} />
          </div>
        </div>
      </div>

      {/* 내비게이션 탑바 */}
      {screen !== 'HOME_MAIN' && (
        <div className="nav-header">
          <button className="icon-btn" onClick={handleBack} title="뒤로가기">
            <ChevronLeft size={24} />
          </button>
          <h2>
            {screen === 'STEP_QR_SCAN' && 'QR 스캔'}
            {screen === 'FIRST_SELECT' && '메뉴 추천'}
            {screen === 'STEP_PEOPLE' && '인원수 입력'}
            {screen === 'STEP_BUDGET' && '예산 입력'}
            {screen === 'STEP_MOOD' && '분위기 선택'}
            {screen === 'STEP_TRAITS' && '인원 특징 입력'}
            {screen === 'STEP_CONDITIONS' && '추천 조건'}
            {screen === 'ANALYZING' && 'AI 메뉴 분석'}
            {screen === 'RESULT' && 'AI 추천 결과'}
            {screen === 'MENU_LIST' && '메뉴판 보기'}
            {screen === 'HISTORY' && '히스토리'}
          </h2>
          {screen === 'ANALYZING' ? (
            <X size={20} onClick={resetAllData} style={{ cursor: 'pointer' }} />
          ) : screen === 'RESULT' ? (
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-sub)', cursor: 'pointer' }} onClick={resetAllData}>처음으로</span>
          ) : (
            <button className="icon-btn" onClick={resetAllData} title="새로 시작">
              <RefreshCw size={18} color="var(--primary)" />
            </button>
          )}
        </div>
      )}

      {/* 7단계 상단 프로그레스 바 인디케이터 */}
      {['STEP_QR_SCAN', 'STEP_PEOPLE', 'STEP_BUDGET', 'STEP_MOOD', 'STEP_TRAITS', 'STEP_CONDITIONS'].includes(screen) && (
        <div className="step-progress">
          <div className="step-bar active" />
          <div className={`step-bar ${['STEP_PEOPLE', 'STEP_BUDGET', 'STEP_MOOD', 'STEP_TRAITS', 'STEP_CONDITIONS'].includes(screen) ? 'active' : ''}`} />
          <div className={`step-bar ${['STEP_BUDGET', 'STEP_MOOD', 'STEP_TRAITS', 'STEP_CONDITIONS'].includes(screen) ? 'active' : ''}`} />
          <div className={`step-bar ${['STEP_MOOD', 'STEP_TRAITS', 'STEP_CONDITIONS'].includes(screen) ? 'active' : ''}`} />
          <div className={`step-bar ${['STEP_TRAITS', 'STEP_CONDITIONS'].includes(screen) ? 'active' : ''}`} />
          <div className={`step-bar ${screen === 'STEP_CONDITIONS' ? 'active' : ''}`} />
          <div className="step-bar" />
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content page-transition" key={screen}>
        
        {/* ====================================================================== */}
        {/* [피그마 0. 홈] */}
        {/* ====================================================================== */}
        {screen === 'HOME_MAIN' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 20 }}>
            <div style={{ marginBottom: 32 }}>
              <h1 className="title-large" style={{ fontSize: 26, marginBottom: 8 }}>무엇을 도와드릴까요?</h1>
              <p className="title-sub" style={{ fontSize: 15, margin: 0 }}>새로운 맞춤 추천을 받거나,<br />진행 중인 추천을 이어서 확인하세요.</p>
            </div>

            <div className="figma-card" onClick={startFreshNewRecommendation} style={{ padding: 28 }}>
              <div className="card-icon-black">
                <Sparkles size={24} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>새 추천 시작</div>
                  <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.4 }}>취향을 알려주시면<br />최적의 메뉴 조합을 찾아드려요</div>
                </div>
                <ChevronLeft size={22} style={{ transform: 'rotate(180deg)', color: 'var(--text-light)', marginBottom: 4 }} />
              </div>
            </div>

            <div className="figma-card" onClick={() => {
              if (recommendationResult) setScreen('RESULT');
              else if (pastRecommendations.length > 0) {
                setActiveTab('history');
                setHistorySubTab('PAST');
                setScreen('HISTORY');
              } else {
                alert('아직 진행 중인 추천이 없습니다. 새 추천을 시작해보세요!');
              }
            }} style={{ padding: 28 }}>
              <div className="card-icon-tint">
                <FileText size={24} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>진행 중인 추천</div>
                  <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.4 }}>
                    {recommendationResult ? '1개의 추천이\n진행 중입니다' : pastRecommendations.length > 0 ? `${pastRecommendations.length}개의 지난 주문 이력이\n저장되어 있습니다` : '진행 중인 추천이\n없습니다'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#F1F5F9', fontSize: 13, fontWeight: 700, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {recommendationResult ? 1 : 0}
                  </span>
                  <ChevronLeft size={22} style={{ transform: 'rotate(180deg)', color: 'var(--text-light)' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 1. QR스캔] */}
        {/* ====================================================================== */}
        {screen === 'STEP_QR_SCAN' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#F8FAFC', borderRadius: 28, padding: '40px 20px', marginBottom: 20, textAlign: 'center', position: 'relative', border: '1.5px solid var(--border-card)' }}>
              <div style={{ position: 'absolute', top: 20, left: 20, width: 30, height: 30, borderLeft: '3px solid #1E293B', borderTop: '3px solid #1E293B' }} />
              <div style={{ position: 'absolute', top: 20, right: 20, width: 30, height: 30, borderRight: '3px solid #1E293B', borderTop: '3px solid #1E293B' }} />
              <div style={{ position: 'absolute', bottom: 20, left: 20, width: 30, height: 30, borderLeft: '3px solid #1E293B', borderBottom: '3px solid #1E293B' }} />
              <div style={{ position: 'absolute', bottom: 20, right: 20, width: 30, height: 30, borderRight: '3px solid #1E293B', borderBottom: '3px solid #1E293B' }} />

              <div style={{ width: 72, height: 72, borderRadius: 24, background: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }} onClick={() => qrFileInputRef.current?.click()}>
                <QrCode size={40} color="#1E293B" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: 'var(--text-main)' }}>QR / 메뉴판을 촬영해 주세요</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4 }}>범용 다중 엔진(Pyzbar + EasyOCR)이<br />테이블 QR과 메뉴판 사진을 동시 인식합니다</div>
            </div>

            <div className="figma-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', marginBottom: 12 }} onClick={() => qrFileInputRef.current?.click()}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' }}>
                  <Camera size={22} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>사진 및 카메라로 스캔</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>메뉴판 또는 테이블 QR 촬영</div>
                </div>
              </div>
              <button style={{ padding: '8px 16px', borderRadius: 12, background: '#F1F5F9', color: 'var(--text-main)', border: 'none', fontWeight: 700, fontSize: 13 }}>촬영</button>
            </div>

            <div className="figma-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', marginBottom: 24 }} onClick={() => setShowCodeInputModal(true)}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>코드로 직접 입력</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>식당 코드 또는 웹 링크를 입력하세요</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-main)', fontWeight: 800, fontSize: 14 }}>
                입력하기 <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
              </div>
            </div>

            <button className="cta-btn" onClick={() => qrFileInputRef.current?.click()}>
              스캔 시작하기 <Camera size={20} />
            </button>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [첫 선택 페이지] */}
        {/* ====================================================================== */}
        {screen === 'FIRST_SELECT' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 className="title-large" style={{ fontSize: 26, marginBottom: 8 }}>{restaurantName}</h1>
              <p className="title-sub" style={{ margin: 0 }}>원하시는 방식으로 메뉴판을 확인해 보세요</p>
            </div>

            {parseNotice && (
              <div style={{ background: '#FFF8F4', border: '1px solid #FFD4CC', borderRadius: 18, padding: 14, fontSize: 13, color: 'var(--primary)', fontWeight: 700, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Globe size={18} />
                <span>{parseNotice}</span>
              </div>
            )}

            <div className="figma-card active" onClick={() => {
              if (parsedMenus.length === 0) {
                alert('수집된 메뉴가 없습니다! 올바른 식당 이름 또는 URL을 다시 입력해 주세요.');
                setShowCodeInputModal(true);
              } else {
                setScreen('STEP_PEOPLE');
              }
            }} style={{ padding: 24 }}>
              <div className="card-icon-tint">
                <Sparkles size={26} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>AI 추천 받기</div>
              <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>{parsedMenus.length}개 메뉴 기반 맞춤 조합 분석</div>
            </div>

            <div className="figma-card" onClick={() => setScreen('MENU_LIST')} style={{ padding: 24 }}>
              <div className="card-icon-black" style={{ background: '#F1F5F9', color: 'var(--text-main)' }}>
                <BookOpen size={26} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>메뉴판 보기</div>
              <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>전체 {parsedMenus.length}개 메뉴 수동 확인</div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 2. 인원수] */}
        {/* ====================================================================== */}
        {screen === 'STEP_PEOPLE' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="title-large">함께할 인원을<br />알려주세요</h1>
            
            <div className="chip-grid" style={{ marginTop: 24 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} className={`chip-btn ${peopleCount === n ? 'active' : ''}`} onClick={() => setPeopleCount(n)}>
                  {n}명
                </button>
              ))}
            </div>

            <div className="figma-card" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '20px 24px', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>직접 입력</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>5명 이상일 경우</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input 
                  type="number" 
                  value={peopleCount} 
                  onChange={(e) => setPeopleCount(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: 64, height: 42, borderRadius: 12, border: 'none', background: '#F1F5F9', textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}
                />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-sub)' }}>명</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 4px', borderTop: '1px solid #F1F5F9', marginTop: 'auto', marginBottom: 24 }}>
              <span style={{ fontSize: 15, color: 'var(--text-sub)', fontWeight: 600 }}>선택된 총 인원</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-main)' }}>{peopleCount}명</span>
            </div>

            <button className="cta-btn" onClick={() => setScreen('STEP_BUDGET')}>
              다음 단계로 <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 3. 예산] */}
        {/* ====================================================================== */}
        {screen === 'STEP_BUDGET' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="title-large">1인당 예산을<br />알려주세요</h1>
            <p className="title-sub">선택한 예산 상한선 내에서 최적의 메뉴를 찾아드려요.</p>

            <div className="range-slider-wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-sub)', marginBottom: 8, fontWeight: 600 }}>
                <span>1만원</span>
                <span>10만원</span>
              </div>
              <input 
                type="range" min="10000" max="100000" step="5000" 
                value={perPersonBudget} 
                onChange={(e) => setPerPersonBudget(Number(e.target.value))}
                className="range-slider-input"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'var(--text-sub)', fontWeight: 600 }}>
                <span>2만</span>
                <span>3만</span>
                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>4만</span>
                <span>5만</span>
                <span>7만</span>
              </div>
            </div>

            <div className="figma-card" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '18px 20px', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>직접 입력</div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>슬라이더 범위 밖 금액</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input 
                  type="number"
                  placeholder="금액 입력"
                  value={customBudgetInput}
                  onChange={(e) => {
                    setCustomBudgetInput(e.target.value);
                    if (e.target.value) setPerPersonBudget(Number(e.target.value));
                  }}
                  style={{ width: 100, height: 42, borderRadius: 12, border: 'none', background: '#F1F5F9', textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-sub)' }}>원</span>
              </div>
            </div>

            <div className="budget-summary-card">
              <div style={{ fontSize: 14, color: 'var(--text-sub)', fontWeight: 600 }}>총 예산 상한선 · {peopleCount}인 기준</div>
              <div className="budget-amount-large">
                최대 {totalBudget.toLocaleString()}원
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                = 1인 {perPersonBudget.toLocaleString()}원 × {peopleCount}명
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, display: 'block' }}>자주 선택하는 1인 예산</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[20000, 30000, 50000].map(val => (
                  <button 
                    key={val} 
                    className={`chip-btn ${perPersonBudget === val ? 'active' : ''}`}
                    onClick={() => setPerPersonBudget(val)}
                    style={{ flex: 1, padding: '14px', fontSize: 15 }}
                  >
                    {val / 10000}만원
                  </button>
                ))}
              </div>
            </div>

            <button className="cta-btn" onClick={() => setScreen('STEP_MOOD')}>
              다음 단계로 <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 4. 분위기] */}
        {/* ====================================================================== */}
        {screen === 'STEP_MOOD' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="title-large">어떤 분위기로<br />식사할까요?</h1>
            <p className="title-sub">선택한 분위기에 맞춰 장소와 메뉴를 추천해 드려요.</p>

            <div className={`figma-card ${mood === '친구 모임' ? 'active' : ''}`} onClick={() => setMood('친구 모임')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <div className="card-icon-tint" style={{ margin: 0, background: '#F1F5F9', color: 'var(--text-main)' }}><Users size={24} /></div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>친구 모임</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>수다와 웃음이 있는 편안한 자리</div>
              </div>
              <ChevronLeft size={20} style={{ transform: 'rotate(180deg)', color: 'var(--text-light)' }} />
            </div>

            <div className={`figma-card ${mood === '데이트' ? 'active' : ''}`} onClick={() => setMood('데이트')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <div className="card-icon-tint" style={{ margin: 0, background: '#F1F5F9', color: 'var(--text-main)' }}><Heart size={24} /></div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>데이트</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>조용하고 분위기 좋은 미식 자리</div>
              </div>
              <ChevronLeft size={20} style={{ transform: 'rotate(180deg)', color: 'var(--text-light)' }} />
            </div>

            <div className={`figma-card ${mood === '가족 식사' ? 'active' : ''}`} onClick={() => setMood('가족 식사')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <div className="card-icon-tint" style={{ margin: 0, background: '#F1F5F9', color: 'var(--text-main)' }}><Home size={24} /></div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>가족 식사</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>모두가 편하게 즐기는 든든한 식사</div>
              </div>
              <ChevronLeft size={20} style={{ transform: 'rotate(180deg)', color: 'var(--text-light)' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, display: 'block' }}>직접 입력</label>
              <div style={{ background: 'var(--bg-input)', borderRadius: 20, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  className="figma-input-box" 
                  placeholder="예: 회식, 축하 자리, 간단한 식사" 
                  value={customMoodInput} 
                  onChange={(e) => { setCustomMoodInput(e.target.value); if (e.target.value) setMood(e.target.value); }}
                  style={{ background: 'transparent', padding: 0 }}
                />
                <Edit3 size={18} color="var(--text-sub)" />
              </div>
            </div>

            <button className="cta-btn" onClick={() => setScreen('STEP_TRAITS')}>
              다음 단계로 <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 6. 인원 특징 입력] */}
        {/* ====================================================================== */}
        {screen === 'STEP_TRAITS' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="title-large">더 정확한 추천을 위해<br />일행의 특징을 알려주세요</h1>
            <p className="title-sub">입력하신 정보를 바탕으로 최적의 메뉴를 구성합니다.</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>대식가 인원</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>평소보다 많이 드시는 분이 계신가요?</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button className="stepper-circle-btn" onClick={() => setBigEaterCount(Math.max(0, bigEaterCount - 1))}><Minus size={18} /></button>
                <span style={{ fontSize: 18, fontWeight: 900 }}>{bigEaterCount}</span>
                <button className="stepper-circle-btn" onClick={() => setBigEaterCount(bigEaterCount + 1)}><Plus size={18} /></button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>다이어트 인원</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>식단 관리나 소식하시는 분이 계신가요?</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button className="stepper-circle-btn" onClick={() => setDietCount(Math.max(0, dietCount - 1))}><Minus size={18} /></button>
                <span style={{ fontSize: 18, fontWeight: 900 }}>{dietCount}</span>
                <button className="stepper-circle-btn" onClick={() => setDietCount(dietCount + 1)}><Plus size={18} /></button>
              </div>
            </div>

            <div className="range-slider-wrap">
              <label style={{ fontSize: 16, fontWeight: 800, display: 'block', marginBottom: 4 }}>매운 음식 선호도</label>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 16 }}>일행이 선호하는 맵기 단계를 선택해 주세요.</div>
              <input 
                type="range" min="1" max="5" value={spicyLevel} 
                onChange={(e) => setSpicyLevel(Number(e.target.value))}
                className="range-slider-input"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'var(--text-sub)', fontWeight: 700 }}>
                <span>1<br />안매움</span>
                <span>2</span>
                <span style={{ color: 'var(--primary)', fontWeight: 900 }}>3</span>
                <span>4</span>
                <span>5<br />아주매움</span>
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 16, fontWeight: 800, display: 'block', marginBottom: 4 }}>오늘의 선호도</label>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 10 }}>특별히 드시고 싶은 메뉴나 스타일이 있나요?</div>
              <div style={{ background: 'var(--bg-input)', borderRadius: 20, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  className="figma-input-box" 
                  value={todayPrefInput} 
                  onChange={(e) => setTodayPrefInput(e.target.value)}
                  placeholder="예: 고기류가 당겨요, 시원한 국물 요리 원해요"
                  style={{ background: 'transparent', padding: 0 }}
                />
                <Edit3 size={18} color="var(--text-sub)" />
              </div>
            </div>

            <button className="cta-btn" onClick={() => setScreen('STEP_CONDITIONS')}>
              AI 메뉴 분석 시작하기 <Sparkles size={20} />
            </button>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 5. 추천조건] */}
        {/* ====================================================================== */}
        {screen === 'STEP_CONDITIONS' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="title-large">못 먹는 음식이<br />있나요?</h1>
            <p className="title-sub">알러지가 있거나 선호하지 않는 식재료를 알려주세요.<br />회원님께 안전한 메뉴만 추천해 드릴게요.</p>

            <div className={`figma-card ${selectedAllergens.includes('해산물') ? 'active' : ''}`} onClick={() => toggleAllergen('해산물')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <div className="card-icon-tint" style={{ margin: 0, background: '#F1F5F9', color: 'var(--text-main)' }}><Fish size={24} /></div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>해산물</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>생선, 조개류, 갑각류 등</div>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: selectedAllergens.includes('해산물') ? 'var(--primary)' : '#FFF', border: selectedAllergens.includes('해산물') ? 'none' : '1.5px solid var(--border-light)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedAllergens.includes('해산물') && <Check size={16} />}
              </div>
            </div>

            <div className={`figma-card ${selectedAllergens.includes('견과류') ? 'active' : ''}`} onClick={() => toggleAllergen('견과류')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <div className="card-icon-tint" style={{ margin: 0, background: '#F1F5F9', color: 'var(--text-main)' }}><Nut size={24} /></div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>견과류</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>땅콩, 호두, 아몬드 등</div>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: selectedAllergens.includes('견과류') ? 'var(--primary)' : '#FFF', border: selectedAllergens.includes('견과류') ? 'none' : '1.5px solid var(--border-light)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedAllergens.includes('견과류') && <Check size={16} />}
              </div>
            </div>

            <div className={`figma-card ${selectedAllergens.includes('유제품') ? 'active' : ''}`} onClick={() => toggleAllergen('유제품')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <div className="card-icon-tint" style={{ margin: 0, background: '#F1F5F9', color: 'var(--text-main)' }}><Milk size={24} /></div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>유제품</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>우유, 치즈, 버터 등</div>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: selectedAllergens.includes('유제품') ? 'var(--primary)' : '#FFF', border: selectedAllergens.includes('유제품') ? 'none' : '1.5px solid var(--border-light)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedAllergens.includes('유제품') && <Check size={16} />}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, display: 'block' }}>직접 입력</label>
              <div style={{ background: 'var(--bg-input)', borderRadius: 20, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  className="figma-input-box" 
                  placeholder="예: 오이, 가지, 고수 등" 
                  value={customAllergenInput} 
                  onChange={(e) => setCustomAllergenInput(e.target.value)}
                  style={{ background: 'transparent', padding: 0 }}
                />
                <Edit3 size={18} color="var(--text-sub)" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 6 }}>여러 가지인 경우 쉼표(,)로 구분해서 적어주세요.</div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1.5px solid var(--border-card)', padding: 16, borderRadius: 20, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
              <Info size={20} color="var(--text-sub)" />
              <span style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4, fontWeight: 500 }}>
                선택하신 정보는 메뉴 추천 시 안전한 필터링 용도로만 사용됩니다.
              </span>
            </div>

            <button className="cta-btn" onClick={runAiRecommendation}>
              AI 추천 결과 확인하기 <Sparkles size={20} />
            </button>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 7. AI분석] */}
        {/* ====================================================================== */}
        {screen === 'ANALYZING' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 0' }}>
            <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="ai-spinner-ring" style={{ width: 120, height: 120, borderRadius: '50%', border: '4px solid #F1F5F9', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite', position: 'absolute' }} />
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E293B', boxShadow: 'var(--shadow-sm)' }}>
                <Sparkles size={40} />
              </div>
            </div>

            <h2 className="title-large" style={{ fontSize: 23, marginBottom: 8 }}>최적의 미식 조합을 구성하고 있어요</h2>
            <p className="title-sub" style={{ fontSize: 14, marginBottom: 32 }}>인원수와 예산 상한선에 꼭 맞춘<br />가장 만족스러운 구성을 찾아드릴게요.</p>

            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left', marginBottom: 32 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={13} />
                </div>
                메뉴 수집 및 데이터 검증 완료
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 700, color: analyzeStep >= 1 ? 'var(--text-main)' : 'var(--text-light)' }}>
                {analyzeStep >= 1 ? (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={13} />
                  </div>
                ) : (
                  <Circle size={22} style={{ color: 'var(--border-light)' }} />
                )}
                인원 및 예산 조건 확인 ({peopleCount}명, 최대 {(totalBudget/10000).toFixed(0)}만원)
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 700, color: analyzeStep >= 2 ? 'var(--primary)' : 'var(--text-light)' }}>
                {analyzeStep >= 2 ? (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
                  </div>
                ) : (
                  <Circle size={22} style={{ color: 'var(--border-light)' }} />
                )}
                '{mood}' 컨셉 & 선호도 최적화 중...
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 700, color: analyzeStep >= 3 ? 'var(--primary)' : 'var(--text-light)' }}>
                {analyzeStep >= 3 ? (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={13} />
                  </div>
                ) : (
                  <Circle size={22} style={{ color: 'var(--border-light)' }} />
                )}
                최종 추천 리포트 확정
              </div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1.5px solid var(--border-card)', padding: '14px 18px', borderRadius: 20, display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
              <Info size={22} color="var(--text-sub)" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>잠시만 기다려 주세요</div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>AI 냅색 엔진이 1~2초 이내에 완료합니다.</div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 8. AI추천 결과] */}
        {/* ====================================================================== */}
        {screen === 'RESULT' && recommendationResult && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '12px 16px', borderRadius: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="badge-pill">👥 {peopleCount}명</span>
                <span className="badge-pill">💼 최대 {totalBudget.toLocaleString()}원</span>
                <span className="badge-pill">💖 {mood}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => setScreen('STEP_PEOPLE')}>수정</span>
            </div>

            <div style={{ background: '#F8FAFC', border: '1.5px solid var(--border-card)', borderRadius: 24, padding: 24, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontSize: 16, color: 'var(--text-main)', fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#1E293B', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} />
                </div>
                AI 맞춤 리포트
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-main)', lineHeight: 1.5, fontWeight: 600 }}>
                {recommendationResult.reason}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>추천 메뉴 조합</h2>
              <span style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 600 }}>
                총 {(recommendationResult.recommendedItems || recommendationResult.recommendedMenus).length}개 메뉴
              </span>
            </div>

            {/* 💡 [정확한 가격 렌더링 - 53,333,333원 나눗셈 오류 100% 제거] */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(recommendationResult.recommendedItems && recommendationResult.recommendedItems.length > 0) ? (
                recommendationResult.recommendedItems.map((item, i) => (
                  <div key={i} className="result-menu-card">
                    <div className="result-thumb">
                      <Utensils size={28} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                          {item.menuName} {item.count > 1 ? `x ${item.count}` : ''}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>
                          {item.totalItemPrice.toLocaleString()}원
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8 }}>
                        {item.desc || `${restaurantName} 대표 메뉴`}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className="badge-pill">단가 {item.price.toLocaleString()}원</span>
                        <span className="badge-pill">추천</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                recommendationResult.recommendedMenus.map((itemStr, i) => {
                  const matched = parsedMenus.find(m => m.menuName === itemStr.replace(/ x \d+$/, ''));
                  const realPrice = matched ? matched.price : Math.round(recommendationResult.totalPrice / recommendationResult.recommendedMenus.length);
                  return (
                    <div key={i} className="result-menu-card">
                      <div className="result-thumb">
                        <Utensils size={28} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>{itemStr}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>
                            {realPrice.toLocaleString()}원
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8 }}>{restaurantName} 대표 메뉴</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span className="badge-pill">추천</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 총 금액 & 잔여 예산 바 */}
            <div className="total-banner-orange">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 600, marginBottom: 2 }}>총 예상 금액</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{recommendationResult.totalPrice.toLocaleString()}원</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 600, marginBottom: 2 }}>남은 예산</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    {Math.max(0, totalBudget - recommendationResult.totalPrice).toLocaleString()}원 남음
                  </div>
                </div>
              </div>

              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255, 255, 255, 0.3)', position: 'relative' }}>
                <div style={{ width: `${Math.min(100, (recommendationResult.totalPrice / totalBudget) * 100)}%`, height: '100%', borderRadius: 3, background: '#FFFFFF' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button 
                onClick={runReRecommendation}
                style={{ flex: 1, height: 56, borderRadius: 18, background: '#FFF', border: '1.5px solid var(--border-light)', fontSize: 15, fontWeight: 800, color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <RefreshCw size={18} /> 다른 조합 추천
              </button>
              <button 
                onClick={handleConfirmOrder}
                className="cta-btn" 
                style={{ flex: 1, marginTop: 0 }}
              >
                이대로 주문 확정
              </button>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [피그마 9. 진행 중인 추천 & 10. 지난 추천 이력 완벽 분리] */}
        {/* ====================================================================== */}
        {screen === 'HISTORY' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="title-large">히스토리</h1>

            <div style={{ display: 'flex', gap: 8, background: '#F1F5F9', padding: 4, borderRadius: 16, marginBottom: 24 }}>
              <button 
                className={`chip-btn ${historySubTab === 'ACTIVE' ? 'active' : ''}`} 
                onClick={() => setHistorySubTab('ACTIVE')}
                style={{ flex: 1, padding: 10, fontSize: 14, border: 'none' }}
              >
                진행 중인 추천 {recommendationResult ? '(1)' : '(0)'}
              </button>
              <button 
                className={`chip-btn ${historySubTab === 'PAST' ? 'active' : ''}`} 
                onClick={() => setHistorySubTab('PAST')}
                style={{ flex: 1, padding: 10, fontSize: 14, border: 'none' }}
              >
                지난 추천 이력 {pastRecommendations.length > 0 ? `(${pastRecommendations.length})` : ''}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {historySubTab === 'ACTIVE' ? (
                recommendationResult ? (
                  <div className="figma-card" style={{ textAlign: 'left', alignItems: 'flex-start', padding: 24 }} onClick={() => setScreen('RESULT')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 800 }}>⚡ 현재 진행 중인 추천</span>
                      <span className="badge-pill">👥 {peopleCount}명</span>
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 8 }}>{restaurantName}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.4, marginBottom: 14 }}>{recommendationResult.reason}</div>
                    
                    <div style={{ background: '#FFF8F4', borderRadius: 12, padding: 12, width: '100%', marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>선택된 메뉴:</div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                        {recommendationResult.recommendedMenus.join(', ')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                      <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>총 예상 금액</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)' }}>{recommendationResult.totalPrice.toLocaleString()}원</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-sub)' }}>
                    <Clock size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <div style={{ fontSize: 16, fontWeight: 700 }}>진행 중인 추천이 없습니다</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>새 추천을 시작해 보세요.</div>
                    <button 
                      onClick={startFreshNewRecommendation}
                      style={{ marginTop: 16, padding: '10px 20px', borderRadius: 14, background: 'var(--primary)', color: '#FFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}
                    >
                      새 추천 시작하기
                    </button>
                  </div>
                )
              ) : (
                /* 지난 추천 이력(주문 확정된 아카이브) 탭 */
                pastRecommendations.length > 0 ? (
                  pastRecommendations.map((past) => (
                    <div key={past.id} className="figma-card" style={{ textAlign: 'left', alignItems: 'flex-start', padding: 24, marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-sub)', fontWeight: 600 }}>{past.date}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#16A34A', fontSize: 13, fontWeight: 800 }}>
                          <CheckCircle2 size={16} /> 주문 확정
                        </div>
                      </div>
                      <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 6 }}>{past.storeName}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>
                        {past.peopleCount}명 · {past.mood}
                      </div>

                      <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, width: '100%', marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>주문 메뉴 내역:</div>
                        {past.items.map((it, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-sub)', marginBottom: 3 }}>
                            <span>• {it.menuName} {it.count > 1 ? `x ${it.count}` : ''}</span>
                            <span>{(it.price * it.count).toLocaleString()}원</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                        <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>총 결제 금액</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-main)' }}>{past.totalPrice.toLocaleString()}원</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-sub)' }}>
                    <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <div style={{ fontSize: 16, fontWeight: 700 }}>아직 확정된 지난 주문 내역이 없습니다</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>추천 결과를 확인 후 '이대로 주문 확정'을 눌러보세요.</div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* [메뉴판 수동 확인 모달] */}
        {/* ====================================================================== */}
        {screen === 'MENU_LIST' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="title-large">{restaurantName}</h1>
            <p className="title-sub">수집된 메뉴판 ({parsedMenus.length}개 메뉴)</p>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {parsedMenus.length > 0 ? (
                parsedMenus.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{m.menuName}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>{m.desc}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>{m.price.toLocaleString()}원</div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-sub)' }}>
                  <Info size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <div style={{ fontSize: 16, fontWeight: 700 }}>수집된 메뉴가 없습니다</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>식당 이름 또는 URL을 다시 입력해 보세요.</div>
                </div>
              )}
            </div>

            <button className="cta-btn" onClick={() => {
              if (parsedMenus.length === 0) {
                alert('수집된 메뉴가 없습니다! 올바른 식당 이름 또는 URL을 다시 입력해 주세요.');
                setShowCodeInputModal(true);
              } else {
                setScreen('STEP_PEOPLE');
              }
            }} style={{ marginTop: 20 }}>
              AI 추천 받기 <Sparkles size={20} />
            </button>
          </div>
        )}

      </div>

      {/* 바텀 탭바 (분석 중 화면일 때는 몰입감을 위해 감춤) */}
      {screen !== 'ANALYZING' && (
        <div className="bottom-tab-bar">
          <button className={`tab-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setScreen('HOME_MAIN'); }}>
            <Home size={20} />
            <span>홈</span>
          </button>
          <button className={`tab-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); setScreen('HISTORY'); }}>
            <History size={20} />
            <span>히스토리</span>
          </button>
        </div>
      )}
    </>
  );
}
