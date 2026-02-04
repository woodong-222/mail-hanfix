var STORAGE_KEY = 'koreatech-hanfix';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultState() {
  return { enabled: true, today: getToday(), count: 0, log: [] };
}

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

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: '' });
}

function getHostFromUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return '';
  try {
    return new URL(url).hostname || '';
  } catch (_) {
    return '';
  }
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action !== 'normalized') return;

  (async function () {
    var state = await loadState();
    if (!state.enabled) return;

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

chrome.runtime.onInstalled.addListener(async function () {
  var state = await loadState();
  updateBadge(state.count);
});

chrome.runtime.onStartup.addListener(async function () {
  var state = await loadState();
  updateBadge(state.count);
});
