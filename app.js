// ==========================================
// 1. DOM 요소 및 상태 초기화
// ==========================================

const toast = document.querySelector('#toast');
let activeRecommendation = null;
let historyItemsData = [];
let cameraStream = null;

// 전역 설문 상태 (api.js의 getSurveyData()와 동기화)
let currentSurveyState = {
  peopleCount: 2,
  budget: 60000,
  meetingType: '친구 모임',
  vibe: '친구 모임',
  excludedFoods: ['해산물'],
  bigEaterCount: 0,
  dietCount: 0,
  spicyLevel: 3,
  todayPreference: ''
};

// 하단 네비게이션 아이콘 동적 적용
const navIcons = ['assets/nav-home.png', 'assets/nav-history.png'];
document.querySelectorAll('.bottom-nav .nav-item span').forEach((slot, index) => {
  const icon = document.createElement('img');
  icon.src = navIcons[index];
  icon.alt = '';
  slot.replaceChildren(icon);
});

// ==========================================
// 2. 화면 전환 및 토스트 유틸리티
// ==========================================

function showScreen(screenId, activeTab = screenId) {
  document.querySelectorAll('.screen').forEach((item) => item.classList.remove('active'));
  const target = document.querySelector(`#${screenId}`);
  if (target) target.classList.add('active');

  // 하단 탭 선택 상태 업데이트
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('selected', item.dataset.screen === activeTab);
  });

  // 화면별 데이터 리프레시
  if (screenId === 'history-screen') {
    renderHistoryScreen();
  } else if (screenId === 'result-screen' && activeRecommendation) {
    renderResultScreen(activeRecommendation);
  }
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2000);
}

// ==========================================
// 3. STEP 1: 홈 화면 (home-screen)
// ==========================================

document.querySelector('[data-action="start"]').addEventListener('click', () => {
  showScreen('scan-screen', 'home-screen');
});

document.querySelector('[data-action="continue"]').addEventListener('click', async () => {
  if (activeRecommendation) {
    showScreen('result-screen', 'home-screen');
  } else {
    // 저장된 추천 내역 확인
    const saved = await getRecommendationDetail();
    if (saved) {
      activeRecommendation = saved;
      showScreen('result-screen', 'home-screen');
    } else {
      notify('진행 중인 추천이 없습니다. 새 추천을 시작해 보세요.');
    }
  }
});

// ==========================================
// 4. STEP 2: QR 스캔 화면 (scan-screen) 및 카메라/코드 모달
// ==========================================

document.querySelector('#back-button').addEventListener('click', () => showScreen('home-screen'));

document.querySelector('#permission').addEventListener('click', async () => {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      notify('카메라 권한이 허용되었습니다.');
    } else {
      notify('카메라 권한 설정을 확인해 주세요.');
    }
  } catch (e) {
    notify('카메라 권한 설정을 확인해 주세요.');
  }
});

// A. 카메라 스캐너 모달 제어
const cameraModal = document.querySelector('#camera-modal');
const cameraVideo = document.querySelector('#camera-video');

async function openCameraModal() {
  cameraModal.classList.add('active');
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraVideo.srcObject = cameraStream;
    }
  } catch (e) {
    console.warn('카메라 스트림 미지원 또는 거부됨 (가상 스캐너 모드로 동작)', e);
  }
}

function closeCameraModal() {
  cameraModal.classList.remove('active');
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
}

document.querySelector('#camera-close-btn').addEventListener('click', closeCameraModal);

// [스캔 시작하기] 버튼 클릭시 -> 카메라 스캐너 모달 오픈
document.querySelector('#scan-submit').addEventListener('click', () => {
  openCameraModal();
});

// 카메라 스캐너 내 [QR 스캔 완료] 또는 자동 스캔 트리거
async function finishQrScan(qrUrl) {
  closeCameraModal();
  notify('QR 코드가 성공적으로 스캔되었습니다!');
  const menuData = await scanQrMenu(qrUrl);
  if (menuData) {
    notify(`[${menuData.restaurantName || '메뉴판'}] 데이터를 성공적으로 로드했습니다.`);
  }
  // 스캔 완료 후에만 인원수 입력 화면으로 이동
  showScreen('member-screen', 'home-screen');
}

document.querySelector('#camera-trigger-scan').addEventListener('click', () => {
  finishQrScan('https://menu.example.com/table/1');
});

// B. 코드로 직접 입력 모달 제어
const codeModal = document.querySelector('#code-modal');
const codeInput = document.querySelector('#direct-code-input');

function openCodeModal() {
  codeModal.classList.add('active');
  codeInput.value = '';
  codeInput.focus();
}

function closeCodeModal() {
  codeModal.classList.remove('active');
}

document.querySelector('#code-entry').addEventListener('click', openCodeModal);
document.querySelector('#code-modal-close').addEventListener('click', closeCodeModal);
document.querySelector('#code-modal-cancel').addEventListener('click', closeCodeModal);

document.querySelector('#code-modal-submit').addEventListener('click', async () => {
  const code = codeInput.value.trim() || 'TABLE-101';
  closeCodeModal();
  notify(`코드 [${code}] 입력 완료! 백엔드로 스캔 전송 중...`);
  const menuData = await scanQrMenu(`https://menu.example.com/table/${code}`);
  if (menuData) {
    notify(`[${menuData.restaurantName || '메뉴판'}] 데이터를 로드했습니다.`);
  }
  // 입력 및 스캔 처리 후에만 인원수 입력 화면으로 이동
  showScreen('member-screen', 'home-screen');
});

codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.querySelector('#code-modal-submit').click();
  }
});

// ==========================================
// 5. STEP 3: 인원수 입력 화면 (member-screen)
// ==========================================

document.querySelector('#member-back-button').addEventListener('click', () => showScreen('scan-screen', 'home-screen'));

document.querySelectorAll('[data-people]').forEach((item) => {
  item.addEventListener('click', () => {
    const count = Number(item.dataset.people);
    document.querySelectorAll('[data-people]').forEach((btn) => btn.classList.toggle('selected', btn === item));
    document.querySelector('#people-input').value = '';
    currentSurveyState.peopleCount = count;
    document.querySelector('#people-total').textContent = `${count}명`;
    saveStepData('peopleCount', count);
  });
});

document.querySelector('#people-input').addEventListener('input', (e) => {
  const count = Number(e.target.value);
  document.querySelectorAll('[data-people]').forEach((btn) => btn.classList.remove('selected'));
  if (count > 0 && count <= 99) {
    currentSurveyState.peopleCount = count;
    document.querySelector('#people-total').textContent = `${count}명`;
    saveStepData('peopleCount', count);
  } else {
    document.querySelector('#people-total').textContent = '0명';
  }
});

document.querySelector('#next-step').addEventListener('click', () => {
  const people = currentSurveyState.peopleCount || 2;
  document.querySelector('#budget-people').textContent = `${people}명 기준`;
  document.querySelector('#budget-people-count').textContent = `${people}명`;
  updateBudgetUI();
  showScreen('budget-screen', 'home-screen');
});

// ==========================================
// 6. STEP 4: 예산 입력 화면 (budget-screen)
// ==========================================

document.querySelector('#budget-back-button').addEventListener('click', () => showScreen('member-screen', 'home-screen'));

document.querySelector('#change-people').addEventListener('click', () => showScreen('member-screen', 'home-screen'));

function updateBudgetUI(perPersonValue) {
  const people = currentSurveyState.peopleCount || 2;
  const perPerson = Number(perPersonValue ?? document.querySelector('#budget-range').value) || 30000;
  const total = perPerson * people;
  
  currentSurveyState.budget = total;
  saveStepData('budget', total);

  const wonFormatter = new Intl.NumberFormat('ko-KR');
  document.querySelector('#total-budget').textContent = `총 ${wonFormatter.format(total)}원`;
  document.querySelector('#budget-formula').textContent = `= 1인 예산 ${wonFormatter.format(perPerson)}원 × ${people}명`;
}

document.querySelector('#budget-range').addEventListener('input', (e) => {
  document.querySelector('#budget-input').value = '';
  updateBudgetUI(e.target.value);
});

document.querySelector('#budget-input').addEventListener('input', (e) => {
  const val = Number(e.target.value.replace(/\D/g, ''));
  if (val >= 1000) {
    updateBudgetUI(val);
  }
});

document.querySelectorAll('[data-budget]').forEach((item) => {
  item.addEventListener('click', () => {
    const val = Number(item.dataset.budget);
    document.querySelector('#budget-range').value = val;
    document.querySelector('#budget-input').value = '';
    updateBudgetUI(val);
  });
});

document.querySelector('#budget-next').addEventListener('click', () => {
  showScreen('mood-screen', 'home-screen');
});

// ==========================================
// 7. STEP 5: 분위기 선택 화면 (mood-screen)
// ==========================================

document.querySelector('#mood-back').addEventListener('click', () => showScreen('budget-screen', 'home-screen'));

document.querySelectorAll('[data-mood]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('[data-mood]').forEach((btn) => btn.classList.remove('selected'));
    item.classList.add('selected');
    const moodText = item.dataset.mood;
    currentSurveyState.meetingType = moodText;
    currentSurveyState.vibe = moodText;
    saveStepData('meetingType', moodText);
  });
});

document.querySelector('#mood-next').addEventListener('click', () => {
  showScreen('condition-screen', 'home-screen');
});

// ==========================================
// 8. STEP 6: 추천 조건 / 못 먹는 음식 (condition-screen)
// ==========================================

document.querySelector('#condition-back').addEventListener('click', () => showScreen('mood-screen', 'home-screen'));

document.querySelectorAll('[data-allergy]').forEach((item) => {
  item.addEventListener('click', () => {
    item.classList.toggle('checked');
  });
});

document.querySelector('#condition-finish').addEventListener('click', () => {
  const selectedAllergies = Array.from(document.querySelectorAll('[data-allergy].checked')).map((btn) => btn.dataset.allergy);
  const customVal = document.querySelector('#condition-custom-input').value.trim();
  const customAllergies = customVal ? customVal.split(',').map((s) => s.trim()).filter(Boolean) : [];
  
  const totalExcluded = Array.from(new Set([...selectedAllergies, ...customAllergies]));
  currentSurveyState.excludedFoods = totalExcluded;
  saveStepData('excludedFoods', totalExcluded);

  notify('추천 조건 설정을 완료했어요.');
  showScreen('feature-screen', 'home-screen');
});

// ==========================================
// 9. STEP 7: 인원 특징 입력 (feature-screen)
// ==========================================

document.querySelector('#feature-back').addEventListener('click', () => showScreen('condition-screen', 'home-screen'));

document.querySelectorAll('[data-count]').forEach((button) => {
  button.addEventListener('click', () => {
    const type = button.dataset.count; // 'heavy' or 'diet'
    const target = document.querySelector(`#${type}-count`);
    const current = Math.max(0, Number(target.textContent) + Number(button.dataset.change));
    target.textContent = current;

    if (type === 'heavy') currentSurveyState.bigEaterCount = current;
    if (type === 'diet') currentSurveyState.dietCount = current;
  });
});

document.querySelector('#spice-range').addEventListener('input', (e) => {
  const val = Number(e.target.value);
  document.querySelector('#spice-value').textContent = `${val}단계`;
  currentSurveyState.spicyLevel = val;
});

document.querySelector('#feature-skip').addEventListener('click', () => {
  notify('특징 입력을 건너뜁니다.');
  startAiAnalysis();
});

document.querySelector('#feature-finish').addEventListener('click', () => {
  currentSurveyState.todayPreference = document.querySelector('#today-input').value.trim();
  saveStepData('traits', {
    bigEaterCount: currentSurveyState.bigEaterCount,
    dietCount: currentSurveyState.dietCount,
    spicyLevel: currentSurveyState.spicyLevel,
    todayPreference: currentSurveyState.todayPreference
  });
  startAiAnalysis();
});

// ==========================================
// 10. STEP 8: AI 분석 로딩 (analysis-screen)
// ==========================================

async function startAiAnalysis(overridePayload = null) {
  showScreen('analysis-screen', 'home-screen');

  // 분석 화면 상태 텍스트 동적 업데이트
  const people = currentSurveyState.peopleCount || 2;
  const budgetWon = new Intl.NumberFormat('ko-KR').format(currentSurveyState.budget || 60000);
  const mood = currentSurveyState.meetingType || '친구 모임';

  const step2 = document.querySelector('#analysis-step-2');
  const step3 = document.querySelector('#analysis-step-3');
  if (step2) step2.textContent = `인원 및 예산 조건 확인 (${people}명, ${budgetWon}원)`;
  if (step3) step3.textContent = `'${mood}' 컨셉 분석 중...`;

  const minDelay = new Promise((resolve) => setTimeout(resolve, 1500));
  const apiPromise = requestAiRecommendation(overridePayload || currentSurveyState);

  const [_, result] = await Promise.all([minDelay, apiPromise]);
  activeRecommendation = result;
  renderResultScreen(result);
  showScreen('result-screen', 'home-screen');
}

document.querySelector('#analysis-cancel').addEventListener('click', () => showScreen('feature-screen', 'home-screen'));
document.querySelector('#analysis-close').addEventListener('click', () => showScreen('feature-screen', 'home-screen'));

// ==========================================
// 11. STEP 9: AI 추천 결과 화면 (result-screen)
// ==========================================

function renderResultScreen(data) {
  if (!data) return;

  const wonFormatter = new Intl.NumberFormat('ko-KR');
  
  // Chips
  document.querySelector('#chip-people').textContent = `♟ ${data.peopleCount || 2}명`;
  document.querySelector('#chip-budget').textContent = `▣ ${wonFormatter.format(data.budget || 60000)}원`;
  document.querySelector('#chip-mood').textContent = `♥ ${data.meetingType || '데이트'}`;

  // Report Summary
  document.querySelector('#report-summary-text').textContent = data.reportSummary || '"분위기에 맞춰 추천 메뉴를 구성했습니다."';

  // Menu List
  const listContainer = document.querySelector('#recommended-menu-list');
  listContainer.innerHTML = '';

  const menus = data.menuList || [];
  document.querySelector('#menu-count-badge').textContent = `총 ${menus.length}개 메뉴`;

  menus.forEach((item) => {
    const article = document.createElement('article');
    
    const iconSlot = document.createElement('b');
    const img = document.createElement('img');
    img.src = item.icon || 'assets/utensils.png';
    img.alt = '';
    iconSlot.append(img);

    const spanCopy = document.createElement('span');
    const strongName = document.createElement('strong');
    strongName.textContent = item.name;
    const smallDesc = document.createElement('small');
    smallDesc.textContent = item.description;

    spanCopy.append(strongName, smallDesc);

    if (item.tags && item.tags.length > 0) {
      const tagBox = document.createElement('div');
      tagBox.className = 'menu-tags';
      item.tags.forEach((t) => {
        const b = document.createElement('b');
        b.textContent = t;
        tagBox.append(b);
      });
      spanCopy.append(tagBox);
    }

    const priceEm = document.createElement('em');
    priceEm.textContent = `${wonFormatter.format(item.price)}원`;

    article.append(iconSlot, spanCopy, priceEm);
    listContainer.append(article);
  });

  // Total Card
  document.querySelector('#total-price-text').textContent = `${wonFormatter.format(data.totalPrice || 0)}원`;
  const remaining = data.remainingBudget ?? ((data.budget || 0) - (data.totalPrice || 0));
  document.querySelector('#remaining-amount').textContent = `${wonFormatter.format(Math.max(0, remaining))}원 남음`;
}

document.querySelector('#result-back').addEventListener('click', () => showScreen('home-screen'));
document.querySelector('#result-home').addEventListener('click', () => showScreen('home-screen'));

document.querySelector('#btn-re-recommend').addEventListener('click', () => {
  populateEditScreen();
  showScreen('edit-screen', 'home-screen');
});

document.querySelector('#btn-confirm-order').addEventListener('click', () => {
  notify('🎉 주문이 성공적으로 확정되었습니다!');
  if (activeRecommendation) {
    activeRecommendation.status = '방문 완료';
    MOCK_HISTORY_LIST.unshift({
      id: Date.now(),
      status: '방문 완료',
      title: activeRecommendation.menuList[0]?.name + ` 외 ${activeRecommendation.menuList.length - 1}건`,
      peopleCount: activeRecommendation.peopleCount,
      meetingType: activeRecommendation.meetingType,
      price: activeRecommendation.totalPrice,
      icon: 'assets/history-utensils.png',
      createdAt: new Date().toISOString().slice(0, 10)
    });
  }
  showScreen('history-screen', 'history-screen');
});

// ==========================================
// 12. STEP 10: 추천 수정 화면 (edit-screen)
// ==========================================

function populateEditScreen() {
  if (!activeRecommendation) return;

  const wonFormatter = new Intl.NumberFormat('ko-KR');
  document.querySelector('#edit-current-price').textContent = `총 ${wonFormatter.format(activeRecommendation.totalPrice)}원`;
  document.querySelector('#edit-order-title').textContent = activeRecommendation.menuList[0]?.name + ` 외 ${activeRecommendation.menuList.length - 1}건`;
  document.querySelector('#edit-budget').value = wonFormatter.format(activeRecommendation.budget);
  document.querySelector('#edit-people-count').textContent = `${activeRecommendation.peopleCount}명`;
  document.querySelector('#edit-spice-range').value = currentSurveyState.spicyLevel || 3;

  renderEditTags();
}

function renderEditTags() {
  const container = document.querySelector('#edit-tags-container');
  container.innerHTML = '';

  const foods = currentSurveyState.excludedFoods || [];
  foods.forEach((food) => {
    const btn = document.createElement('button');
    btn.type = 'button';

    const spanLabel = document.createElement('span');
    spanLabel.textContent = food;
    const spanRemove = document.createElement('span');
    spanRemove.className = 'tag-remove';
    spanRemove.textContent = '×';
    spanRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      currentSurveyState.excludedFoods = currentSurveyState.excludedFoods.filter((f) => f !== food);
      saveStepData('excludedFoods', currentSurveyState.excludedFoods);
      renderEditTags();
    });

    btn.append(spanLabel, spanRemove);
    container.append(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.id = 'btn-add-edit-tag';
  addBtn.textContent = '＋ 추가하기';
  addBtn.addEventListener('click', () => {
    const input = prompt('제외할 음식을 입력하세요:');
    if (input && input.trim()) {
      currentSurveyState.excludedFoods.push(input.trim());
      saveStepData('excludedFoods', currentSurveyState.excludedFoods);
      renderEditTags();
    }
  });
  container.append(addBtn);
}

document.querySelector('#edit-budget').addEventListener('input', (e) => {
  const digits = e.target.value.replace(/\D/g, '');
  e.target.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
});

document.querySelectorAll('[data-add]').forEach((button) => {
  button.addEventListener('click', () => {
    const editBudgetInput = document.querySelector('#edit-budget');
    const current = Number(editBudgetInput.value.replace(/\D/g, '')) || 0;
    const added = Number(button.dataset.add);
    editBudgetInput.value = (current + added).toLocaleString('ko-KR');
  });
});

document.querySelectorAll('[data-edit-people]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.querySelector('#edit-people-count');
    const current = Math.max(1, Number(target.textContent.replace(/\D/g, '')) + Number(button.dataset.editPeople));
    target.textContent = `${current}명`;
    currentSurveyState.peopleCount = current;
  });
});

document.querySelector('#edit-close').addEventListener('click', () => showScreen('result-screen', 'home-screen'));
document.querySelector('#edit-cancel').addEventListener('click', () => showScreen('result-screen', 'home-screen'));
document.querySelector('#edit-finish-skip').addEventListener('click', () => showScreen('home-screen', 'home-screen'));

document.querySelector('#edit-submit').addEventListener('click', async () => {
  const newBudget = Number(document.querySelector('#edit-budget').value.replace(/\D/g, '')) || currentSurveyState.budget;
  const newPeople = Number(document.querySelector('#edit-people-count').textContent.replace(/\D/g, '')) || currentSurveyState.peopleCount;
  const newSpice = Number(document.querySelector('#edit-spice-range').value);

  const updatedPayload = {
    ...currentSurveyState,
    budget: newBudget,
    peopleCount: newPeople,
    spicyLevel: newSpice
  };

  notify('수정된 조건으로 AI 메뉴를 재구성합니다.');
  showScreen('analysis-screen', 'home-screen');

  const minDelay = new Promise((resolve) => setTimeout(resolve, 1500));
  const apiPromise = updateRecommendation(activeRecommendation?.id || 1, updatedPayload);

  const [_, result] = await Promise.all([minDelay, apiPromise]);
  activeRecommendation = result;
  renderResultScreen(result);
  showScreen('result-screen', 'home-screen');
});

// ==========================================
// 13. STEP 11: 히스토리 화면 (history-screen)
// ==========================================

const historyRoot = document.querySelector('#history-root');

function renderHistoryScreen() {
  historyRoot.innerHTML = '';

  const header = document.createElement('header');
  header.className = 'history-header';
  const title = document.createElement('strong');
  title.textContent = '히스토리';
  const searchBtn = document.createElement('button');
  searchBtn.type = 'button';
  searchBtn.className = 'history-search';
  searchBtn.setAttribute('aria-label', '검색');
  const actions = document.createElement('div');
  actions.className = 'history-actions';
  actions.append(searchBtn);
  header.append(title, actions);

  const tabs = document.createElement('div');
  tabs.className = 'history-tabs';
  ['전체', '방문 완료'].forEach((label, idx) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = label;
    tab.className = idx === 0 ? 'selected' : '';
    tabs.append(tab);
  });

  const listContainer = document.createElement('div');
  listContainer.className = 'history-list';

  getHistoryList().then((items) => {
    historyItemsData = items || MOCK_HISTORY_LIST;
    renderHistoryCards(listContainer, historyItemsData, 0);
  });

  tabs.querySelectorAll('button').forEach((tabBtn, idx) => {
    tabBtn.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
      tabBtn.classList.add('selected');
      renderHistoryCards(listContainer, historyItemsData, idx);
    });
  });

  historyRoot.append(header, tabs, listContainer);
}

function renderHistoryCards(container, items, filterIndex) {
  container.innerHTML = '';
  const filtered = filterIndex === 1 ? items.filter((i) => i.status === '방문 완료') : items;

  filtered.forEach((item) => {
    const card = document.createElement('article');
    card.className = `history-card ${item.status === '취소됨' ? 'cancelled' : ''}`;
    
    const statusB = document.createElement('b');
    statusB.className = 'history-status';
    statusB.textContent = item.status || '방문 완료';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'history-icon';
    const img = document.createElement('img');
    img.src = item.icon || 'assets/history-utensils.png';
    img.alt = '';
    iconSpan.append(img);

    const nameStrong = document.createElement('strong');
    nameStrong.className = 'history-name';
    nameStrong.textContent = item.title || item.name;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'history-meta';
    [ `${item.peopleCount || 2}명`, item.meetingType || '식사' ].forEach((lbl) => {
      const bdf = document.createElement('span');
      bdf.textContent = lbl;
      metaDiv.append(bdf);
    });

    const priceEm = document.createElement('em');
    priceEm.textContent = `${new Intl.NumberFormat('ko-KR').format(item.price || item.totalPrice || 0)}원`;

    card.append(statusB, iconSpan, nameStrong, metaDiv, priceEm);

    card.addEventListener('click', () => {
      activeRecommendation = generateMockRecommendation({
        peopleCount: item.peopleCount || 2,
        budget: item.price || 60000,
        meetingType: item.meetingType || '식사'
      });
      renderResultScreen(activeRecommendation);
      showScreen('result-screen', 'history-screen');
    });

    container.append(card);
  });
}

// ==========================================
// 14. 하단 네비게이션 및 초기 이벤트 바인딩
// ==========================================

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    showScreen(item.dataset.screen, item.dataset.screen);
  });
});

// 초기화: 저장된 입력 상태 복원
window.addEventListener('DOMContentLoaded', () => {
  const saved = getSurveyData();
  if (saved) {
    currentSurveyState = { ...currentSurveyState, ...saved };
  }
});
