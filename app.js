const home = document.querySelector('#home-screen');
const scan = document.querySelector('#scan-screen');
const toast = document.querySelector('#toast');

const navIcons = ['assets/nav-home.png', 'assets/nav-history.png'];
document.querySelectorAll('.bottom-nav .nav-item span').forEach((slot, index) => {
  const icon = document.createElement('img');
  icon.src = navIcons[index];
  icon.alt = '';
  slot.replaceChildren(icon);
});

const historyRoot = document.querySelector('#history-root');
const historyHeader = document.createElement('header');
historyHeader.className = 'history-header';
const historyTitle = document.createElement('strong');
historyTitle.textContent = '\uD788\uC2A4\uD1A0\uB9AC';
const historySearch = document.createElement('button');
historySearch.type = 'button';
historySearch.className = 'history-search';
historySearch.setAttribute('aria-label', '\uAC80\uC0C9');
const historyActions = document.createElement('div');
historyActions.className = 'history-actions';
historyActions.append(historySearch);
historyHeader.append(historyTitle, historyActions);
const historyTabs = document.createElement('div');
historyTabs.className = 'history-tabs';
['\uC804\uCCB4', '\uBC29\uBB38 \uC644\uB8CC'].forEach((label, index) => {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.textContent = label;
  tab.className = index === 0 ? 'selected' : '';
  historyTabs.append(tab);
});
const historyList = document.createElement('div');
historyList.className = 'history-list';
const historyItems = [
  ['\uBC29\uBB38 \uC644\uB8CC', '\uCC44\uB05D \uB4F1\uC2EC \uC2A4\uD14C\uC774\uD06C \uC678 2\uAC74', '3\uBA85', '\uB370\uC774\uD2B8', '58,000\uC6D0', 'assets/history-utensils.png'],
  ['\uBC29\uBB38 \uC644\uB8CC', '\uD504\uB9AC\uBBF8\uC5C4 \uBAA8\uB4EC \uC2A4\uC2DC B\uC138\uD2B8', '2\uBA85', '\uBE44\uC988\uB2C8\uC2A4', '120,000\uC6D0', 'assets/history-fish.png'],
  ['\uCDE8\uC18C\uB428', '\uC815\uD1B5 \uAE4C\uB974\uBCF4\uB098\uB77C \uC678 1\uAC74', '4\uBA85', '\uAC00\uC871\uBAA8\uC784', '42,000\uC6D0', 'assets/history-pasta.png'],
  ['\uBC29\uBB38 \uC644\uB8CC', '\uB9E4\uCF64 \uC81C\uC721 \uC30D\uBC25 \uC815\uC2DD', '1\uBA85', '\uD63C\uBC25', '12,000\uC6D0', 'assets/history-vegetable.png'],
];
historyItems.forEach((item, index) => {
  const card = document.createElement('article');
  card.className = `history-card ${index === 2 ? 'cancelled' : ''}`;
  const status = document.createElement('b'); status.className = 'history-status'; status.textContent = item[0];
  const icon = document.createElement('span'); icon.className = 'history-icon';
  const image = document.createElement('img'); image.src = item[5]; image.alt = ''; icon.append(image);
  const name = document.createElement('strong'); name.className = 'history-name'; name.textContent = item[1];
  const meta = document.createElement('div'); meta.className = 'history-meta';
  [item[2], item[3]].forEach((label) => { const badge = document.createElement('span'); badge.textContent = label; meta.append(badge); });
  const price = document.createElement('em'); price.textContent = item[4];
  card.append(status, icon, name, meta, price);
  card.addEventListener('click', () => showScreen(index === 0 ? 'edit-screen' : 'result-screen', 'history-screen'));
  historyList.append(card);
});
historyTabs.querySelectorAll('button').forEach((tab, index) => {
  tab.addEventListener('click', () => {
    historyTabs.querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === tab));
    historyList.querySelectorAll('.history-card').forEach((card) => {
      card.hidden = index === 1 && card.classList.contains('cancelled');
    });
  });
});
historyRoot.append(historyHeader, historyTabs, historyList);

function showScreen(screen, activeTab = screen) {
  document.querySelectorAll('.screen').forEach((item) => item.classList.remove('active'));
  document.querySelector(`#${screen}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('selected', item.dataset.screen === activeTab));
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

document.querySelector('[data-action="start"]').addEventListener('click', () => showScreen('scan-screen', 'home-screen'));
document.querySelector('[data-action="continue"]').addEventListener('click', () => notify('진행 중인 추천을 준비하고 있어요.'));
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
resultEditButton.addEventListener('click', () => showScreen('edit-screen', 'home-screen'));

const menuIconAssets = ['assets/utensils.png', 'assets/utensils.png', 'assets/wine-glass.png'];
document.querySelectorAll('#result-screen .menu-list article > b').forEach((slot, index) => {
  const icon = document.createElement('img');
  icon.src = menuIconAssets[index];
  icon.alt = '';
  slot.replaceChildren(icon);
});

const currentOrderButton = document.querySelector('#edit-screen .current-order button');
const currentOrderIcon = document.createElement('img');
currentOrderIcon.src = 'assets/utensils.png';
currentOrderIcon.alt = '';
const currentOrderLabel = document.createElement('span');
currentOrderLabel.textContent = '채끝 등심 스테이크 외 2건';
const currentOrderChevron = document.createElement('i');
currentOrderChevron.textContent = '›';
currentOrderButton.replaceChildren(currentOrderIcon, currentOrderLabel, currentOrderChevron);

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

const firstMenuCopy = document.querySelector('#result-screen .menu-list article span');
const menuTags = document.createElement('div');
menuTags.className = 'menu-tags';
menuTags.innerHTML = '<b>인기</b><b>추천</b>';
firstMenuCopy.append(menuTags);
