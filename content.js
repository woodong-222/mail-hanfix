(function () {
  'use strict';

  // bridge.js가 storage 상태를 window.postMessage로 전달 → enabled 갱신
  // 업로드 경로별 훅킹(FormData/input/drop/plupload)에서 파일명 NFC 변환
  // 변환이 발생하면 notify()로 bridge.js에 알림

  var MSG_TYPE = 'mail-hanfix';
  var enabled = true;

  // bridge.js가 storage 상태 전달
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== MSG_TYPE) return;
    if (event.data.action === 'set-enabled') {
      enabled = !!event.data.enabled;
    }
  });

  // NFD 여부 판단 (NFC로 normalize 했을 때 값이 바뀌는지 확인)
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

  // File처럼 보이는지 판별 (FormData 훅에서 사용)
  function isFileLike(value) {
    return !!value
      && typeof value === 'object'
      && typeof value.name === 'string'
      && typeof value.size === 'number'
      && typeof value.type === 'string';
  }

  // 변환 이벤트 알림 (bridge.js가 받으면 background로 전달)
  function notify(original, normalized) {
    try {
      window.postMessage({
        type: MSG_TYPE,
        action: 'normalized',
        kind: 'upload',
        original: original,
        normalized: normalized
      }, '*');
    } catch (_) {}
  }

  // File 객체를 NFC 이름으로 재생성 (변환 시 notify 호출)
  function normalizeFile(file, explicitName) {
    var name = explicitName != null ? explicitName : file.name;
    var normalized = normalizeKoreanName(name);

    if (normalized === name) return null;

    notify(name, normalized);

    return new File([file], normalized, {
      type: file.type,
      lastModified: typeof file.lastModified === 'number' ? file.lastModified : Date.now()
    });
  }

  var pluploadHooked = false;

  // 문자열을 NFC로 정규화 (변환 필요 없으면 그대로 반환)
  function normalizeString(value) {
    if (typeof value !== 'string') return value;
    if (!needsNormalize(value)) return value;
    return normalizeKoreanName(value);
  }

  // 파일명 문자열을 NFC로 정규화 및 변환 알림
  function normalizeFilename(value) {
    if (typeof value !== 'string') return value;
    if (!needsNormalize(value)) return value;
    var normalized = normalizeKoreanName(value);
    notify(value, normalized);
    return normalized;
  }

  // plupload multipart_params 안의 문자열도 NFC로 교정
  function normalizeMultipartParams(params) {
    if (!params) return;
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (typeof value === 'string' && needsNormalize(value)) {
        params[key] = normalizeKoreanName(value);
      }
    });
  }

  // plupload를 쓰는 사이트 대응 (Uploader.prototype 후킹) ex) koreatech.ac.kr
  function hookPlupload() {
    if (pluploadHooked) return;
    if (!window.plupload || !window.plupload.Uploader) return;

    pluploadHooked = true;
    var origAddFile = window.plupload.Uploader.prototype.addFile;
    if (typeof origAddFile === 'function') {
      // addFile 시점에 파일명 보정
      window.plupload.Uploader.prototype.addFile = function (file, fileName) {
        var overrideName = fileName;
        if (enabled) {
          if (file && typeof file.name === 'string') {
            if (overrideName === undefined || overrideName === null) {
              overrideName = normalizeFilename(file.name);
            }
          }
          if (typeof overrideName === 'string') {
            overrideName = normalizeFilename(overrideName);
          }
        }
        return overrideName !== undefined && overrideName !== null
          ? origAddFile.call(this, file, overrideName)
          : origAddFile.call(this, file, fileName);
      };
    }

    var origInit = window.plupload.Uploader.prototype.init;
    // init 시점에 이벤트 바인딩 (FilesAdded / BeforeUpload)
    window.plupload.Uploader.prototype.init = function () {
      this.bind('FilesAdded', function (up, files) {
        if (!enabled) return;
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          if (file && typeof file.name === 'string') {
            file.name = normalizeFilename(file.name);
          }
        }
        normalizeMultipartParams(up.settings && up.settings.multipart_params);
      });

      this.bind('BeforeUpload', function (up, file) {
        if (!enabled) return;
        if (file && typeof file.name === 'string') {
          file.name = normalizeFilename(file.name);
        }
        normalizeMultipartParams(up.settings && up.settings.multipart_params);
      });

      return origInit.apply(this, arguments);
    };
  }

  (function watchPlupload() {
    // plupload가 늦게 로드되는 페이지 대응 (최대 200회 재시도)
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      hookPlupload();
      if (pluploadHooked || tries > 200) {
        clearInterval(timer);
      }
    }, 100);
  })();

  // -- FormData.prototype.append --
  // 페이지 코드가 FormData.append를 호출할 때 가로채서 파일명 보정
  var origAppend = FormData.prototype.append;
  FormData.prototype.append = function (name, value, filename) {
    if (enabled && isFileLike(value)) {
      var fixed = normalizeFile(value, filename);
      if (fixed) return origAppend.call(this, name, fixed);
    } else if (enabled && typeof value === 'string' && typeof filename === 'string' && needsNormalize(filename)) {
      var normalizedFilename = normalizeKoreanName(filename);
      notify(filename, normalizedFilename);
      return origAppend.call(this, name, value, normalizedFilename);
    }

    return filename !== undefined
      ? origAppend.call(this, name, value, filename)
      : origAppend.call(this, name, value);
  };

  // -- FormData.prototype.set --
  // append와 동일한 로직으로 파일명 보정
  var origSet = FormData.prototype.set;
  FormData.prototype.set = function (name, value, filename) {
    if (enabled && isFileLike(value)) {
      var fixed = normalizeFile(value, filename);
      if (fixed) return origSet.call(this, name, fixed);
    } else if (enabled && typeof value === 'string' && typeof filename === 'string' && needsNormalize(filename)) {
      var normalizedFilename = normalizeKoreanName(filename);
      notify(filename, normalizedFilename);
      return origSet.call(this, name, value, normalizedFilename);
    }

    return filename !== undefined
      ? origSet.call(this, name, value, filename)
      : origSet.call(this, name, value);
  };

  // input[type=file] 변경 감지 → FileList 재구성(DataTransfer)
  document.addEventListener('change', function (e) {
    if (!enabled) return;
    var input = e.target;
    if (!input || input.type !== 'file' || !input.files || !input.files.length) return;

    var needsFix = false;
    for (var i = 0; i < input.files.length; i++) {
      if (needsNormalize(input.files[i].name)) { needsFix = true; break; }
    }
    if (!needsFix) return;

    var dt = new DataTransfer();
    for (var i = 0; i < input.files.length; i++) {
      var f = input.files[i];
      var fixed = normalizeFile(f);
      dt.items.add(fixed || f);
    }
    input.files = dt.files;
  }, true);

  // 드래그&드롭 업로드 감지 → dataTransfer 재구성
  document.addEventListener('drop', function (e) {
    if (!enabled) return;
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;

    var needsFix = false;
    for (var i = 0; i < e.dataTransfer.files.length; i++) {
      if (needsNormalize(e.dataTransfer.files[i].name)) { needsFix = true; break; }
    }
    if (!needsFix) return;

    var dt = new DataTransfer();
    for (var i = 0; i < e.dataTransfer.files.length; i++) {
      var f = e.dataTransfer.files[i];
      var fixed = normalizeFile(f);
      dt.items.add(fixed || f);
    }

    Object.defineProperty(e, 'dataTransfer', {
      value: dt,
      writable: false
    });
  }, true);
})();
