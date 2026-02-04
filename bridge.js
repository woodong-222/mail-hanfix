var STORAGE_KEY = 'koreatech-hanfix';
var MSG_TYPE = 'koreatech-hanfix';

function sendEnabled(value) {
  window.postMessage({
    type: MSG_TYPE,
    action: 'set-enabled',
    enabled: value
  }, '*');
}

// 초기 상태 전달
chrome.storage.local.get(STORAGE_KEY, function (result) {
  var state = result[STORAGE_KEY];
  sendEnabled(!state || state.enabled !== false);
});

// 토글 변경 감지
chrome.storage.onChanged.addListener(function (changes) {
  if (!changes[STORAGE_KEY]) return;
  var state = changes[STORAGE_KEY].newValue;
  sendEnabled(!state || state.enabled !== false);
});

// 메시지 릴레이
window.addEventListener('message', function (event) {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== MSG_TYPE) return;
  if (event.data.action !== 'normalized') return;

  if (!chrome.runtime || !chrome.runtime.id) return;

  try {
    chrome.runtime.sendMessage({
      action: 'normalized',
      original: event.data.original,
      normalized: event.data.normalized
    });
  } catch (_) {}
});
