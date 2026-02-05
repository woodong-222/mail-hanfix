// 서비스 워커: 변환 로그/카운트 상태 저장
var STORAGE_KEY = 'mail-hanfix';

// 날짜 기준으로 일일 로그를 리셋
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

// 기본 상태
function getDefaultState() {
  return { enabled: true, today: getToday(), count: 0, log: [] };
}

// storage에서 상태 로드 및 날짜 변경 시 초기화
async function loadState() {
  var result = await chrome.storage.local.get(STORAGE_KEY);
  var state = result[STORAGE_KEY] || getDefaultState();

  if (state.today !== getToday()) {
    state.today = getToday();
    state.count = 0;
    state.log = [];
  }
  return state;
}

// storage에 상태 저장
async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

// 배지 표시
function updateBadge(count) {
  chrome.action.setBadgeText({ text: '' });
}

// 로그에 표시할 호스트명 추출
function getHostFromUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return '';
  try {
    return new URL(url).hostname || '';
  } catch (_) {
    return '';
  }
}

// bridge.js에서 전달된 normalized 이벤트 처리
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action !== 'normalized') return;

  (async function () {
    var state = await loadState();
    if (!state.enabled) return;

    // 변환 로그 저장
    state.count++;
    state.log.push({
      original: msg.original,
      normalized: msg.normalized,
      time: new Date().toLocaleTimeString('ko-KR'),
      url: sender.tab ? sender.tab.url : '',
      site: sender.tab ? getHostFromUrl(sender.tab.url) : ''
    });

    if (state.log.length > 50) {
      state.log = state.log.slice(-50);
    }

    await saveState(state);
    updateBadge(state.count);
  })();

  return true;
});

// 설치 직후 배지 초기화
chrome.runtime.onInstalled.addListener(async function () {
  var state = await loadState();
  updateBadge(state.count);
});

// 브라우저 시작 시 배지 초기화
chrome.runtime.onStartup.addListener(async function () {
  var state = await loadState();
  updateBadge(state.count);
});
