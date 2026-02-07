// 브리지 역할: 페이지 컨텍스트(window) ↔ 확장 컨텍스트(chrome.runtime)
// storage 상태를 content.js로 전달 + normalized 메시지를 background로 릴레이
var STORAGE_KEY = 'mail-hanfix';
var MSG_TYPE = 'mail-hanfix';

// content.js에 활성 상태 전달
function sendEnabled(value) {
  window.postMessage({
    type: MSG_TYPE,
    action: 'set-enabled',
    enabled: value
  }, '*');
}

// 초기 상태 전달(storage 값을 읽어 content.js의 enabled 갱신)
chrome.storage.local.get(STORAGE_KEY, function (result) {
  var state = result[STORAGE_KEY];
  sendEnabled(!state || state.enabled !== false);
});

// 토글 변경 감지(popup에서 enabled가 바뀌면 즉시 content.js로 전달)
chrome.storage.onChanged.addListener(function (changes) {
  if (!changes[STORAGE_KEY]) return;
  var state = changes[STORAGE_KEY].newValue;
  sendEnabled(!state || state.enabled !== false);
});

// 메시지 릴레이(content.js → background.js)
window.addEventListener('message', function (event) {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== MSG_TYPE) return;
  if (event.data.action !== 'normalized') return;

  if (!chrome.runtime || !chrome.runtime.id) return;

  try {
    chrome.runtime.sendMessage({
      action: 'normalized',
      kind: event.data.kind,
      original: event.data.original,
      normalized: event.data.normalized
    });
  } catch (_) {}
});
