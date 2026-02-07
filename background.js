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

function buildIndexMap(list) {
  var map = {};
  for (var i = 0; i < list.length; i++) {
    map[list[i]] = i;
  }
  return map;
}

var CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
var JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
var JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

var CHO_INDEX = buildIndexMap(CHO);
var JUNG_INDEX = buildIndexMap(JUNG);
var JONG_INDEX = buildIndexMap(JONG);

var VOWEL_COMBINE = {
  'ㅗㅏ': 'ㅘ',
  'ㅗㅐ': 'ㅙ',
  'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ',
  'ㅜㅔ': 'ㅞ',
  'ㅜㅣ': 'ㅟ',
  'ㅡㅣ': 'ㅢ'
};

var JONG_COMBINE = {
  'ㄱㅅ': 'ㄳ',
  'ㄴㅈ': 'ㄵ',
  'ㄴㅎ': 'ㄶ',
  'ㄹㄱ': 'ㄺ',
  'ㄹㅁ': 'ㄻ',
  'ㄹㅂ': 'ㄼ',
  'ㄹㅅ': 'ㄽ',
  'ㄹㅌ': 'ㄾ',
  'ㄹㅍ': 'ㄿ',
  'ㄹㅎ': 'ㅀ',
  'ㅂㅅ': 'ㅄ'
};

var JONG_SPLIT = {
  'ㄳ': ['ㄱ', 'ㅅ'],
  'ㄵ': ['ㄴ', 'ㅈ'],
  'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'],
  'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'],
  'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ']
};

function isCho(value) {
  return CHO_INDEX[value] !== undefined;
}

function isJung(value) {
  return JUNG_INDEX[value] !== undefined;
}

function isJong(value) {
  return JONG_INDEX[value] !== undefined && value !== '';
}

function composeSyllable(cho, jung, jong) {
  var choIndex = CHO_INDEX[cho];
  var jungIndex = JUNG_INDEX[jung];
  var jongIndex = jong ? JONG_INDEX[jong] : 0;
  if (choIndex === undefined || jungIndex === undefined || jongIndex === undefined) {
    return '';
  }
  var code = 0xAC00 + (choIndex * 21 + jungIndex) * 28 + jongIndex;
  return String.fromCharCode(code);
}

function composeCompatibilityJamo(value) {
  var result = '';
  var cho = '';
  var jung = '';
  var jong = '';

  for (var i = 0; i < value.length; i++) {
    var ch = value.charAt(i);
    var next = i + 1 < value.length ? value.charAt(i + 1) : '';

    if (isCho(ch)) {
      if (cho && jung) {
        if (jong) {
          result += composeSyllable(cho, jung, jong);
          cho = ch;
          jung = '';
          jong = '';
          continue;
        }
        if (isJung(next)) {
          result += composeSyllable(cho, jung, '');
          cho = ch;
          jung = '';
          jong = '';
          continue;
        }
        if (isJong(ch)) {
          jong = ch;
          continue;
        }
        result += composeSyllable(cho, jung, '');
        cho = ch;
        jung = '';
        jong = '';
        continue;
      }

      if (cho && !jung) {
        result += cho;
      }
      cho = ch;
      jung = '';
      jong = '';
      continue;
    }

    if (isJung(ch)) {
      if (!cho) {
        result += ch;
        continue;
      }
      if (!jung) {
        jung = ch;
        continue;
      }
      var combinedVowel = VOWEL_COMBINE[jung + ch];
      if (combinedVowel) {
        jung = combinedVowel;
        continue;
      }
      if (jong) {
        var split = JONG_SPLIT[jong];
        if (split) {
          result += composeSyllable(cho, jung, split[0]);
          cho = split[1];
          jung = ch;
          jong = '';
          continue;
        }
        result += composeSyllable(cho, jung, '');
        cho = jong;
        jung = ch;
        jong = '';
        continue;
      }
      result += composeSyllable(cho, jung, '');
      cho = '';
      jung = '';
      jong = '';
      result += ch;
      continue;
    }

    if (cho && jung) {
      result += composeSyllable(cho, jung, jong);
    } else if (cho) {
      result += cho;
    }
    cho = '';
    jung = '';
    jong = '';
    result += ch;
  }

  if (cho && jung) {
    result += composeSyllable(cho, jung, jong);
  } else if (cho) {
    result += cho;
  }
  return result;
}

function normalizeKoreanName(value) {
  if (typeof value !== 'string') return value;
  var nfc = value.normalize('NFC');
  return composeCompatibilityJamo(nfc);
}

function needsNormalize(value) {
  if (typeof value !== 'string') return false;
  return normalizeKoreanName(value) !== value;
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
      kind: msg.kind || 'upload',
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

chrome.downloads.onDeterminingFilename.addListener(function (item, suggest) {
  if (!item || !needsNormalize(item.filename)) return;

  var normalized = normalizeKoreanName(item.filename);
  suggest({ filename: normalized, conflictAction: 'uniquify' });

  (async function () {
    var state = await loadState();
    if (!state.enabled) return;

    state.count++;
    state.log.push({
      kind: 'download',
      original: item.filename,
      normalized: normalized,
      time: new Date().toLocaleTimeString('ko-KR'),
      url: item.finalUrl || item.url || '',
      site: getHostFromUrl(item.finalUrl || item.url || '')
    });

    if (state.log.length > 50) {
      state.log = state.log.slice(-50);
    }

    await saveState(state);
    updateBadge(state.count);
  })();
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
