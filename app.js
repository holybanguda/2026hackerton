const toast = document.querySelector('#toast');

const navIcons = ['assets/nav-home.png', 'assets/nav-history.png'];
document.querySelectorAll('.bottom-nav .nav-item span').forEach((slot, index) => {
  const icon = document.createElement('img');
  icon.src = navIcons[index];
  icon.alt = '';
  slot.replaceChildren(icon);
});

let currentRecommendation = null;
let analysisTarget = null;
let editSnapshot = null;
let editReturnScreen = 'result-screen';
let historyReturnScreen = 'recommendation-screen';

function copyRecommendation(recommendation) {
  return recommendation ? JSON.parse(JSON.stringify(recommendation)) : null;
}

function openEditScreen(returnScreen = 'result-screen') {
  if (!currentRecommendation) return;
  editReturnScreen = returnScreen;
  editSnapshot = copyRecommendation(currentRecommendation);
  populateEditForm();
  showScreen('edit-screen', returnScreen === 'history-screen' ? 'history-screen' : 'home-screen');
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
    currentRecommendation = item;
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
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('selected', item.dataset.screen === activeTab));
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function completeAnalysis() {
  currentRecommendation = analysisTarget ?? {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    title: '',
    people: '3명',
    mood: '데이트',
    total: '58,000원',
    budget: 60000,
    excludedFoods: ['오이', '견과류'],
    spice: 3,
    status: '방문 완료',
    historyIcon: 'assets/history-utensils.png',
    menuCount: 4,
    menuItems: [
      { name: '채끝 등심 스테이크', description: '미디엄 웰던 추천, 가니쉬 포함', price: 28000, icon: 'assets/utensils.png', tags: ['인기', '추천'] },
      { name: '트러플 크림 파스타', description: '진한 트러플 향의 크림 소스', price: 16000, icon: 'assets/utensils.png' },
      { name: '하우스 레드 와인 (2잔)', description: '스테이크와 어울리는 바디감', price: 14000, icon: 'assets/wine-glass.png' },
    ],
    report: {
      title: 'AI 분석 리포트',
      before: '"데이트 분위기에 맞춰 대화하기 좋은 깔끔한 메뉴 위주로 구성했습니다. ',
      emphasis: '예산 내에서 스테이크와 와인',
      after: '을 모두 즐기실 수 있는 최적의 조합입니다."',
    },
  };
  analysisTarget = null;
  currentRecommendation.title = currentRecommendation.title || getRecommendationTitle();
  currentRecommendation.total = `${getRecommendationTotal().toLocaleString('ko-KR')}원`;
  editBudgetInput.value = Number(currentRecommendation.budget || 60000).toLocaleString('ko-KR');
  renderRecommendationResult();
  history.render();
  homeController.updateOngoing();
  showScreen('result-screen', 'home-screen');
}

function startAnalysis({ reanalyseCurrent = false } = {}) {
  analysisTarget = reanalyseCurrent ? currentRecommendation : null;
  showScreen('analysis-screen', 'home-screen');
  window.setTimeout(completeAnalysis, 1800);
}

let html5QrCode = null;

function stopQrCamera() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      html5QrCode = null;
    }).catch(err => console.error("Failed to stop QR camera", err));
  }
  document.querySelector('.scanner')?.classList.remove('is-scanning');
  document.getElementById("qr-reader").style.display = 'none';
  const selectContainer = document.querySelector('.camera-select-container');
  if (selectContainer) selectContainer.style.display = 'none';
}

async function startQrCamera() {
  stopQrCamera();
  const scanner = document.querySelector('.scanner');
  scanner.classList.add('is-scanning');
  
  const qrReaderDiv = document.getElementById('qr-reader');
  qrReaderDiv.style.display = 'block';

  html5QrCode = new Html5Qrcode("qr-reader");

  try {
    const devices = await Html5Qrcode.getCameras();
    if (!devices || devices.length === 0) {
      throw new Error("No cameras found.");
    }

    const cameraSelect = document.getElementById('camera-select');
    cameraSelect.innerHTML = '';
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.text = device.label || `Camera ${cameraSelect.length + 1}`;
      cameraSelect.appendChild(option);
    });

    document.querySelector('.camera-select-container').style.display = 'block';

    const startCameraWithId = async (camId) => {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }
      await html5QrCode.start(
        camId,
        { fps: 10 },
        async (decodedText, decodedResult) => {
          console.log("✅ 추출된 QR URL:", decodedText);
          
          stopQrCamera();
          notify('QR 코드를 인식했습니다. 정보를 불러옵니다...');

          try {
            const response = await fetch("http://localhost:8080/api/menu/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: decodedText })
            });

            if (response.ok) {
              showScreen('member-screen');
            } else {
              notify('QR 코드 처리 중 오류가 발생했습니다.');
              showScreen('member-screen');
            }
          } catch (error) {
            console.error("Error connecting to backend:", error);
            notify('서버에 연결할 수 없습니다. 계속 진행합니다.');
            showScreen('member-screen');
          }
        },
        (errorMessage) => {
          // parse error, ignore
        }
      );
    };

    cameraSelect.onchange = (e) => {
      startCameraWithId(e.target.value).catch(err => {
        console.error("Failed to switch camera:", err);
        notify('카메라 전환 오류: ' + (err.message || err));
      });
    };

    const initialCameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id;
    cameraSelect.value = initialCameraId;
    await startCameraWithId(initialCameraId);
  } catch (err) {
    stopQrCamera();
    notify('카메라 오류: ' + (err.message || err));
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
  window.setTimeout(completeAnalysis, 1800);
});

const resultChipAssets = ['assets/people-group.png', 'assets/wallet.png'];
const resultChipLabels = ['3명', '60,000원'];
document.querySelectorAll('#result-screen .result-chips span').forEach((chip, index) => {
  if (index > 1) return;
  const icon = document.createElement('img');
  icon.src = resultChipAssets[index];
  icon.alt = '';
  chip.replaceChildren(icon, document.createTextNode(resultChipLabels[index]));
});

const dateChip = document.querySelector('#result-screen .result-chips span:nth-child(3)');
const dateIcon = document.createElement('img');
dateIcon.src = 'assets/heart.png';
dateIcon.alt = '';
dateChip.replaceChildren(dateIcon, document.createTextNode('데이트'));
const resultEditButton = document.createElement('button');
resultEditButton.id = 'result-edit';
resultEditButton.type = 'button';
resultEditButton.textContent = '수정';
document.querySelector('#result-screen .result-chips').append(resultEditButton);
resultEditButton.addEventListener('click', () => {
  openEditScreen();
});

function getRecommendationTotal() {
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

// 추후 AI가 menuItems 배열(name, description, price, icon, tags)을 내려주면 자동으로 목록을 구성합니다.
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

// 추후 AI 응답은 recommendation.report의 title / before / emphasis / after 값만 채우면 됩니다.
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

function refreshResultSummary() {
  if (!currentRecommendation) return;
  const chips = document.querySelectorAll('#result-screen .result-chips span');
  const budget = Number(currentRecommendation.budget || 60000);
  const peopleIcon = Object.assign(document.createElement('img'), { src: resultChipAssets[0], alt: '' });
  const budgetIcon = Object.assign(document.createElement('img'), { src: resultChipAssets[1], alt: '' });
  const moodIcon = Object.assign(document.createElement('img'), { src: 'assets/heart.png', alt: '' });
  chips[0].replaceChildren(peopleIcon, document.createTextNode(currentRecommendation.people));
  chips[1].replaceChildren(budgetIcon, document.createTextNode(`${budget.toLocaleString('ko-KR')}원`));
  chips[2].replaceChildren(moodIcon, document.createTextNode(currentRecommendation.mood || '분위기 미정'));
  updateBudgetGauge(budget);
}

function renderRecommendationResult() {
  if (!currentRecommendation) return;
  refreshResultSummary();
  renderAiReport();
  renderMenuResults();
  renderCurrentOrder();
}

// AI 연결 시 이 함수를 호출하면 결과 화면 전체가 응답 데이터로 교체됩니다.
window.applyAiRecommendationResult = function applyAiRecommendationResult(aiResult) {
  const previous = currentRecommendation || {};
  const people = aiResult.people ?? previous.people ?? '3명';
  analysisTarget = {
    ...previous,
    ...aiResult,
    id: aiResult.id ?? previous.id ?? (crypto.randomUUID?.() ?? String(Date.now())),
    title: aiResult.title ?? (Array.isArray(aiResult.menuItems) ? '' : previous.title ?? ''),
    people: typeof people === 'number' ? `${people}명` : people,
    budget: Number(aiResult.budget ?? previous.budget ?? 60000),
    status: aiResult.status ?? previous.status ?? '방문 완료',
    historyIcon: aiResult.historyIcon ?? (Array.isArray(aiResult.menuItems) ? aiResult.menuItems[0]?.historyIcon : previous.historyIcon) ?? 'assets/history-utensils.png',
    report: { ...(previous.report || {}), ...(aiResult.report || {}) },
    menuItems: Array.isArray(aiResult.menuItems) ? aiResult.menuItems : (previous.menuItems || []),
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
  startAnalysis();
});
codeModal.addEventListener('click', (event) => {
  if (event.target === codeModal) closeCodeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !codeModal.hidden) closeCodeModal();
});

const resultActions = document.querySelectorAll('#result-screen .result-actions button');
replaceControl('#result-screen .result-actions button:first-child', startAnalysis);
replaceControl('#result-screen .result-actions button:last-child', () => {
  if (!currentRecommendation) return;
  history.save(currentRecommendation);
  currentRecommendation = null;
  homeController.updateOngoing();
  showScreen('history-screen', 'history-screen');
  historyReturnScreen = 'recommendation-screen';
});
replaceControl('#edit-submit', () => {
  syncRecommendationFromEdit();
  editSnapshot = null;
  startAnalysis({ reanalyseCurrent: true });
});

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
addFoodTag('\uC624\uC774');
addFoodTag('\uACAC\uACFC\uB958');
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

// Enter 입력은 blur 처리와 분리해, 모바일·데스크톱에서 모두 확실히 태그를 추가합니다.
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

function populateEditForm() {
  if (!currentRecommendation) return;
  editBudgetInput.value = Number(currentRecommendation.budget || 60000).toLocaleString('ko-KR');
  document.querySelector('#edit-people-count').textContent = currentRecommendation.people || '3명';
  spiceRange.value = String(currentRecommendation.spice || 3);
  spiceRange.dispatchEvent(new Event('input'));
  foodTags.querySelectorAll('.food-tag').forEach((tag) => tag.remove());
  (currentRecommendation.excludedFoods || []).forEach(addFoodTag);
  updateBudgetGauge();
}

function syncRecommendationFromEdit() {
  if (!currentRecommendation) return;
  currentRecommendation.people = document.querySelector('#edit-people-count').textContent;
  currentRecommendation.budget = Number(editBudgetInput.value.replace(/,/g, '')) || 0;
  currentRecommendation.excludedFoods = readFoodTags();
  currentRecommendation.spice = Number(spiceRange.value);
  renderRecommendationResult();
  history.render();
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
