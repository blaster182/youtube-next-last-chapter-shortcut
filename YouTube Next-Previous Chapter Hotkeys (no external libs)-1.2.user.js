// ==UserScript==
// @name         YouTube Next/Previous Chapter Hotkeys (no external libs)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Press "n" for next chapter and "p" for previous chapter. Works without jQuery and avoids CSP blocks.
// @author       rustiX + ChatGPT
// @match        https://www.youtube.com/watch*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const TIMESTAMP_REGEX = /^\d{1,2}:\d{2}(?::\d{2})?$/;

  // Use capture so our handler runs before page handlers
  window.addEventListener("keydown", onKeydown, true);

  function onKeydown(e) {
    // ignore combos and typing in inputs
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;

    if (e.key === "n") {
      if (handleChapter("next")) { e.preventDefault(); e.stopPropagation(); }
    } else if (e.key === "p") {
      if (handleChapter("prev")) { e.preventDefault(); e.stopPropagation(); }
    }
  }

  function handleChapter(direction) {
    const items = collectTimestampLinks();
    if (!items.length) return false;

    const video = document.querySelector("video");
    const currentSeconds = video ? Math.floor(video.currentTime) : getSecondsFromUI();

    if (direction === "next") {
      for (const item of items) {
        if (item.secs > currentSeconds) {
          if (video) { video.currentTime = item.secs + 0.01; video.play(); }
          else { safeNavigateTo(item); }
          return true;
        }
      }
      return false;
    } else { // prev
      let prev = null;
      for (const item of items) {
        if (item.secs >= currentSeconds) break;
        prev = item;
      }
      if (prev) {
        if (video) { video.currentTime = prev.secs + 0.01; video.play(); }
        else { safeNavigateTo(prev); }
        return true;
      }
      return false;
    }
  }

  function collectTimestampLinks() {
    // Likely containers to look into (reduces scanning cost)
    const containers = [
      "#description",
      "ytd-watch-metadata",
      "ytd-video-secondary-info-renderer",
      "ytd-expander",
      "ytd-comments"
    ];

    const anchors = new Set();
    for (const sel of containers) {
      const node = document.querySelector(sel);
      if (node) node.querySelectorAll("a").forEach(a => anchors.add(a));
    }

    // fallback: if none found yet, scan all anchors once
    if (anchors.size === 0) document.querySelectorAll("a").forEach(a => anchors.add(a));

    const list = [];
    anchors.forEach(a => {
      const txt = (a.textContent || "").trim();
      if (!TIMESTAMP_REGEX.test(txt)) return;
      const secs = parseTimestampToSeconds(txt);
      if (Number.isFinite(secs)) list.push({ text: txt, secs, href: a.href, node: a });
    });

    // sort ascending, remove duplicates by seconds
    const uniq = Array.from(list).sort((a, b) => a.secs - b.secs)
      .filter((v, i, arr) => (i === 0 || v.secs !== arr[i - 1].secs));
    return uniq;
  }

  function parseTimestampToSeconds(txt) {
    const parts = txt.split(":").map(p => parseInt(p, 10));
    if (parts.some(isNaN)) return NaN;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
  }

  function getSecondsFromUI() {
    const span = document.querySelector(".ytp-time-current");
    if (!span) return 0;
    return parseTimestampToSeconds(span.textContent.trim()) || 0;
  }

  function safeNavigateTo(item) {
    try {
      if (item.node && typeof item.node.click === "function") {
        item.node.click();
        return;
      }
      location.href = item.href;
    } catch (err) {
      location.href = item.href;
    }
  }

})();
