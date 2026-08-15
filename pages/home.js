window.bindHomeScreen = function bindHomeScreen({ showScreen, notify, getOngoingCount, openOngoing }) {
  document.querySelector('[data-action="start"]')?.addEventListener('click', () => {
    showScreen('recommendation-screen', 'home-screen');
  });

  document.querySelector('[data-action="menu"]')?.addEventListener('click', () => {
    notify('메뉴판 기능을 준비하고 있어요.');
  });

  const ongoing = document.querySelector('[data-action="ongoing-recommendation"]');
  const ongoingCopy = ongoing?.querySelector('.card-copy small');
  const ongoingCount = document.querySelector('#ongoing-count');
  const updateOngoing = () => {
    const count = getOngoingCount();
    const active = count > 0;
    if (ongoingCopy) ongoingCopy.textContent = active ? `${count}개의 추천이 진행 중입니다` : '진행 중인 추천이 없습니다';
    if (ongoingCount) {
      ongoingCount.hidden = !active;
      ongoingCount.textContent = active ? String(count) : '';
    }
  };

  document.querySelector('[data-action="new-recommendation"]')?.addEventListener('click', () => {
    showScreen('scan-screen', 'home-screen');
  });
  ongoing?.addEventListener('click', openOngoing);

  updateOngoing();
  return { updateOngoing };
};
