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
