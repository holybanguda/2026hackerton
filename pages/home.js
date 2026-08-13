window.bindHomeScreen = function bindHomeScreen({ showScreen, notify }) {
  document.querySelector('[data-action="start"]')?.addEventListener('click', () => {
    showScreen('scan-screen', 'home-screen');
  });

  document.querySelector('[data-action="menu"]')?.addEventListener('click', () => {
    notify('메뉴판 기능을 준비하고 있어요.');
  });
};
