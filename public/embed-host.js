(function () {
  var MOBILE_MAX = 767;
  var MOBILE_CHAT = 392;
  var DESKTOP_CHAT = 288;
  var MOBILE_DVH = 0.58;
  var DESKTOP_DVH = 0.45;
  var HEIGHT_BUFFER = 16;

  function isMobileHost() {
    return (
      window.matchMedia('(max-width: ' + MOBILE_MAX + 'px), (hover: none) and (pointer: coarse)').matches ||
      Math.min(window.screen.width, window.screen.height) <= 520
    );
  }

  function breakoutBuilderShell(wrapper, frame) {
    if (!wrapper || !frame || !isMobileHost()) return;
    var node = wrapper.parentElement;
    var viewport = window.innerWidth || document.documentElement.clientWidth || 0;

    for (var depth = 0; depth < 10 && node && node !== document.body; depth++) {
      var rect = node.getBoundingClientRect();
      var style = window.getComputedStyle(node);
      var fixedWidth = rect.width > 0 && rect.width < viewport - 24;
      var fixedHeight = rect.height > 0 && rect.height < viewport * 0.45;
      var positioned = style.position === 'absolute' || style.position === 'fixed';

      if (fixedWidth || fixedHeight || positioned) {
        node.style.width = '100%';
        node.style.maxWidth = '100%';
        node.style.minWidth = '0';
        node.style.height = 'auto';
        node.style.minHeight = '0';
        node.style.maxHeight = 'none';
        node.style.left = '0';
        node.style.right = '0';
        node.style.overflow = 'visible';
      }
      node = node.parentElement;
    }

    wrapper.style.width = '100%';
    wrapper.style.maxWidth = '100%';
    wrapper.style.minWidth = '0';
    wrapper.style.height = 'auto';
    frame.style.width = '100%';
    frame.style.maxWidth = '100%';
    frame.style.minWidth = '100%';
  }

  function applyMobileFullBleed(wrapper, frame) {
    if (!isMobileHost()) return;
    wrapper.style.width = '100vw';
    wrapper.style.maxWidth = '100vw';
    wrapper.style.marginLeft = 'calc(50% - 50vw)';
    wrapper.style.marginRight = 'calc(50% - 50vw)';
    wrapper.style.padding = '0';
    wrapper.style.boxSizing = 'border-box';
    frame.style.width = '100%';
    frame.style.maxWidth = '100%';
    frame.style.minWidth = '100%';
    frame.style.borderRadius = '0';
  }

  function estimateVideoHeight(frame) {
    var width = frame.getBoundingClientRect().width || frame.offsetWidth || 0;
    if (!width) return 0;
    return Math.ceil((width * 9) / 16);
  }

  function applyCollapsed(frame, height) {
    var next = height > 0 ? Math.ceil(height) : estimateVideoHeight(frame);
    frame.style.width = '100%';
    frame.style.maxWidth = '100%';
    frame.style.minHeight = '0';
    frame.style.maxHeight = 'none';
    if (next > 0) {
      frame.style.height = next + 'px';
      frame.style.aspectRatio = 'auto';
      return next;
    }
    frame.style.height = '';
    frame.style.aspectRatio = '16/9';
    return 0;
  }

  function estimateExpandedHeight(frame) {
    var width = frame.getBoundingClientRect().width || frame.offsetWidth || 0;
    if (!width) return 0;
    var videoHeight = Math.ceil((width * 9) / 16);
    var chatHeight = isMobileHost()
      ? Math.min(MOBILE_CHAT, Math.ceil(window.innerHeight * MOBILE_DVH))
      : Math.min(DESKTOP_CHAT, Math.ceil(window.innerHeight * DESKTOP_DVH));
    return videoHeight + chatHeight + HEIGHT_BUFFER;
  }

  function init(frameId) {
    var frame = document.getElementById(frameId);
    if (!frame) return;
    var wrapper = frame.closest('.simple-streamz-embed') || frame.parentElement;
    var chatExpanded = false;
    var lastAppliedKey = '';
    var resizeTimer = null;

    function applyFrameState(collapsed, height) {
      var appliedHeight = collapsed
        ? Math.ceil(height > 0 ? height : estimateVideoHeight(frame))
        : Math.ceil(height);
      var key = collapsed ? 'collapsed:' + appliedHeight : 'open:' + appliedHeight;
      if (!appliedHeight || key === lastAppliedKey) return;
      lastAppliedKey = key;

      if (collapsed) {
        chatExpanded = false;
        applyCollapsed(frame, appliedHeight);
        return;
      }

      chatExpanded = true;
      frame.style.width = '100%';
      frame.style.maxWidth = '100%';
      frame.style.height = appliedHeight + 'px';
      frame.style.aspectRatio = 'auto';
      frame.style.maxHeight = 'none';
      frame.style.minHeight = '0';
    }

    breakoutBuilderShell(wrapper, frame);
    applyMobileFullBleed(wrapper, frame);
    applyCollapsed(frame, 0);
    lastAppliedKey = 'collapsed:0';

    function handleResizeMessage(e) {
      if (!e.data || e.data.type !== 'simple-streamz:resize') return;
      if (frame.contentWindow !== e.source) return;
      e.stopImmediatePropagation();

      if (e.data.collapsed) {
        applyFrameState(true, e.data.height || 0);
        return;
      }
      if (!e.data.height) return;
      applyFrameState(false, e.data.height);
    }

    // Capture phase runs before legacy inline embed scripts still on some host pages.
    window.addEventListener('message', handleResizeMessage, true);

    function onOrientationChange() {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        resizeTimer = null;
        lastAppliedKey = '';
        breakoutBuilderShell(wrapper, frame);
        applyMobileFullBleed(wrapper, frame);
        if (chatExpanded) {
          var nextHeight = estimateExpandedHeight(frame);
          if (nextHeight > 0) applyFrameState(false, nextHeight);
        } else {
          applyFrameState(true, 0);
        }
        try {
          frame.contentWindow.postMessage({ type: 'simple-streamz:remeasure' }, '*');
        } catch (err) {
          // ignore
        }
      }, 200);
    }

    window.addEventListener('orientationchange', onOrientationChange);
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', onOrientationChange);
    }
  }

  var script = document.currentScript;
  var frameId = script && script.getAttribute('data-frame');
  if (frameId) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        init(frameId);
      });
    } else {
      init(frameId);
    }
  }
})();