// storage 상태를 읽어 토글/로그를 렌더
var STORAGE_KEY = 'mail-hanfix';

// 날짜 기준으로 일일 로그를 리셋
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

// storage에서 상태 로드 + 날짜 변경 시 초기화
async function loadState() {
  var result = await chrome.storage.local.get(STORAGE_KEY);
  var state = result[STORAGE_KEY] || { enabled: true, today: getToday(), count: 0, log: [] };

  if (state.today !== getToday()) {
    state.today = getToday();
    state.count = 0;
    state.log = [];
  }
  return state; 
}

// storage에 상태 저장 (enabled 변경 시 호출)
async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

// 토글 + 최근 변환 리스트
function render(state) {
  document.getElementById('toggle').checked = state.enabled;

  var list = document.getElementById('log-list');
  var empty = document.getElementById('log-empty');

  list.innerHTML = '';

  if (!state.log || state.log.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  // 최신 20개만 노출 (역순)
  var items = state.log.slice().reverse().slice(0, 20);
  items.forEach(function (entry) {
    var li = document.createElement('li');

    var time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = entry.time || '';

    var site = document.createElement('span');
    site.className = 'log-site';
    site.textContent = (entry.kind === 'download' ? '[다운로드]' : '[업로드]') + (entry.site ? ' ' + entry.site : '');

    var orig = document.createElement('span');
    orig.className = 'log-original';
    orig.textContent = formatOriginal(entry.original);

    var arrow = document.createElement('span');
    arrow.className = 'log-arrow';
    arrow.textContent = '→';

    var norm = document.createElement('span');
    norm.className = 'log-normalized';
    norm.textContent = entry.normalized;

    li.appendChild(time);
    li.appendChild(site);
    li.appendChild(orig);
    li.appendChild(arrow);
    li.appendChild(norm);
    list.appendChild(li);
  });
}

// 원본 파일명 표시용 (NFD 분리 상태면 보기 좋게 공백 삽입) ex) ㅎㅏㄴ -> 한
function formatOriginal(value) {
  if (typeof value !== 'string') return '';
  if (value === value.normalize('NFC')) return value;
  return value.replace(/([\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF])(?=[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF])/g, '$1 ');
}

// 팝업이 열릴 때마다 상태를 읽고 렌더
document.addEventListener('DOMContentLoaded', async function () {
  var state = await loadState();
  render(state);

  // 토글 변경 → storage 저장 → bridge.js가 변경 감지 후 content.js로 전달
  document.getElementById('toggle').addEventListener('change', async function (e) {
    var state = await loadState();
    state.enabled = e.target.checked;
    await saveState(state);
  });
});
