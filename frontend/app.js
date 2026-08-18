const toast = document.querySelector('#toast');

const navIcons = ['assets/nav-home.png', 'assets/nav-history.png'];
document.querySelectorAll('.bottom-nav .nav-item span').forEach((slot, index) => {
  const icon = document.createElement('img');
  icon.src = navIcons[index];
  icon.alt = '';
  slot.replaceChildren(icon);
});

let currentRestaurantUrl = "";
let currentRecommendation = null;
let analysisTarget = null;
let editSnapshot = null;
let editReturnScreen = 'result-screen';
let historyReturnScreen = 'recommendation-screen';

function copyRecommendation(recommendation) {
  return recommendation ? JSON.parse(JSON.stringify(recommendation)) : null;
}

function openEditScreen(returnScreen = 'result-screen') {
  if (!window.currentRecommendation && !currentRecommendation) return;
  const targetData = window.currentRecommendation || currentRecommendation;

  editSnapshot = copyRecommendation(targetData);
  editReturnScreen = returnScreen;

  const editPeopleEl = document.querySelector('#edit-people-count');
  if (editPeopleEl) {
    const pCount = (typeof targetData.peopleCount === 'number' && !isNaN(targetData.peopleCount))
        ? targetData.peopleCount
        : (targetData.people ? Number(String(targetData.people).replace(/[^0-9]/g, '')) : null)
        || 2;
    editPeopleEl.textContent = `${pCount}명`;
  }

  const editBudgetInput = document.querySelector('#edit-budget') || document.querySelector('#edit-budget-input');
  if (editBudgetInput) {
    const bValue = targetData.budget || 60000;
    editBudgetInput.value = Number(bValue).toLocaleString('ko-KR');
  }

  if (typeof spiceRange !== 'undefined' && spiceRange) {
    const savedSpicy = targetData.spicyLevel ?? targetData.spice ?? 2;
    spiceRange.value = String(savedSpicy);
    spiceRange.dispatchEvent(new Event('input'));
  }

  if (typeof foodTags !== 'undefined' && foodTags) {
    foodTags.querySelectorAll('.food-tag').forEach((tag) => tag.remove());

    let excluded = targetData.excludedFoods;
    if (!excluded) {
      excluded = [];
    }
    (excluded || []).forEach(addFoodTag);
  }

  if (typeof updateBudgetGauge === 'function') {
    updateBudgetGauge();
  }

  showScreen('edit-screen', 'result-screen');
}

function restoreEditSnapshot() {
  if (currentRecommendation && editSnapshot) {
    Object.keys(currentRecommendation).forEach((key) => delete currentRecommendation[key]);
    Object.assign(currentRecommendation, copyRecommendation(editSnapshot));
    renderRecommendationResult();
    history.render();
    homeController.updateOngoing();
  }
  editSnapshot = null;
}

function discardEdit() {
  restoreEditSnapshot();
  showScreen(editReturnScreen, editReturnScreen === 'history-screen' ? 'history-screen' : 'home-screen');
}

function returnToRecommendationResult() {
  restoreEditSnapshot();
  showScreen('result-screen', 'home-screen');
}

const history = createHistory({
  root: document.querySelector('#history-root'),
  showScreen,
  onOpen: (item) => {
    currentRecommendation = copyRecommendation(item);
    openEditScreen('history-screen');
  },
});
history.render();

function showScreen(screen, activeTab = screen) {
  const previousScreen = document.querySelector('.screen.active')?.id;
  if (screen === 'history-screen' && previousScreen && previousScreen !== 'history-screen') {
    historyReturnScreen = previousScreen;
  }
  if (screen !== 'scan-screen') stopQrCamera();
  document.querySelectorAll('.screen').forEach((item) => item.classList.remove('active'));
  const target = document.querySelector(`#${screen}`);
  target.classList.add('active');
  target.scrollTop = 0;
  
  if (screen === 'analysis-screen') {
    const conditionSummary = document.querySelector("#condition-summary");
    const meetingTypeSummary = document.querySelector("#meeting-type-summary");
    try {
      const recommendationRequest = JSON.parse(sessionStorage.getItem("recommendationRequest") || "null");
      if (recommendationRequest && conditionSummary && meetingTypeSummary) {
        const { peopleCount, budget, meetingType } = recommendationRequest;
        conditionSummary.textContent = `인원 및 예산 조건 확인 (${peopleCount}명, ${Number(budget).toLocaleString("ko-KR")}원)`;
        meetingTypeSummary.textContent = `'${meetingType}' 컨셉 분석 중...`;
      }
    } catch (error) {
      console.warn("Invalid recommendationRequest session data", error);
    }
  }

  const navTabs = Array.from(document.querySelectorAll('.nav-item')).map(item => item.dataset.screen);
  if (!navTabs.includes(activeTab)) {
    activeTab = 'home-screen';
  }
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('selected', item.dataset.screen === activeTab));
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function completeAnalysis() {
  if (analysisTarget) {
    currentRecommendation = analysisTarget;
    analysisTarget = null;

    if (!currentRecommendation) {
      currentRecommendation = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        peopleCount: Number(sessionStorage.getItem('peopleCount')) || 2,
        budget: Number(sessionStorage.getItem('budget')) || 0,
        meetingType: sessionStorage.getItem('meetingType') || '식사',
        totalPrice: 0
      };
    }

    if (typeof renderAnalysisResult === 'function') {
      renderAnalysisResult(currentRecommendation);
    }
  }

  if (typeof getRecommendationTitle === 'function') {
    currentRecommendation.title = currentRecommendation.title || getRecommendationTitle();
  }
  if (typeof getRecommendationTotal === 'function') {
    currentRecommendation.total = `${(getRecommendationTotal() || currentRecommendation.totalPrice || 0).toLocaleString('ko-KR')}원`;
  }

  const editBudgetInput = document.querySelector('#edit-budget') || document.querySelector('#edit-budget-input');
  if (editBudgetInput && currentRecommendation.budget) {
    editBudgetInput.value = Number(currentRecommendation.budget).toLocaleString('ko-KR');
  }

  if (typeof renderRecommendationResult === 'function') {
    renderRecommendationResult();
  }
  if (typeof history !== 'undefined' && typeof history.render === 'function') {
    history.render();
  }
  if (typeof homeController !== 'undefined' && typeof homeController.updateOngoing === 'function') {
    homeController.updateOngoing();
  }

  showScreen('result-screen', 'home-screen');
}

function getInputValue(selector, isText = false) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const val = el.value !== undefined ? el.value : el.textContent;
  if (!val) return null;
  return isText ? val.trim() : Number(String(val).replace(/[^0-9]/g, ''));
}

function startAnalysis({ reanalyseCurrent = false } = {}) {
  const isEditMode = reanalyseCurrent || document.querySelector('#edit-screen')?.classList.contains('active');

  const editPeopleText = document.querySelector('#edit-people-count')?.textContent || '';
  const editPeopleNum = Number(editPeopleText.replace(/[^0-9]/g, ''));

  const currentPeople = isEditMode
      ? (editPeopleNum || getInputValue('#edit-people-count') || getInputValue('#edit-people'))
      : (window.peopleCount || Number(sessionStorage.getItem('peopleCount')) || getInputValue('#summary-count') || 2);

  const currentBudget = isEditMode
      ? (getInputValue('#edit-budget') || getInputValue('#edit-budget-input'))
      : (Number(sessionStorage.getItem('budget')) || getInputValue('#budget-input') || getInputValue('#budget') || 60000);

  const currentMeetingType = isEditMode
      ? (document.querySelector('#edit-meeting-type')?.value || document.querySelector('.edit-meeting-btn.active')?.dataset?.value || currentRecommendation?.meetingType)
      : (sessionStorage.getItem('meetingType') || document.querySelector('.meeting-btn.is-selected')?.dataset?.value || document.querySelector('#meeting-type')?.value || "식사");

  const requestData = {
    restaurantUrl: window.currentRestaurantUrl || sessionStorage.getItem("restaurantUrl") || "",
    peopleCount: currentPeople || (reanalyseCurrent ? currentRecommendation?.peopleCount : 2),
    budget: currentBudget || (reanalyseCurrent ? currentRecommendation?.budget : 60000),
    meetingType: currentMeetingType || (reanalyseCurrent ? currentRecommendation?.meetingType : "식사"),
    excludedFoods: typeof readFoodTags === 'function' ? readFoodTags() : [],
    bigEaterCount: getInputValue('#edit-big-eater') || 0,
    spicyLevel: getInputValue('#edit-spicy-level') || 2,
    dietCount: getInputValue('#edit-diet-count') || 0,
    todayPreference: getInputValue('#edit-today-preference', true) || ""
  };

  showScreen('analysis-screen', 'home-screen');

  fetch('http://localhost:8080/api/recommendation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  })
      .then(response => {
        if (!response.ok) throw new Error("추천 요청 실패");
        return response.json();
      })
      .then(data => {
        console.log("AI 추천 응답 성공:", data);
        window.applyAiRecommendationResult(data);
      })
      .catch(error => {
        console.error("추천 받기 오류:", error);
        notify("추천을 불러오는 중 오류가 발생했습니다.");
        if (typeof completeAnalysis === 'function') completeAnalysis();
      });
}

let html5QrCode = null;

function stopQrCamera() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      const qrReaderEl = document.getElementById('qr-reader');
      if (qrReaderEl) qrReaderEl.style.display = 'none';
      html5QrCode = null;
    }).catch(err => console.error("카메라 중지 에러:", err));
  }
  document.querySelector('.scanner')?.classList.remove('is-scanning');
}

async function startQrCamera() {
  stopQrCamera();

  const scanner = document.querySelector('.scanner');
  scanner?.classList.add('is-scanning');

  const qrReaderEl = document.getElementById('qr-reader');
  if (qrReaderEl) qrReaderEl.style.display = 'block';

  html5QrCode = new Html5Qrcode("qr-reader");

  try {
    await html5QrCode.start(
        { facingMode: "user" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          stopQrCamera();

          currentRestaurantUrl = decodedText;
          sessionStorage.setItem("restaurantUrl", decodedText);

          console.log("추출된 QR URL:", decodedText);

          try {
            notify('QR 코드를 인식했습니다. 백엔드로 전송');

            const response = await fetch("http://localhost:8080/api/menu/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurantUrl: decodedText })
            });

            if (response.ok) {
              const data = await response.json();
              console.log("백엔드 응답 데이터:", data);
              showScreen("member-screen");
            } else {
              notify('QR 처리 실패. 분석을 계속 진행합니다.');
              showScreen("member-screen");
            }
          } catch (error) {
            console.error("백엔드 통신 에러:", error);
            notify('서버 연결 실패. 모의 데이터로 연동을 진행합니다.');
            showScreen("member-screen");
          }
        }
    );
  } catch (err) {
    stopQrCamera();
    notify('카메라 권한을 허용해 주시거나 카메라를 시작할 수 없습니다.');
    console.error(err);
  }
}

const homeController = bindHomeScreen({
  showScreen,
  notify,
  getOngoingCount: () => history.items.length,
  openOngoing: () => {
    history.render();
    showScreen('history-screen', 'history-screen');
  },
});
document.querySelector('[data-action="menu"]').addEventListener('click', (event) => {
  notify('메뉴판 기능을 준비하고 있어요.');
});
document.querySelector('#back-button').addEventListener('click', () => showScreen('recommendation-screen', 'home-screen'));
document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
  if (item.dataset.screen === 'home-screen') {
    const isViewingHistory = document.querySelector('#history-screen').classList.contains('active');
    showScreen(isViewingHistory ? historyReturnScreen : 'recommendation-screen', 'home-screen');
    return;
  }
  showScreen('history-screen', 'history-screen');
}));
document.querySelector('#analysis-cancel').addEventListener('click',()=>showScreen('home-screen'));
document.querySelector('#analysis-close').addEventListener('click',()=>showScreen('home-screen'));
document.querySelector('#result-back').addEventListener('click',()=>showScreen('scan-screen','home-screen'));
document.querySelector('#result-home').addEventListener('click', () => {
  homeController.updateOngoing();
  showScreen('recommendation-screen', 'home-screen');
});
document.querySelector('.result-actions button').addEventListener('click', openEditScreen);
document.querySelector('#edit-close').addEventListener('click', discardEdit);
document.querySelector('#edit-cancel').addEventListener('click', discardEdit);
const editBudgetInput = document.querySelector('#edit-budget');
editBudgetInput.type = 'text';
editBudgetInput.inputMode = 'numeric';
editBudgetInput.value = '60,000';
editBudgetInput.addEventListener('input', () => {
  const digits = editBudgetInput.value.replace(/\D/g, '');
  editBudgetInput.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
});
document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
  const amount = Number(editBudgetInput.value.replace(/,/g, '')) || 0;
  editBudgetInput.value = (amount + Number(button.dataset.add)).toLocaleString('ko-KR');
}));
document.querySelector('#edit-screen .quick-edit button:last-child').addEventListener('click', () => {
  editBudgetInput.focus();
  editBudgetInput.select();
});

// --- Member Screen Logic ---
const memberCountButtons = [...document.querySelectorAll("#member-screen .count-button")];
const peopleCountInput = document.querySelector("#people-count");
const summaryCount = document.querySelector("#summary-count");
const memberNextButton = document.querySelector("#member-next");

let peopleCount = 2;

function updateSummary(count) {
  peopleCount = count;
  window.peopleCount = count;
  summaryCount.textContent = `${count}명`;
  peopleCountInput.setAttribute("aria-invalid", "false");
}

function clearMemberSelection() {
  peopleCount = null;
  summaryCount.textContent = "선택 필요";
}

function selectQuickCount(selectedButton) {
  memberCountButtons.forEach((button) => {
    const isSelected = button === selectedButton;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  peopleCountInput.value = "";
  updateSummary(Number(selectedButton.dataset.count));
}

function clearQuickSelection() {
  memberCountButtons.forEach((button) => {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
}

memberCountButtons.forEach((button) => {
  button.addEventListener("click", () => selectQuickCount(button));
});

peopleCountInput.addEventListener("input", () => {
  const value = Number(peopleCountInput.value);
  clearQuickSelection();
  const isValid = peopleCountInput.value !== "" && Number.isInteger(value) && value >= 5 && value <= 99;
  if (isValid) {
    updateSummary(value);
    return;
  }
  peopleCountInput.setAttribute("aria-invalid", String(peopleCountInput.value !== ""));
  clearMemberSelection();
});

peopleCountInput.addEventListener("blur", () => {
  if (!peopleCountInput.value) return;
  const value = Number(peopleCountInput.value);
  if (!Number.isInteger(value) || value < 5 || value > 99) {
    peopleCountInput.setAttribute("aria-invalid", "true");
    return;
  }
  updateSummary(value);
});

memberNextButton.addEventListener("click", () => {
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 99) {
    notify("인원수를 선택하거나 5명 이상 입력해 주세요.");
    peopleCountInput.focus();
    return;
  }
  sessionStorage.setItem("peopleCount", String(peopleCount));
  notify(`${peopleCount}명으로 설정했어요.`);
  showScreen("budget-screen");
  initBudgetScreen();
});

document.querySelector("#member-screen .back-button").addEventListener("click", () => {
  showScreen("scan-screen");
});

// --- Budget Screen Logic ---
const peopleCountBasis = document.querySelector("#people-count-basis");
const peopleCountSummary = document.querySelector("#people-count-summary");
const totalBudget = document.querySelector("#total-budget");
const budgetCalculation = document.querySelector("#budget-calculation");
const budgetRange = document.querySelector("#budget-range");
const rangeProgress = document.querySelector("#range-progress");
const budgetInput = document.querySelector("#budget-input");
const quickBudgetButtons = [...document.querySelectorAll(".quick-button")];
const budgetNextButton = document.querySelector("#budget-next");
const budgetSteps = [10000, 20000, 30000, 40000, 50000, 60000, 70000];
let perPersonBudget = 30000;
let totalBudgetAmount = perPersonBudget * peopleCount;

const formatWon = (value) => `${Math.round(value).toLocaleString("ko-KR")}원`;

function syncSlider(stepIndex) {
  const progress = (stepIndex / (budgetSteps.length - 1)) * 100;
  budgetRange.value = stepIndex;
  budgetRange.setAttribute("aria-valuetext", formatWon(budgetSteps[stepIndex]));
  rangeProgress.style.width = `${progress}%`;
}

function updateBudget(perPersonAmount, options = {}) {
  perPersonBudget = Math.max(1000, Math.round(perPersonAmount / 1000) * 1000);
  totalBudgetAmount = perPersonBudget * peopleCount;
  totalBudget.textContent = `총 ${formatWon(totalBudgetAmount)}`;
  budgetCalculation.textContent = `= 1인 예산 ${formatWon(perPersonBudget)} × ${peopleCount}명`;
  const stepIndex = budgetSteps.indexOf(perPersonBudget);
  if (options.syncSlider !== false && stepIndex !== -1) {
    syncSlider(stepIndex);
  }
  quickBudgetButtons.forEach((button) => {
    const selected = Number(button.dataset.budget) === perPersonBudget;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

budgetRange.addEventListener("input", () => {
  const stepIndex = Number(budgetRange.value);
  syncSlider(stepIndex);
  budgetInput.value = "";
  budgetInput.setAttribute("aria-invalid", "false");
  updateBudget(budgetSteps[stepIndex], { syncSlider: false });
});

budgetInput.addEventListener("input", () => {
  const digits = budgetInput.value.replace(/\D/g, "").slice(0, 9);
  budgetInput.value = digits ? Number(digits).toLocaleString("ko-KR") : "";
  const amount = Number(digits);
  const isValid = digits !== "" && amount >= 1000;
  budgetInput.setAttribute("aria-invalid", String(digits !== "" && !isValid));
  if (isValid) updateBudget(amount, { syncSlider: true });
});

quickBudgetButtons.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    budgetInput.value = "";
    budgetInput.setAttribute("aria-invalid", "false");
    updateBudget(Number(button.dataset.budget));
  });
});

function initBudgetScreen() {
  peopleCount = Number(sessionStorage.getItem("peopleCount")) || 2;
  // peopleCountBasis is hidden in HTML provided but safe to update
  if(peopleCountBasis) peopleCountBasis.textContent = `${peopleCount}명 기준`;
  if(peopleCountSummary) peopleCountSummary.textContent = `${peopleCount}명`;
  updateBudget(perPersonBudget);
}

document.querySelector("#budget-screen .back-button").addEventListener("click", () => {
  showScreen("member-screen");
});

budgetNextButton.addEventListener("click", () => {
  const directAmount = Number(budgetInput.value.replace(/\D/g, ""));
  if (budgetInput.value && directAmount < 1000) {
    budgetInput.setAttribute("aria-invalid", "true");
    notify("예산은 1,000원 이상 입력해 주세요.");
    budgetInput.focus();
    return;
  }
  if (!Number.isFinite(perPersonBudget) || perPersonBudget < 1000) {
    notify("1인당 예산을 선택해 주세요.");
    budgetRange.focus();
    return;
  }
  sessionStorage.setItem("budget", String(totalBudgetAmount));
  notify(`1인당 ${formatWon(perPersonBudget)}으로 설정했어요.`);
  showScreen("vibe-screen");
});

document.querySelectorAll('[data-edit-people]').forEach(b=>b.addEventListener('click',()=>{const e=document.querySelector('#edit-people-count');e.textContent=`${Math.max(1,Number(e.textContent.replace('명',''))+Number(b.dataset.editPeople))}명`}));
document.querySelector('#edit-submit').addEventListener('click',()=>{showScreen('analysis-screen','home-screen');setTimeout(()=>showScreen('result-screen','home-screen'),1800)});

// --- Vibe Screen Logic ---
const moodCards = [...document.querySelectorAll(".mood-card")];
const recentButtons = [...document.querySelectorAll(".recent-button")];
const moodInput = document.querySelector("#mood-input");
let meetingType = "";

function selectMeetingType(meetingTypeValue, source) {
  meetingType = meetingTypeValue;
  moodCards.forEach((card) => card.setAttribute("aria-invalid", "false"));
  moodCards.forEach((card) => {
    const selected = card === source;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
  recentButtons.forEach((button) => {
    const selected = button === source;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

// 화면의 기본 선택 상태와 다음 단계에 저장되는 값을 항상 일치시킨다.
if (moodCards[0]) {
  selectMeetingType(moodCards[0].dataset.meetingType, moodCards[0]);
}

moodCards.forEach((card) => {
  card.addEventListener("click", () => {
    moodInput.value = "";
    moodInput.setAttribute("aria-invalid", "false");
    selectMeetingType(card.dataset.meetingType, card);
  });
});

recentButtons.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    moodInput.value = "";
    moodInput.setAttribute("aria-invalid", "false");
    selectMeetingType(button.dataset.meetingType, button);
  });
});

moodInput.addEventListener("input", () => {
  const directValue = moodInput.value.trim();
  moodInput.setAttribute("aria-invalid", "false");
  selectMeetingType(directValue, null);
});

document.querySelector("#vibe-screen .back-button").addEventListener("click", () => {
  showScreen("budget-screen");
});

document.querySelector("#vibe-next").addEventListener("click", () => {
  const directValue = moodInput.value.trim();
  if (directValue) meetingType = directValue;

  if (!meetingType) {
    notify("분위기를 선택해 주세요.");
    moodCards.forEach((card) => card.setAttribute("aria-invalid", "true"));
    moodInput.setAttribute("aria-invalid", "true");
    moodCards[0].focus();
    return;
  }

  sessionStorage.setItem("meetingType", meetingType);
  notify(`${meetingType} 분위기를 선택했어요.`);
  showScreen("conditions-screen");
});

// --- Conditions Screen Logic ---
const foodCards = [...document.querySelectorAll(".food-card")];
const foodInput = document.querySelector("#food-input");

function clearFoodValidation() {
  foodCards.forEach((card) => card.setAttribute("aria-invalid", "false"));
  foodInput.setAttribute("aria-invalid", "false");
}

foodCards.forEach((card) => {
  card.addEventListener("click", () => {
    const selected = !card.classList.contains("is-selected");
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
    clearFoodValidation();
  });
});

foodInput.addEventListener("input", clearFoodValidation);

document.querySelector("#conditions-screen .back-button").addEventListener("click", () => {
  showScreen("vibe-screen");
});

document.querySelector("#conditions-next").addEventListener("click", () => {
  const selectedExcludedFoods = foodCards
      .filter((card) => card.classList.contains("is-selected"))
      .map((card) => card.dataset.excludedFood);
  const customExcludedFoods = foodInput.value
      .split(",")
      .map((food) => food.trim())
      .filter(Boolean);
  const excludedFoods = [...new Set([...selectedExcludedFoods, ...customExcludedFoods])];
  const conditionCount = excludedFoods.length;
  sessionStorage.setItem("excludedFoods", JSON.stringify(excludedFoods));
  notify(
      conditionCount > 0
          ? `${conditionCount}개의 추천 조건을 저장했어요.`
          : "제외 음식 없이 진행할게요."
  );
  showScreen("traits-screen");
  initTraitsScreen();
});

// --- Traits Screen Logic ---
const counterValues = { bigEaterCount: 0, dietCount: 0 };
let counterLimit = 20;
const counterRows = [...document.querySelectorAll(".counter-row")];
const spicyRange = document.querySelector("#spicy-range");
const spicyRangeProgress = document.querySelector("#spicy-range-progress");
const todayPreferenceInput = document.querySelector("#today-preference-input");

function getFeaturePeopleCount() {
  return counterValues.bigEaterCount + counterValues.dietCount;
}

function syncCounterControls() {
  const reachedLimit = getFeaturePeopleCount() >= counterLimit;
  counterRows.forEach((row) => {
    const key = row.dataset.counter;
    row.querySelector('[data-action="decrease"]').disabled = counterValues[key] === 0;
    row.querySelector('[data-action="increase"]').disabled = reachedLimit;
  });
}

counterRows.forEach((row) => {
  const key = row.dataset.counter;
  const output = row.querySelector(".counter-value");

  row.querySelectorAll(".counter-button").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = button.dataset.action === "increase" ? 1 : -1;
      counterValues[key] = Math.max(0, Math.min(counterLimit, counterValues[key] + delta));
      output.value = counterValues[key];
      output.textContent = counterValues[key];
      syncCounterControls();
    });
  });
});

function updateSpicySlider() {
  const value = Number(spicyRange.value);
  const min = Number(spicyRange.min);
  const max = Number(spicyRange.max);
  const progress = ((value - min) / (max - min)) * 100;
  spicyRangeProgress.style.width = `${progress}%`;
  spicyRange.setAttribute("aria-invalid", "false");
  spicyRange.setAttribute("aria-valuetext", `${value}단계`);
  document.querySelectorAll(".spicy-preference .range-numbers span").forEach((number) => {
    number.classList.toggle("is-current", Number(number.textContent) === value);
  });
}

spicyRange.addEventListener("input", updateSpicySlider);
updateSpicySlider();

function initTraitsScreen() {
  const storedPeopleCount = Number(sessionStorage.getItem("peopleCount"));
  counterLimit = Number.isInteger(storedPeopleCount) && storedPeopleCount > 0 ? storedPeopleCount : 20;
  syncCounterControls();
}

document.querySelector("#traits-screen .back-button").addEventListener("click", () => {
  showScreen("conditions-screen");
});

document.querySelector("#traits-screen .skip-button").addEventListener("click", () => {
  notify("특징 입력을 건너뜁니다.");
  document.querySelector("#traits-next").click();
});

document.querySelector("#traits-next").addEventListener("click", () => {
  const storedPeopleCount = Number(sessionStorage.getItem("peopleCount"));
  const currentPeopleCount = Number.isInteger(storedPeopleCount) && storedPeopleCount > 0 ? storedPeopleCount : 0;

  if (currentPeopleCount > 0 && getFeaturePeopleCount() > currentPeopleCount) {
    notify(`대식가와 다이어트 인원의 합은 총 ${currentPeopleCount}명을 넘을 수 없어요.`);
    return;
  }

  const spicyLevel = Number(spicyRange.value);
  const minSpicyLevel = Number(spicyRange.min);
  const maxSpicyLevel = Number(spicyRange.max);
  if (!Number.isInteger(spicyLevel) || spicyLevel < minSpicyLevel || spicyLevel > maxSpicyLevel) {
    spicyRange.setAttribute("aria-invalid", "true");
    notify("매운 음식 선호도를 선택해 주세요.");
    spicyRange.focus();
    return;
  }

  let excludedFoods = [];
  try {
    const storedExcludedFoods = JSON.parse(sessionStorage.getItem("excludedFoods") || "[]");
    if (Array.isArray(storedExcludedFoods)) excludedFoods = storedExcludedFoods;
  } catch (error) {
    console.warn("Invalid excludedFoods session data", error);
  }

  const storedMenuId = Number(sessionStorage.getItem("menuId"));
  const recommendationRequest = {
    restaurantUrl: sessionStorage.getItem("restaurantUrl") || currentRestaurantUrl || "",
    clientId: sessionStorage.getItem("clientId") || "",
    menuId: Number.isInteger(storedMenuId) && storedMenuId > 0 ? storedMenuId : null,
    peopleCount: currentPeopleCount,
    budget: Number(sessionStorage.getItem("budget")) || 0,
    meetingType: sessionStorage.getItem("meetingType") || "",
    excludedFoods,
    bigEaterCount: counterValues.bigEaterCount,
    spicyLevel,
    dietCount: counterValues.dietCount,
    todayPreference: todayPreferenceInput.value.trim(),
  };
  sessionStorage.setItem("recommendationRequest", JSON.stringify(recommendationRequest));
  console.log("POST /api/recommendation request", recommendationRequest);
  notify("입력 정보를 바탕으로 메뉴를 분석합니다.");

  showScreen("analysis-screen", "home-screen");
  fetch("http://localhost:8080/api/recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recommendationRequest),
  })
      .then((response) => {
        if (!response.ok) throw new Error("추천 응답 실패");
        return response.json();
      })
      .then((data) => {
        console.log("✅ 백엔드 응답 성공:", data);
        window.applyAiRecommendationResult({
          ...data,
          peopleCount: recommendationRequest.peopleCount,
          budget: recommendationRequest.budget,
          meetingType: recommendationRequest.meetingType,
          excludedFoods: recommendationRequest.excludedFoods,
          bigEaterCount: recommendationRequest.bigEaterCount,
          spicyLevel: recommendationRequest.spicyLevel,
          dietCount: recommendationRequest.dietCount,
          todayPreference: recommendationRequest.todayPreference
        });
      })
      .catch((error) => {
        console.error("❌ 통신 오류:", error);
        notify("서버 응답 오류로 기본 결과를 표시합니다.");
        completeAnalysis();
      });
});

const resultEditButton = document.createElement('button');
resultEditButton.id = 'result-edit';
resultEditButton.type = 'button';
resultEditButton.textContent = '수정';
document.querySelector('#result-screen .result-chips').append(resultEditButton);
resultEditButton.addEventListener('click', () => {
  openEditScreen();
});

function getRecommendationTotal() {
  if (currentRecommendation && currentRecommendation.totalPrice) {
    return Number(currentRecommendation.totalPrice);
  }
  const items = currentRecommendation?.menuItems;
  if (!items?.length) return 0;
  return items.reduce((sum, item) => sum + (Number(String(item.price).replace(/[^\d]/g, '')) || 0), 0);
}

function getRecommendationTitle() {
  const items = currentRecommendation?.menuItems || [];
  const firstName = items[0]?.name || '추천 메뉴';
  const restCount = Math.max(0, (currentRecommendation?.menuCount ?? items.length) - 1);
  return restCount ? `${firstName} 외 ${restCount}건` : firstName;
}

function renderMenuResults() {
  const items = currentRecommendation?.menuItems;
  if (!items?.length) return;
  const list = document.querySelector('#result-screen .menu-list');
  const heading = document.querySelector('#result-screen .menu-heading span');
  heading.textContent = `총 ${currentRecommendation.menuCount ?? items.length}개 메뉴`;
  list.replaceChildren();
  items.forEach((item) => {
    const article = document.createElement('article');
    const visual = document.createElement('b');
    const icon = Object.assign(document.createElement('img'), { src: item.icon || 'assets/utensils.png', alt: '' });
    visual.append(icon);
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = item.name;
    const description = document.createElement('small');
    description.textContent = item.description || '';
    copy.append(name, description);
    if (item.tags?.length) {
      const tags = document.createElement('div');
      tags.className = 'menu-tags';
      item.tags.forEach((tag) => {
        const badge = document.createElement('b');
        badge.textContent = tag;
        tags.append(badge);
      });
      copy.append(tags);
    }
    const price = document.createElement('em');
    const won = Number(String(item.price).replace(/[^\d]/g, '')) || 0;
    price.textContent = `${won.toLocaleString('ko-KR')}원`;
    article.append(visual, copy, price);
    list.append(article);
  });
}

const currentOrderButton = document.querySelector('#edit-screen .current-order button');
document.querySelector('#edit-screen .scan-header .skip')?.remove();
const currentOrderIcon = document.createElement('img');
currentOrderIcon.src = 'assets/utensils.png';
currentOrderIcon.alt = '';
const currentOrderLabel = document.createElement('span');
currentOrderLabel.textContent = '채끝 등심 스테이크 외 2건';
const currentOrderChevron = document.createElement('i');
currentOrderChevron.textContent = '›';
currentOrderButton.replaceChildren(currentOrderIcon, currentOrderLabel, currentOrderChevron);
currentOrderButton.addEventListener('click', returnToRecommendationResult);

function renderCurrentOrder() {
  const items = currentRecommendation?.menuItems;
  if (!items?.length) return;
  currentOrderLabel.textContent = currentRecommendation.title || getRecommendationTitle();
  document.querySelector('#edit-screen .current-order > strong').textContent = `총 ${getRecommendationTotal().toLocaleString('ko-KR')}원`;
}

document.querySelectorAll('#edit-screen .edit-content h2')[3].textContent = '\uB9E4\uC6B4 \uC74C\uC2DD \uC120\uD638\uB3C4';

const spiceRange = document.querySelector('#edit-screen .edit-range');
const spiceScale = document.createElement('div');
spiceScale.className = 'spice-scale';
['1', '2', '3', '4', '5'].forEach((value) => {
  const tick = document.createElement('b');
  tick.textContent = value;
  if (value === spiceRange.value) tick.className = 'selected';
  spiceScale.append(tick);
});
spiceRange.after(spiceScale);
spiceRange.addEventListener('input', () => {
  spiceScale.querySelectorAll('b').forEach((tick) => tick.classList.toggle('selected', tick.textContent === spiceRange.value));
  const percentage = (Number(spiceRange.value) - 1) * 25;
  spiceRange.style.background = `linear-gradient(to right, var(--coral) 0 ${percentage}%, #dedede ${percentage}% 100%)`;
});

document.querySelectorAll('#edit-screen .edit-tags button:not(:last-child)').forEach((tag) => {
  const cleanTag = tag.cloneNode(false);
  const label = document.createElement('span');
  label.textContent = tag.textContent.replace(/[×x]/gi, '').trim();
  const remove = document.createElement('span');
  remove.className = 'tag-remove';
  remove.setAttribute('role', 'button');
  remove.setAttribute('aria-label', '삭제');
  remove.textContent = '×';
  cleanTag.append(label, remove);
  tag.replaceWith(cleanTag);
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    cleanTag.remove();
  });
});

const reportTitle = document.querySelector('#result-screen .report strong');
reportTitle.textContent = reportTitle.textContent.replace(/^[^\p{L}]*/u, '');
const reportWand = document.createElement('img');
reportWand.src = 'assets/report-wand.png';
reportWand.alt = '';
reportTitle.prepend(reportWand);

function renderAiReport() {
  const report = currentRecommendation?.report;
  if (!report) return;
  reportTitle.replaceChildren(reportWand, document.createTextNode(report.title || 'AI 분석 리포트'));
  const text = document.querySelector('#result-screen .report p');
  if (report.content) {
    text.textContent = report.content;
    return;
  }
  text.replaceChildren(
      document.createTextNode(report.before || ''),
      Object.assign(document.createElement('b'), { textContent: report.emphasis || '' }),
      document.createTextNode(report.after || ''),
  );
}

const totalCard = document.querySelector('#result-screen .total-card');
function updateBudgetGauge(budgetValue) {
  const budget = Number(budgetValue ?? editBudgetInput.value.replace(/,/g, '')) || 0;
  const recommendationTotal = getRecommendationTotal();
  const remaining = Math.max(0, budget - recommendationTotal);
  const usedRatio = budget ? Math.min(100, (recommendationTotal / budget) * 100) : 100;
  totalCard.querySelector('strong').textContent = `${recommendationTotal.toLocaleString('ko-KR')}\uC6D0`;
  totalCard.querySelector('span b').textContent = `${remaining.toLocaleString('ko-KR')}\uC6D0 \uB0A8\uC74C`;
  totalCard.style.setProperty('--used-ratio', `${usedRatio}%`);
}
editBudgetInput.addEventListener('input', updateBudgetGauge);
document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', updateBudgetGauge));
updateBudgetGauge();

const resultChipAssets = ['assets/people-group.png', 'assets/wallet.png'];

function renderRecommendationResult() {
  if (!currentRecommendation) return;

  const rec = currentRecommendation;

  const peopleChip = document.querySelector('#result-people-chip')
      || document.querySelector('#result-screen .result-chips span:nth-child(1)')
      || document.querySelectorAll('#result-screen .chip')[0];

  if (peopleChip) {
    let img = peopleChip.querySelector('img');

    if (!img) {
      img = document.createElement('img');
      peopleChip.prepend(img);
    }

    img.src = resultChipAssets[0];
    img.alt = '';

    const rawPeople =
        (typeof rec.peopleCount === 'number' && !isNaN(rec.peopleCount))
            ? rec.peopleCount
            : (rec.people
                ? Number(String(rec.people).replace(/[^0-9]/g, ''))
                : 2);

    const peopleText = `${rawPeople}명`;

    peopleChip.replaceChildren(img, document.createTextNode(peopleText));
  }

  const budgetChip =
      document.querySelector('#result-budget-chip') ||
      document.querySelectorAll('#result-screen .result-chips span')[1];

  if (budgetChip) {
    let img = budgetChip.querySelector('img');

    if (!img) {
      img = document.createElement('img');
      budgetChip.prepend(img);
    }

    img.src = resultChipAssets[1];
    img.alt = '';

    const budgetVal = Number(rec.budget) || 60000;
    const budgetText = `${budgetVal.toLocaleString('ko-KR')}원`;

    budgetChip.replaceChildren(
        img,
        document.createTextNode(budgetText)
    );
  }

  const moodChip = document.querySelector('#result-mood-chip') || document.querySelectorAll('#result-screen .result-chips span')[2];
  if (moodChip) {
    const moodText = sessionStorage.getItem('meetingType') || rec.meetingType || rec.mood || '식사';
    const img = moodChip.querySelector('img');
    if (img) {
      moodChip.replaceChildren(img, document.createTextNode(moodText));
    } else {
      moodChip.textContent = moodText;
    }
  }

  if (typeof updateBudgetGauge === 'function') updateBudgetGauge(rec.budget);
  if (typeof renderAiReport === 'function') renderAiReport();
  if (typeof renderMenuResults === 'function') renderMenuResults();
  if (typeof renderCurrentOrder === 'function') renderCurrentOrder();
}

// AI 연결 시 이 함수를 호출하면 결과 화면 전체가 응답 데이터로 교체됩니다.
window.applyAiRecommendationResult = function (aiResult) {
  const previous = currentRecommendation || {};

  analysisTarget = {
    ...previous,
    ...aiResult,
    id: aiResult.id ?? previous.id ?? String(Date.now()),
    peopleCount: aiResult.peopleCount ?? previous.peopleCount,
    budget: aiResult.budget ?? previous.budget,
    meetingType: aiResult.meetingType ?? previous.meetingType,
    report: {
      title: 'AI 추천 분석',
      content: aiResult.reason || aiResult.report?.content || ""
    },
    menuItems: Array.isArray(aiResult.recommendedMenus)
        ? aiResult.recommendedMenus.map(m => typeof m === 'string' ? { name: m } : m)
        : (aiResult.menuItems || previous.menuItems || [])
  };

  completeAnalysis();
};

function replaceControl(selector, handler) {
  const original = document.querySelector(selector);
  if (!original) return null;
  const control = original.cloneNode(true);
  original.replaceWith(control);
  control.addEventListener('click', handler);
  return control;
}

replaceControl('#permission', startQrCamera);
replaceControl('.scan-button', startQrCamera);
const codeModal = document.querySelector('#code-modal');
const manualCodeInput = document.querySelector('#manual-code');
function closeCodeModal() {
  codeModal.hidden = true;
  manualCodeInput.value = '';
}
replaceControl('.code-row', () => {
  codeModal.hidden = false;
  window.setTimeout(() => manualCodeInput.focus(), 0);
});
codeModal.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!manualCodeInput.value.trim()) {
    manualCodeInput.focus();
    return;
  }
  closeCodeModal();
  showScreen('member-screen');
});
codeModal.addEventListener('click', (event) => {
  if (event.target === codeModal) closeCodeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !codeModal.hidden) closeCodeModal();
});
document.querySelectorAll('#result-screen .result-actions button');

replaceControl('#result-screen .result-actions button:first-child', startAnalysis);

const foodTags = document.querySelector('#edit-screen .edit-tags');
const addFoodButton = foodTags.querySelector('button:last-child');
foodTags.querySelectorAll('button:not(:last-child)').forEach((tag) => tag.remove());
function addFoodTag(name) {
  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'food-tag';
  const label = document.createElement('span'); label.textContent = name;
  const remove = document.createElement('span'); remove.className = 'tag-remove'; remove.textContent = '\u00d7'; remove.setAttribute('role', 'button'); remove.setAttribute('aria-label', '\uC0AD\uC81C');
  remove.addEventListener('click', (event) => { event.stopPropagation(); tag.remove(); });
  tag.append(label, remove);
  const addControl = foodTags.querySelector('.food-tag-input, button:last-child');
  foodTags.insertBefore(tag, addControl);
}

const addFoodControl = addFoodButton.cloneNode(true);
addFoodButton.replaceWith(addFoodControl);
addFoodControl.addEventListener('click', () => {
  const input = document.createElement('input');
  input.className = 'food-tag-input';
  input.placeholder = '\uC74C\uC2DD \uC774\uB984';
  addFoodControl.replaceWith(input);
  input.focus();
  const submit = () => {
    const value = input.value.trim();
    if (value) addFoodTag(value);
    input.replaceWith(addFoodControl);
  };
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); if (event.key === 'Escape') input.replaceWith(addFoodControl); });
  input.addEventListener('blur', submit, { once: true });
});

const repairedAddFoodButton = document.querySelector('#edit-screen .edit-tags button:last-child');
const freshAddFoodButton = repairedAddFoodButton.cloneNode(true);
repairedAddFoodButton.replaceWith(freshAddFoodButton);
freshAddFoodButton.addEventListener('click', () => {
  const input = document.createElement('input');
  input.className = 'food-tag-input';
  input.placeholder = '\uC74C\uC2DD \uC774\uB984';
  freshAddFoodButton.replaceWith(input);
  input.focus();
  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const value = input.value.trim();
    if (value) addFoodTag(value);
    input.replaceWith(freshAddFoodButton);
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); commit(); }
    if (event.key === 'Escape') { event.preventDefault(); input.replaceWith(freshAddFoodButton); }
  });
  input.addEventListener('change', commit, { once: true });
});

function readFoodTags() {
  return [...foodTags.querySelectorAll('.food-tag > span:first-child')]
      .map((tag) => tag.textContent.trim())
      .filter(Boolean);
}

function syncRecommendationFromEdit() {
  if (!currentRecommendation) return;

  const peopleText =
      document.querySelector('#edit-people-count')?.textContent || '';

  const peopleCount =
      Number(peopleText.replace(/[^0-9]/g, '')) || currentRecommendation.peopleCount || 2;

  currentRecommendation.peopleCount = peopleCount;
  currentRecommendation.people = `${peopleCount}명`;

  currentRecommendation.budget =
      Number(editBudgetInput.value.replace(/,/g, '')) || 0;

  currentRecommendation.excludedFoods = readFoodTags();
  currentRecommendation.spice = Number(spiceRange.value);

  renderRecommendationResult();
}

// 수정 화면의 수치를 바꾸는 즉시 결과 상단 요약과 히스토리 데이터도 같은 값으로 맞춥니다.
editBudgetInput.addEventListener('input', syncRecommendationFromEdit);
document.querySelectorAll('[data-add], [data-edit-people]').forEach((control) => {
  control.addEventListener('click', () => window.setTimeout(syncRecommendationFromEdit, 0));
});

const cameraOptionIcon = document.querySelector('#scan-screen .option-row .option-icon');
cameraOptionIcon.replaceChildren(Object.assign(document.createElement('img'), { src: 'assets/camera-gray.png', alt: '' }));
const scanButton = document.querySelector('#scan-screen .scan-button');
const scanButtonText = scanButton.textContent;
const scanButtonIcon = document.createElement('img');
scanButtonIcon.src = 'assets/camera-white.png';
scanButtonIcon.alt = '';
scanButton.replaceChildren(document.createTextNode(scanButtonText), scanButtonIcon);

window.setupEditScreen = function () {
  const data = window.currentRecommendation || {};

  const editBudgetInput = document.querySelector('#edit-budget') || document.querySelector('#edit-budget-input');
  if (editBudgetInput) {
    const budgetVal = data.budget ?? data.totalPrice ?? 0;
    editBudgetInput.value = Number(budgetVal).toLocaleString('ko-KR');
  }

  const peopleVal = data.peopleCount ?? (data.people ? Number(String(data.people).replace(/[^0-9]/g, '')) : null) ?? window.peopleCount ?? 0;

  window.editPeopleCount = peopleVal;

  const peopleDisplay = document.querySelector('#edit-people-display') || document.querySelector('.edit-people-count-text');
  if (peopleDisplay) {
    peopleDisplay.textContent = `${peopleVal}명`;
  }

  const excludedFoods = Array.isArray(data.excludedFoods) ? data.excludedFoods : [];
  const foodContainer = document.querySelector('#edit-excluded-foods-container') || document.querySelector('.edit-food-tags');

  if (foodContainer) {
    foodContainer.innerHTML = '';

    excludedFoods.forEach(food => {
      const tag = document.createElement('span');
      tag.className = 'chip tag-chip';
      tag.innerHTML = `${food} <button type="button" class="tag-remove" onclick="removeFoodTag('${food}')">×</button>`;
      foodContainer.appendChild(tag);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'chip-add-btn';
    addBtn.textContent = '+ 추가하기';
    addBtn.onclick = window.openAddFoodModal || function(){};
    foodContainer.appendChild(addBtn);
  }

  const spicyInput = document.querySelector('#edit-spicy-level');
  if (spicyInput && data.spicyLevel !== undefined) {
    spicyInput.value = data.spicyLevel;
  }
};

function reanalyzeFromHistory() {
  if (!currentRecommendation) return;

  const editPeopleText = document.querySelector('#edit-people-count')?.textContent || '';
  const updatedPeople = Number(editPeopleText.replace(/[^0-9]/g, '')) || currentRecommendation.peopleCount || 2;

  const editBudgetVal = getInputValue('#edit-budget') || getInputValue('#edit-budget-input');
  const updatedBudget = editBudgetVal || currentRecommendation.budget || 60000;

  const updatedExcludedFoods = typeof readFoodTags === 'function' ? readFoodTags() : (currentRecommendation.excludedFoods || []);
  const updatedSpicy = typeof spiceRange !== 'undefined' ? Number(spiceRange.value) : (currentRecommendation.spicyLevel || 2);

  const requestData = {
    restaurantUrl: currentRecommendation.restaurantUrl || sessionStorage.getItem("restaurantUrl") || "",
    peopleCount: updatedPeople,
    budget: updatedBudget,
    meetingType: currentRecommendation.meetingType || currentRecommendation.mood || "식사",
    excludedFoods: updatedExcludedFoods,
    spicyLevel: updatedSpicy,
    bigEaterCount: currentRecommendation.bigEaterCount || 0,
    dietCount: currentRecommendation.dietCount || 0,
    todayPreference: currentRecommendation.todayPreference || ""
  };

  showScreen('analysis-screen', 'home-screen');

  fetch('http://localhost:8080/api/recommendation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  })
      .then(response => {
        if (!response.ok) throw new Error("추천 요청 실패");
        return response.json();
      })
      .then(data => {
        console.log("히스토리 기반 AI 재추천 응답 성공:", data);

        if (currentRecommendation) {
          currentRecommendation.peopleCount = requestData.peopleCount;
          currentRecommendation.people = `${requestData.peopleCount}명`;
        }

        window.applyAiRecommendationResult({
          ...data,
          peopleCount: requestData.peopleCount,
          budget: requestData.budget,
          meetingType: requestData.meetingType,
          excludedFoods: requestData.excludedFoods,
          spicyLevel: requestData.spicyLevel
        });
      })
      .catch(error => {
        console.error("추천 받기 오류:", error);
        notify("추천을 불러오는 중 오류가 발생했습니다.");
        if (typeof completeAnalysis === 'function') completeAnalysis();
      });
}

replaceControl('#edit-submit', reanalyzeFromHistory);

replaceControl('#result-screen .result-actions button:last-child', async () => {
  if (!currentRecommendation) return;
  try {
    const rawPeople =
        Number(currentRecommendation.peopleCount) ||
        (currentRecommendation.people
            ? Number(String(currentRecommendation.people).replace(/[^0-9]/g, ''))
            : 2);

    currentRecommendation.peopleCount = rawPeople;
    currentRecommendation.people = `${rawPeople}명`;

    const payload = {
      id: null,
      restaurantUrl: currentRecommendation.restaurantUrl || "",
      meetingType: currentRecommendation.meetingType || currentRecommendation.mood || "",
      peopleCount: rawPeople,
      budget: Number(currentRecommendation.budget) || null,
      recommendedMenus: currentRecommendation.recommendedMenus || currentRecommendation.menuItems?.map(item => item.name) || [],
      totalPrice: currentRecommendation.totalPrice || getRecommendationTotal(),
      reason: currentRecommendation.reason || currentRecommendation.report?.content || ""
    };

    const response = await fetch('http://localhost:8080/api/recommendation/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`DB 저장 실패 (상태 코드: ${response.status})`);
    }

    const savedData = await response.json();
    console.log("DB 저장 성공:", savedData);

    currentRecommendation.id = savedData.id || savedData.recommendationId || crypto.randomUUID?.() || String(Date.now());

    const recommendationSnapshot = JSON.parse(JSON.stringify(currentRecommendation));
    history.save(recommendationSnapshot);

    currentRecommendation = null;
    homeController.updateOngoing();
    showScreen('history-screen', 'history-screen');
    historyReturnScreen = 'recommendation-screen';

  } catch (error) {
    console.error("DB 저장 중 오류 발생:", error);
    alert("저장 중 오류가 발생했습니다. 백엔드 서버 연결 상태를 확인해 주세요.");
  }
});
