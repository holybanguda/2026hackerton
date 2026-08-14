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
const history = createHistory({
  root: document.querySelector('#history-root'),
  showScreen,
  onOpen: (item) => {
    currentRecommendation = item;
    renderRecommendationResult();
  },
});

function showScreen(screen, activeTab = screen) {
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
  showScreen('result-screen', 'home-screen');
}

function startAnalysis({ reanalyseCurrent = false } = {}) {
  analysisTarget = reanalyseCurrent ? currentRecommendation : null;
  showScreen('analysis-screen', 'home-screen');
  window.setTimeout(completeAnalysis, 1800);
}

let qrStream = null;
let qrDetector = null;
let qrFrame = null;

function stopQrCamera() {
  if (qrFrame) cancelAnimationFrame(qrFrame);
  qrFrame = null;
  if (qrStream) qrStream.getTracks().forEach((track) => track.stop());
  qrStream = null;
  document.querySelector('#qr-camera')?.remove();
  document.querySelector('.scanner')?.classList.remove('is-scanning');
}

async function startQrCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { notify('\uC774 \uAE30\uAE30\uC5D0\uC11C\uB294 \uCE74\uBA54\uB77C \uC2A4\uCEA0\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'); return; }
  stopQrCamera();
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const scanner = document.querySelector('.scanner');
    const video = document.createElement('video');
    video.id = 'qr-camera'; video.autoplay = true; video.playsInline = true; video.srcObject = qrStream;
    scanner.prepend(video); scanner.classList.add('is-scanning');
    if (!('BarcodeDetector' in window)) { notify('QR \uC790\uB3D9 \uC778\uC2DD\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uBE0C\uB77C\uC6B0\uC800\uC785\uB2C8\uB2E4.'); return; }
    qrDetector = new BarcodeDetector({ formats: ['qr_code'] });
    const detect = async () => {
      if (!qrStream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) { qrFrame = requestAnimationFrame(detect); return; }
      try {
        if ((await qrDetector.detect(video)).length) { stopQrCamera(); startAnalysis(); return; }
      } catch (_) { /* camera frame not ready */ }
      qrFrame = requestAnimationFrame(detect);
    };
    detect();
  } catch (_) { notify('\uCE74\uBA54\uB77C \uAD8C\uD55C\uC744 \uD5C8\uC6A9\uD574 \uC8FC\uC138\uC694.'); }
}

bindHomeScreen({ showScreen, notify });
document.querySelector('[data-action="menu"]').addEventListener('click', (event) => {
  notify('메뉴판 기능을 준비하고 있어요.');
});
document.querySelector('#back-button').addEventListener('click', () => showScreen('home-screen'));
document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => showScreen(item.dataset.screen)));
document.querySelector('#permission').addEventListener('click', () => notify('카메라 권한 설정을 열어주세요.'));
document.querySelector('.scan-button').addEventListener('click', () => showScreen('result-screen', 'home-screen'));
document.querySelector('#member-back-button').addEventListener('click', () => showScreen('scan-screen', 'home-screen'));
document.querySelectorAll('[data-people]').forEach((item) => item.addEventListener('click', () => {
  const people = item.dataset.people;
  document.querySelectorAll('[data-people]').forEach((button) => button.classList.toggle('selected', button === item));
  document.querySelector('#people-input').value = '';
  document.querySelector('#people-total').textContent = `${people}명`;
}));
document.querySelector('#people-input').addEventListener('input', (event) => {
  const people = Number(event.target.value);
  document.querySelectorAll('[data-people]').forEach((button) => button.classList.remove('selected'));
  document.querySelector('#people-total').textContent = people > 0 ? `${people}명` : '0명';
});
document.querySelector('#next-step').addEventListener('click', () => {
  const people = document.querySelector('#people-total').textContent;
  document.querySelector('#budget-people').textContent = `${people} 기준`;
  document.querySelector('#budget-people-count').textContent = people;
  updateBudget();
  showScreen('budget-screen', 'home-screen');
});
document.querySelector('#budget-back-button').addEventListener('click', () => showScreen('member-screen', 'home-screen'));
document.querySelector('#change-people').addEventListener('click', () => showScreen('member-screen', 'home-screen'));
function updateBudget(value) {
  const perPerson = Number(value ?? document.querySelector('#budget-range').value);
  const people = Number(document.querySelector('#people-total').textContent.replace('명', '')) || 0;
  const won = new Intl.NumberFormat('ko-KR');
  document.querySelector('#total-budget').textContent = `총 ${won.format(perPerson * people)}원`;
  document.querySelector('#budget-formula').textContent = `= 1인 예산 ${won.format(perPerson)}원 × ${people}명`;
}
document.querySelector('#budget-range').addEventListener('input', (event) => { document.querySelector('#budget-input').value = ''; updateBudget(event.target.value); });
document.querySelector('#budget-input').addEventListener('input', (event) => { if (event.target.value) updateBudget(event.target.value); });
document.querySelectorAll('[data-budget]').forEach((item) => item.addEventListener('click', () => { document.querySelector('#budget-range').value = item.dataset.budget; document.querySelector('#budget-input').value = ''; updateBudget(item.dataset.budget); }));
document.querySelector('#budget-next').addEventListener('click', () => notify('다음 추천 단계를 준비하고 있어요.'));
document.querySelectorAll('[data-message]').forEach((item) => item.addEventListener('click', () => notify(item.dataset.message)));
document.querySelector('#budget-next').addEventListener('click', () => showScreen('mood-screen', 'home-screen'));
document.querySelector('#mood-back').addEventListener('click', () => showScreen('budget-screen', 'home-screen'));
document.querySelectorAll('[data-mood]').forEach((item) => item.addEventListener('click', () => { document.querySelectorAll('[data-mood]').forEach((button) => button.classList.remove('selected')); item.classList.add('selected'); }));
document.querySelector('.mood-next').addEventListener('click', () => showScreen('condition-screen', 'home-screen'));
document.querySelector('#condition-back').addEventListener('click', () => showScreen('mood-screen', 'home-screen'));
document.querySelectorAll('[data-allergy]').forEach((item) => item.addEventListener('click', () => item.classList.toggle('checked')));
document.querySelector('#condition-finish').addEventListener('click', () => notify('추천 조건 설정을 완료했어요.'));
document.querySelector('#condition-finish').addEventListener('click', () => showScreen('feature-screen', 'home-screen'));
document.querySelector('#feature-back').addEventListener('click', () => showScreen('condition-screen', 'home-screen'));
document.querySelectorAll('[data-count]').forEach((button) => button.addEventListener('click', () => { const target=document.querySelector(`#${button.dataset.count}-count`); target.textContent=Math.max(0,Number(target.textContent)+Number(button.dataset.change)); }));
document.querySelector('#spice-range').addEventListener('input',e=>document.querySelector('#spice-value').textContent=e.target.value);
document.querySelector('#feature-finish').addEventListener('click',()=>notify('AI 메뉴 분석을 시작합니다.'));
document.querySelector('#feature-finish').addEventListener('click',()=>{showScreen('analysis-screen','home-screen');setTimeout(()=>showScreen('result-screen','home-screen'),2500)});
document.querySelector('#analysis-cancel').addEventListener('click',()=>showScreen('feature-screen','home-screen'));
document.querySelector('#analysis-close').addEventListener('click',()=>showScreen('feature-screen','home-screen'));
document.querySelector('#result-back').addEventListener('click',()=>showScreen('scan-screen','home-screen'));
document.querySelector('#result-home').addEventListener('click',()=>showScreen('home-screen'));
document.querySelector('.result-actions button').addEventListener('click',()=>showScreen('edit-screen','home-screen'));
document.querySelector('#edit-close').addEventListener('click',()=>showScreen('result-screen','home-screen'));
document.querySelector('#edit-cancel').addEventListener('click',()=>showScreen('result-screen','home-screen'));
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
document.querySelectorAll('[data-edit-people]').forEach(b=>b.addEventListener('click',()=>{const e=document.querySelector('#edit-people-count');e.textContent=`${Math.max(1,Number(e.textContent.replace('명',''))+Number(b.dataset.editPeople))}명`}));
document.querySelector('#edit-submit').addEventListener('click',()=>{showScreen('analysis-screen','home-screen');setTimeout(()=>showScreen('result-screen','home-screen'),1800)});

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
  populateEditForm();
  showScreen('edit-screen', 'home-screen');
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
const currentOrderIcon = document.createElement('img');
currentOrderIcon.src = 'assets/utensils.png';
currentOrderIcon.alt = '';
const currentOrderLabel = document.createElement('span');
currentOrderLabel.textContent = '채끝 등심 스테이크 외 2건';
const currentOrderChevron = document.createElement('i');
currentOrderChevron.textContent = '›';
currentOrderButton.replaceChildren(currentOrderIcon, currentOrderLabel, currentOrderChevron);

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
  showScreen('history-screen', 'history-screen');
});
replaceControl('#edit-submit', () => {
  syncRecommendationFromEdit();
  startAnalysis({ reanalyseCurrent: true });
});
replaceControl('#feature-finish', startAnalysis);

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
