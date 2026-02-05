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
  function needsNFC(str) {
    return str !== str.normalize('NFC');
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
        original: original,
        normalized: normalized
      }, '*');
    } catch (_) {}
  }

  // File 객체를 NFC 이름으로 재생성 (변환 시 notify 호출)
  function normalizeFile(file, explicitName) {
    var name = explicitName != null ? explicitName : file.name;
    var nfc = name.normalize('NFC');

    if (nfc === name) return null;

    notify(name, nfc);

    return new File([file], nfc, {
      type: file.type,
      lastModified: typeof file.lastModified === 'number' ? file.lastModified : Date.now()
    });
  }

  var pluploadHooked = false;

  // 문자열을 NFC로 정규화 (변환 필요 없으면 그대로 반환)
  function normalizeString(value) {
    if (typeof value !== 'string') return value;
    if (!needsNFC(value)) return value;
    return value.normalize('NFC');
  }

  // 파일명 문자열을 NFC로 정규화 및 변환 알림
  function normalizeFilename(value) {
    if (typeof value !== 'string') return value;
    if (!needsNFC(value)) return value;
    var nfc = value.normalize('NFC');
    notify(value, nfc);
    return nfc;
  }

  // plupload multipart_params 안의 문자열도 NFC로 교정
  function normalizeMultipartParams(params) {
    if (!params) return;
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (typeof value === 'string' && needsNFC(value)) {
        params[key] = value.normalize('NFC');
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
    } else if (enabled && typeof value === 'string' && typeof filename === 'string' && needsNFC(filename)) {
      notify(filename, filename.normalize('NFC'));
      return origAppend.call(this, name, value, filename.normalize('NFC'));
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
    } else if (enabled && typeof value === 'string' && typeof filename === 'string' && needsNFC(filename)) {
      notify(filename, filename.normalize('NFC'));
      return origSet.call(this, name, value, filename.normalize('NFC'));
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
      if (needsNFC(input.files[i].name)) { needsFix = true; break; }
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
      if (needsNFC(e.dataTransfer.files[i].name)) { needsFix = true; break; }
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
