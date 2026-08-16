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

      name.textContent = item.title || (item.menuItems?.[0] ? `${item.menuItems[0].name} 외 ${item.menuItems.length - 1}건` : '추천 결과');

      const meta = document.createElement('div');
      meta.className = 'history-meta';

      const peopleLabel = item.people || (item.peopleCount ? `${item.peopleCount}명` : '2명');
      const moodLabel = item.mood || item.meetingType || '데이트';

      [peopleLabel, moodLabel].forEach((label) => {
        const badge = document.createElement('span');
        badge.textContent = label;
        meta.append(badge);
      });

      const price = document.createElement('em');

      price.textContent = item.total || (item.totalPrice ? `${item.totalPrice.toLocaleString('ko-KR')}원` : '0원');

      card.append(icon, name, meta, price);

      card.addEventListener('click', () => {
        if (typeof onOpen === 'function') {
          onOpen(item);
        }
      });
      list.append(card);
    });
  }

  function save(item) {
    if (!item) return;

    const copyItem = JSON.parse(JSON.stringify(item));

    const resolvedPeople =
        copyItem.peopleCount
            ? `${copyItem.peopleCount}명`
            : (copyItem.people || '2명');

    copyItem.people = resolvedPeople;
    copyItem.mood = copyItem.mood || copyItem.meetingType || '식사';
    copyItem.total =
        copyItem.total ||
        (copyItem.totalPrice
            ? `${copyItem.totalPrice.toLocaleString('ko-KR')}원`
            : '0원');

    items.unshift(copyItem);

    render();
  }

  return {
    items,
    render,
    save
  };
};