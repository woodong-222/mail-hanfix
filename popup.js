var STORAGE_KEY = 'koreatech-hanfix';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

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

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

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

  var items = state.log.slice().reverse().slice(0, 20);
  items.forEach(function (entry) {
    var li = document.createElement('li');

    var time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = entry.time || '';

    var site = document.createElement('span');
    site.className = 'log-site';
    site.textContent = entry.site || '';

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

function formatOriginal(value) {
  if (typeof value !== 'string') return '';
  if (value === value.normalize('NFC')) return value;
  return value.replace(/([\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF])(?=[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF])/g, '$1 ');
}

document.addEventListener('DOMContentLoaded', async function () {
  var state = await loadState();
  render(state);

  document.getElementById('toggle').addEventListener('change', async function (e) {
    var state = await loadState();
    state.enabled = e.target.checked;
    await saveState(state);
  });
});
