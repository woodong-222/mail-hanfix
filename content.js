(function () {
  'use strict';

  var MSG_TYPE = 'koreatech-hanfix';
  var enabled = true;

  // bridge.js가 storage 상태 전달
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== MSG_TYPE) return;
    if (event.data.action === 'set-enabled') {
      enabled = !!event.data.enabled;
    }
  });

  function needsNFC(str) {
    return str !== str.normalize('NFC');
  }

  function isFileLike(value) {
    return !!value
      && typeof value === 'object'
      && typeof value.name === 'string'
      && typeof value.size === 'number'
      && typeof value.type === 'string';
  }

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

  function normalizeString(value) {
    if (typeof value !== 'string') return value;
    if (!needsNFC(value)) return value;
    return value.normalize('NFC');
  }

  function normalizeFilename(value) {
    if (typeof value !== 'string') return value;
    if (!needsNFC(value)) return value;
    var nfc = value.normalize('NFC');
    notify(value, nfc);
    return nfc;
  }

  function normalizeMultipartParams(params) {
    if (!params) return;
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (typeof value === 'string' && needsNFC(value)) {
        params[key] = value.normalize('NFC');
      }
    });
  }

  function hookPlupload() {
    if (pluploadHooked) return;
    if (!window.plupload || !window.plupload.Uploader) return;

    pluploadHooked = true;
    var origAddFile = window.plupload.Uploader.prototype.addFile;
    if (typeof origAddFile === 'function') {
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
