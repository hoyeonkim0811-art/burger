const views = [...document.querySelectorAll('[data-view]')];
const nav = document.querySelector('.main-nav');
const menuToggle = document.querySelector('.menu-toggle');

function currentSession() {
  try {
    return JSON.parse(sessionStorage.getItem('butcher-vanity.session.v1') || localStorage.getItem('butcher-vanity.session.v1') || 'null');
  } catch {
    return null;
  }
}

function syncAuthHeader() {
  const session = currentSession();
  const loginLink = document.querySelector('.login-link');
  const signupLink = document.querySelector('.header-actions .button');
  if (!loginLink || !signupLink) return;
  if (session) {
    loginLink.textContent = `${session.name || '회원'}님`;
    loginLink.href = '#home';
    signupLink.textContent = '로그아웃';
    signupLink.href = '#home';
    signupLink.onclick = (event) => {
      event.preventDefault();
      localStorage.removeItem('butcher-vanity.session.v1');
      sessionStorage.removeItem('butcher-vanity.session.v1');
      syncAuthHeader();
    };
  } else {
    loginLink.textContent = '로그인';
    loginLink.href = '#login';
    signupLink.innerHTML = '회원가입 <span>↗</span>';
    signupLink.href = '#signup';
    signupLink.onclick = null;
  }
}

function showRoute() {
  const route = location.hash.replace('#', '') || 'home';
  const view = views.find((item) => item.dataset.view === route) || views[0];
  views.forEach((item) => item.classList.toggle('is-active', item === view));
  document.querySelectorAll('[data-route]').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === view.dataset.view);
  });
  nav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  syncAuthHeader();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('hashchange', showRoute);
showRoute();

menuToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(open));
});

const slideNames = ['달콤한 초대', '찬란한 만찬', '마지막 한 조각'];
let activeSlide = 0;
const dots = [...document.querySelectorAll('.slider-dot')];
const art = document.querySelector('.hero-art');
function setSlide(index) {
  activeSlide = (index + dots.length) % dots.length;
  dots.forEach((dot, i) => {
    dot.classList.toggle('is-current', i === activeSlide);
    dot.setAttribute('aria-pressed', String(i === activeSlide));
  });
  document.querySelector('.note-top').innerHTML = `<span>${String(activeSlide + 1).padStart(2, '0')}</span> ${slideNames[activeSlide]}`;
  document.querySelector('.art-caption span:last-child').textContent = `${String(activeSlide + 1).padStart(2, '0')} / 03`;
  art.dataset.tone = ['gold', 'rose', 'lime'][activeSlide];
}
dots.forEach((dot, i) => dot.addEventListener('click', () => setSlide(i)));
document.querySelectorAll('.slider-arrow').forEach((arrow, i) => {
  arrow.addEventListener('click', () => setSlide(activeSlide + (i === 0 ? -1 : 1)));
});

const accountKey = 'butcher-vanity.accounts.v1';
const sessionKey = 'butcher-vanity.session.v1';

function readAccounts() {
  try {
    return JSON.parse(localStorage.getItem(accountKey) || '{}');
  } catch {
    return {};
  }
}

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

document.querySelectorAll('form[data-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('.form-message');
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = '확인 중…';

    try {
      const accounts = readAccounts();
      if (form.dataset.form === 'signup') {
        if (accounts[email]) {
          message.textContent = '이미 가입된 이메일입니다. 로그인해 주세요.';
          return;
        }
        const salt = crypto.randomUUID();
        accounts[email] = {
          name: String(data.get('name') || '').trim(),
          salt,
          passwordHash: await hashPassword(password, salt),
        };
        localStorage.setItem(accountKey, JSON.stringify(accounts));
        message.textContent = '가입이 완료되었습니다! 이제 로그인할 수 있어요.';
        form.reset();
      } else {
        const account = accounts[email];
        if (!account || await hashPassword(password, account.salt) !== account.passwordHash) {
          message.textContent = '이메일 또는 비밀번호를 확인해 주세요.';
          return;
        }
        const storage = form.querySelector('input[type="checkbox"]')?.checked ? localStorage : sessionStorage;
        storage.setItem(sessionKey, JSON.stringify({ email, name: account.name }));
        message.textContent = `${account.name || '회원'}님, 로그인되었습니다!`;
        form.reset();
        syncAuthHeader();
        location.hash = 'home';
      }
    } catch (error) {
      message.textContent = error instanceof DOMException && error.name === 'QuotaExceededError'
        ? '브라우저 저장 공간이 부족해 완료하지 못했습니다.'
        : '브라우저 저장 기능을 사용할 수 없습니다. 페이지를 다시 열어 시도해 주세요.';
    } finally {
      button.disabled = false;
    }
  });
});

const cartStorageKey = 'butcher-vanity.cart.v1';
const cart = new Map();
try {
  const savedCart = JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
  savedCart.forEach(([name, item]) => {
    if (item && Number.isFinite(item.price) && Number.isInteger(item.quantity) && item.quantity > 0) cart.set(name, item);
  });
} catch { /* Ignore invalid or unavailable browser storage. */ }
const won = (amount) => `₩${amount.toLocaleString('ko-KR')}`;
function renderCart() {
  const list = document.querySelector('.cart-list');
  if (!list) return;
  list.replaceChildren();
  let count = 0;
  let total = 0;
  for (const [name, item] of cart) {
    count += item.quantity;
    total += item.price * item.quantity;
    const row = document.createElement('li');
    row.className = 'cart-item';
    row.innerHTML = `<span>${name}<small>× ${item.quantity}</small></span><div class="cart-item-actions"><button type="button" data-cart-action="minus" data-name="${name}" aria-label="${name} 수량 줄이기">−</button><button type="button" data-cart-action="plus" data-name="${name}" aria-label="${name} 수량 늘리기">＋</button><b>${won(item.price * item.quantity)}</b><button type="button" class="cart-remove" data-cart-action="remove" data-name="${name}">삭제</button></div>`;
    list.append(row);
  }
  if (!count) {
    const empty = document.createElement('li');
    empty.className = 'cart-empty';
    empty.textContent = '아직 담긴 메뉴가 없습니다.';
    list.append(empty);
  }
  document.querySelector('.cart-count').textContent = count;
  document.querySelector('.cart-total b').textContent = won(total);
  try { localStorage.setItem(cartStorageKey, JSON.stringify([...cart])); } catch { /* Cart still works for this visit. */ }
}

document.querySelectorAll('.add-to-cart,[data-add]').forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.name || button.dataset.add;
    const price = Number(button.dataset.price);
    const item = cart.get(name) || { price, quantity: 0 };
    item.quantity += 1;
    cart.set(name, item);
    renderCart();
    const message = document.querySelector('.order-message');
    if (message) message.textContent = `${name} 메뉴를 담았습니다.`;
  });
});

document.querySelector('.cart-list')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cart-action]');
  if (!button) return;
  const item = cart.get(button.dataset.name);
  if (!item) return;
  if (button.dataset.cartAction === 'remove') cart.delete(button.dataset.name);
  else if (button.dataset.cartAction === 'minus') {
    item.quantity -= 1;
    if (item.quantity <= 0) cart.delete(button.dataset.name);
  } else item.quantity += 1;
  renderCart();
});

document.querySelector('.clear-cart')?.addEventListener('click', () => {
  cart.clear();
  renderCart();
  const message = document.querySelector('.order-message');
  if (message) message.textContent = '장바구니를 비웠습니다.';
});

document.querySelector('.checkout-button')?.addEventListener('click', () => {
  const message = document.querySelector('.order-message');
  message.textContent = cart.size ? '주문 요약을 확인했습니다. 데모이므로 결제는 진행되지 않습니다.' : '먼저 메뉴를 장바구니에 담아주세요.';
});

document.querySelector('.store-search')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = document.querySelector('#store-query').value.trim().toLowerCase();
  const cards = [...document.querySelectorAll('.store-results article')];
  const matches = cards.filter((card) => !query || card.textContent.toLowerCase().includes(query));
  cards.forEach((card) => { card.hidden = !matches.includes(card); });
  const results = document.querySelector('.store-results');
  let empty = results.querySelector('.store-no-results');
  if (!matches.length) {
    if (!empty) {
      empty = document.createElement('p');
      empty.className = 'store-no-results';
      empty.textContent = '검색 결과가 없습니다. 지역을 바꿔 다시 검색해보세요.';
      results.append(empty);
    }
  } else empty?.remove();
});

const savedMerchKey = 'butcher-vanity.saved-merch.v1';
let savedMerch = new Set();
try { savedMerch = new Set(JSON.parse(localStorage.getItem(savedMerchKey) || '[]')); } catch { /* Start empty. */ }
document.querySelectorAll('.merch-interest').forEach((button) => {
  const name = button.closest('.merch-card').querySelector('h2').textContent;
  if (savedMerch.has(name)) {
    button.classList.add('is-saved');
    button.textContent = '관심 상품에 저장됨 ♥';
  }
  button.addEventListener('click', () => {
    if (savedMerch.has(name)) savedMerch.delete(name);
    else savedMerch.add(name);
    button.classList.toggle('is-saved', savedMerch.has(name));
    button.textContent = savedMerch.has(name) ? '관심 상품에 저장됨 ♥' : '관심 상품으로 저장 ♡';
    try { localStorage.setItem(savedMerchKey, JSON.stringify([...savedMerch])); } catch { /* Toggle remains active for this visit. */ }
  });
});
renderCart();

