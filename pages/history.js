window.createHistory = function createHistory({ root, showScreen, onOpen }) {
  const items = [];
  const header = document.createElement('header');
  header.className = 'history-header';
  const title = document.createElement('strong');
  title.textContent = '히스토리';
  const search = document.createElement('button');
  search.type = 'button';
  search.className = 'history-search';
  search.setAttribute('aria-label', '검색');
  header.append(title, search);

  const list = document.createElement('div');
  list.className = 'history-list';
  root.replaceChildren(header, list);

  function render() {
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.innerHTML = '<strong>아직 추천 내역이 없어요</strong><span>추천 결과를 주문 확정하면 여기에 저장됩니다.</span>';
      list.append(empty);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'history-card';
      const icon = document.createElement('span');
      icon.className = 'history-icon';
      const image = document.createElement('img');
      image.src = item.historyIcon || item.menuItems?.[0]?.historyIcon || 'assets/history-utensils.png';
      image.alt = '';
      icon.append(image);
      const name = document.createElement('strong');
      name.className = 'history-name';
      name.textContent = item.title;
      const meta = document.createElement('div');
      meta.className = 'history-meta';
      [item.people, item.mood].forEach((label) => {
        const badge = document.createElement('span');
        badge.textContent = label;
        meta.append(badge);
      });
      const price = document.createElement('em');
      price.textContent = item.total;
      card.append(icon, name, meta, price);
      card.addEventListener('click', () => {
        onOpen(item);
      });
      list.append(card);
    });
  }

  function save(item) {
    if (!items.includes(item)) items.unshift(item);
    render();
  }

  return { items, render, save };
};
