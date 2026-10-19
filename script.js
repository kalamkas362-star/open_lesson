(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const screens = $$(".screen");
  const navItems = $$(".nav-item");
  let current = 0;
  let pointerDrag = null;
  function showScreen(index, updateHistory = true, resetScroll = true) {
    if (pointerDrag) finishPointerDrag(false);
    current = Math.max(0, Math.min(screens.length - 1, index));
    screens.forEach((screen, i) => {
      const active = i === current;
      screen.hidden = !active;
      screen.classList.toggle("show", active);
    });
    navItems.forEach((button, i) => {
      button.classList.toggle("active", i === current);
      if (i === current) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    $("#progress").style.width = ((current + 1) / screens.length * 100) + "%";
    $("#footer-page").textContent = String(current + 1).padStart(2, "0");
    $("#step-num").textContent = String(current + 1).padStart(2, "0");
    $("#prev").disabled = current === 0;
    $("#next").disabled = current === screens.length - 1;
    const hash = "#screen-" + (current + 1);
    if (updateHistory && window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
    if (resetScroll) {
      const nav = $(".nav");
      const inset = getComputedStyle(nav).position === "sticky" ? nav.getBoundingClientRect().height : 0;
      window.scrollTo({top: Math.max(0, $("main").getBoundingClientRect().top + window.scrollY - inset - 12), behavior: "instant"});
    }
  }
  navItems.forEach(button => button.addEventListener("click", () => showScreen(Number(button.dataset.go))));
  $("#prev").addEventListener("click", () => showScreen(current - 1));
  $("#next").addEventListener("click", () => showScreen(current + 1));
  function screenFromHash() {
    const match = window.location.hash.match(/^#screen-(\d+)$/);
    const index = match ? Number(match[1]) - 1 : 0;
    return index >= 0 && index < screens.length ? index : 0;
  }
  window.addEventListener("hashchange", () => showScreen(screenFromHash(), false));
  $(".brand").addEventListener("click", event => {
    event.preventDefault();
    showScreen(0);
  });
  showScreen(screenFromHash(), false, false);
  if (window.location.hash !== "#screen-" + (current + 1)) {
    window.history.replaceState(null, "", "#screen-" + (current + 1));
  }

  $$(".flip-card").forEach(card => {
    card.addEventListener("click", () => {
      const flipped = card.classList.toggle("flipped");
      card.setAttribute("aria-pressed", String(flipped));
    });
  });

  const matchResult = $("#match-result");
  const cardBank = $("#card-bank");
  const dragCards = $$(".drag-card");
  let selectedCard = null;
  let nativeDragCard = null;
  let suppressClickUntil = 0;

  function clearSelected() {
    dragCards.forEach(card => {
      card.classList.remove("is-selected");
      card.setAttribute("aria-pressed", "false");
    });
    selectedCard = null;
  }
  function clearDragHover() {
    $$(".drag-hover").forEach(target => target.classList.remove("drag-hover"));
  }
  function placeCard(card, target) {
    if (!card || !target) return;
    if (target !== cardBank) {
      const existing = $(".drag-card", target);
      if (existing && existing !== card) cardBank.appendChild(existing);
    }
    target.appendChild(card);
    clearSelected();
    $$(".stage").forEach(stage => stage.classList.remove("correct", "incorrect"));
    matchResult.textContent = "Барлық карточканы орналастыр да, тексер.";
    matchResult.style.color = "";
  }
  function selectCard(card) {
    clearSelected();
    selectedCard = card;
    card.classList.add("is-selected");
    card.setAttribute("aria-pressed", "true");
  }
  function chooseCard(card) {
    if (selectedCard === card) {
      clearSelected();
      return;
    }
    selectCard(card);
    showToast("Енді сипаттама қоятын ұяшықты таңда.");
  }

  // Mouse users retain native HTML drag and drop. A tap or Enter/Space selects a card.
  document.addEventListener("dragstart", event => {
    const card = event.target.closest?.(".drag-card");
    if (!card) return;
    if (pointerDrag) {
      event.preventDefault();
      return;
    }
    nativeDragCard = card;
    selectCard(card);
    card.classList.add("is-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", card.dataset.letter);
      event.dataTransfer.effectAllowed = "move";
    }
  });
  document.addEventListener("dragend", () => {
    clearDragHover();
    dragCards.forEach(card => card.classList.remove("is-dragging"));
    if (nativeDragCard) suppressClickUntil = Date.now() + 500;
    nativeDragCard = null;
    clearSelected();
  });

  const dropTargets = [...$$(".drop-slot"), cardBank];
  dropTargets.forEach(target => {
    target.addEventListener("dragover", event => {
      if (!nativeDragCard) return;
      event.preventDefault();
      clearDragHover();
      target.classList.add("drag-hover");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    target.addEventListener("dragleave", event => {
      if (!target.contains(event.relatedTarget)) target.classList.remove("drag-hover");
    });
    target.addEventListener("drop", event => {
      if (!nativeDragCard) return;
      event.preventDefault();
      clearDragHover();
      placeCard(nativeDragCard, target);
    });
    target.addEventListener("click", event => {
      if (event.target.closest(".drag-card")) return;
      if (selectedCard) placeCard(selectedCard, target);
    });
    target.addEventListener("keydown", event => {
      if (event.target.closest(".drag-card")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (selectedCard) placeCard(selectedCard, target);
      }
    });
  });
  cardBank.tabIndex = 0;
  cardBank.setAttribute("role", "group");
  cardBank.setAttribute("aria-label", "Сипаттамалар банкі. Таңдалған карточканы қайтару үшін Enter пернесін бас.");

  // Only the badge reserves touch movement for dragging; card text still scrolls the page.
  dragCards.forEach(card => {
    card.setAttribute("aria-pressed", "false");
    const handle = card.firstElementChild;
    if (!handle) return;
    handle.classList.add("drag-handle");
    handle.title = "Сүйреп апару үшін әріптен ұстап жылжыт";
    handle.addEventListener("pointerdown", event => {
      if (!["touch", "pen"].includes(event.pointerType) || !event.isPrimary || pointerDrag) return;
      pointerDrag = {
        card, handle, pointerId: event.pointerId,
        startX: event.clientX, startY: event.clientY,
        x: event.clientX, y: event.clientY,
        started: false, preview: null, target: null, frame: 0, lastTime: 0
      };
      handle.setPointerCapture(event.pointerId);
    });
  });

  function targetAtPoint(x, y) {
    return document.elementFromPoint(x, y)?.closest(".drop-slot, #card-bank") || null;
  }
  function updatePointerPreview(state) {
    if (!state.preview) return;
    const rect = state.preview.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, state.x - rect.width / 2));
    const above = state.y - Math.min(rect.height, 120) - 24;
    state.preview.style.left = left + "px";
    state.preview.style.top = Math.max(8, above) + "px";
    const target = targetAtPoint(state.x, state.y);
    if (target !== state.target) {
      clearDragHover();
      state.target = target;
      target?.classList.add("drag-hover");
    }
  }
  function edgeSpeed(point, start, end) {
    const edge = Math.min(65, (end - start) / 3);
    if (point < start + edge) return -Math.min(18, (start + edge - point) * 0.35);
    if (point > end - edge) return Math.min(18, (point - end + edge) * 0.35);
    return 0;
  }
  function autoScroll(state, factor) {
    let scrolledX = false;
    let scrolledY = false;
    let element = document.elementFromPoint(state.x, state.y);
    while (element && element !== document.body && element !== document.documentElement) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const previousX = element.scrollLeft;
      const previousY = element.scrollTop;
      if (!scrolledX && element.scrollWidth > element.clientWidth && /auto|scroll/.test(style.overflowX)) {
        element.scrollLeft += edgeSpeed(state.x, Math.max(0, rect.left), Math.min(innerWidth, rect.right)) * factor;
      }
      if (!scrolledY && element.scrollHeight > element.clientHeight && /auto|scroll/.test(style.overflowY)) {
        element.scrollTop += edgeSpeed(state.y, Math.max(0, rect.top), Math.min(innerHeight, rect.bottom)) * factor;
      }
      scrolledX ||= element.scrollLeft !== previousX;
      scrolledY ||= element.scrollTop !== previousY;
      element = element.parentElement;
    }
    const navRect = $(".nav").getBoundingClientRect();
    const top = navRect.top >= 0 && navRect.top < 100 ? navRect.bottom : 0;
    const bottom = $(".bottom").getBoundingClientRect().top;
    window.scrollBy({
      left: scrolledX ? 0 : edgeSpeed(state.x, 0, innerWidth) * factor,
      top: scrolledY ? 0 : edgeSpeed(state.y, top, bottom) * factor,
      behavior: "instant"
    });
  }
  function pointerDragFrame(time) {
    const state = pointerDrag;
    if (!state?.started) return;
    const factor = state.lastTime ? Math.min(2, (time - state.lastTime) / 16.67) : 1;
    state.lastTime = time;
    autoScroll(state, factor);
    updatePointerPreview(state);
    state.frame = requestAnimationFrame(pointerDragFrame);
  }
  function beginPointerDrag(state) {
    state.started = true;
    selectCard(state.card);
    const width = Math.min(state.card.getBoundingClientRect().width, 300, innerWidth - 24);
    state.preview = state.card.cloneNode(true);
    state.preview.removeAttribute("id");
    state.preview.removeAttribute("draggable");
    state.preview.removeAttribute("aria-pressed");
    state.preview.setAttribute("aria-hidden", "true");
    state.preview.tabIndex = -1;
    state.preview.inert = true;
    state.preview.classList.remove("is-selected", "is-dragging");
    state.preview.classList.add("drag-preview");
    state.preview.style.width = width + "px";
    document.body.appendChild(state.preview);
    state.card.classList.add("is-dragging");
    document.body.classList.add("is-card-dragging");
    updatePointerPreview(state);
    state.frame = requestAnimationFrame(pointerDragFrame);
  }
  function finishPointerDrag(drop) {
    const state = pointerDrag;
    if (!state) return;
    const target = drop && state.started ? targetAtPoint(state.x, state.y) : null;
    pointerDrag = null;
    cancelAnimationFrame(state.frame);
    state.preview?.remove();
    state.card.classList.remove("is-dragging");
    document.body.classList.remove("is-card-dragging");
    clearDragHover();
    if (state.handle.hasPointerCapture(state.pointerId)) state.handle.releasePointerCapture(state.pointerId);
    if (state.started) {
      suppressClickUntil = Date.now() + 600;
      if (target) placeCard(state.card, target);
      else clearSelected();
    }
  }
  document.addEventListener("pointermove", event => {
    const state = pointerDrag;
    if (!state || state.pointerId !== event.pointerId) return;
    state.x = event.clientX;
    state.y = event.clientY;
    if (!state.started && Math.hypot(state.x - state.startX, state.y - state.startY) >= 7) beginPointerDrag(state);
    if (state.started) {
      event.preventDefault();
      updatePointerPreview(state);
    }
  }, {passive: false});
  document.addEventListener("pointerup", event => {
    if (pointerDrag?.pointerId !== event.pointerId) return;
    pointerDrag.x = event.clientX;
    pointerDrag.y = event.clientY;
    if (pointerDrag.started) event.preventDefault();
    finishPointerDrag(true);
  });
  document.addEventListener("pointercancel", event => {
    if (pointerDrag?.pointerId === event.pointerId) finishPointerDrag(false);
  });
  document.addEventListener("lostpointercapture", event => {
    if (pointerDrag?.pointerId === event.pointerId) finishPointerDrag(false);
  });
  window.addEventListener("blur", () => finishPointerDrag(false));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finishPointerDrag(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      finishPointerDrag(false);
      clearSelected();
    }
  });
  // A new gesture is intentional; only the compatibility click from the finished drag is ignored.
  document.addEventListener("pointerdown", () => { suppressClickUntil = 0; }, true);
  // A completed touch/native drag must not select the card again through its generated click.
  document.addEventListener("click", event => {
    if (Date.now() < suppressClickUntil && event.detail > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
    }
  }, true);
  document.addEventListener("click", event => {
    const card = event.target.closest(".drag-card:not(.drag-preview)");
    if (!card) return;
    event.preventDefault();
    chooseCard(card);
  });

  $("#check-match").addEventListener("click", () => {
    let score = 0;
    let allFilled = true;
    $$(".stage").forEach(stage => {
      const slots = $$(".drop-slot", stage);
      const values = slots.map(slot => $(".drag-card", slot)?.dataset.letter || "");
      if (values.some(value => !value)) allFilled = false;
      const correct = values.every(Boolean) &&
        values.slice().sort().join(",") === stage.dataset.answer.split(",").sort().join(",");
      stage.classList.remove("correct", "incorrect");
      if (values.every(Boolean)) {
        stage.classList.add(correct ? "correct" : "incorrect");
        if (correct) score += 1;
      }
    });
    matchResult.textContent = allFilled
      ? `Нәтиже: ${score}/3 балл`
      : `Барлық ұяшықты толтыр. Қазіргі нәтиже: ${score}/3 балл`;
    matchResult.style.color = allFilled && score === 3 ? "#16816f" : "var(--ink)";
    showToast(allFilled ? `Тексеру аяқталды: ${score}/3 балл` : "Әр кезеңнің екі ұяшығына да сипаттама орналастыр.");
  });

  $("#reset-match").addEventListener("click", () => {
    finishPointerDrag(false);
    $$(".drag-card").sort((a, b) => a.dataset.letter.localeCompare(b.dataset.letter))
      .forEach(card => cardBank.appendChild(card));
    $$(".stage").forEach(stage => stage.classList.remove("correct", "incorrect"));
    $$(".drop-slot").forEach(slot => slot.classList.remove("drag-hover"));
    clearSelected();
    matchResult.textContent = "Ең жоғары ұпай: 3 балл";
    matchResult.style.color = "";
  });

  const letter = $("#letter");
  function updateWordCount() {
    const count = letter.value.trim() ? letter.value.trim().split(/\s+/u).length : 0;
    $("#word-count").textContent = count + " сөз";
  }
  letter.addEventListener("input", updateWordCount);
  try {
    const storedLetter = localStorage.getItem("openLesson2040Letter");
    if (storedLetter) { letter.value = storedLetter; updateWordCount(); }
    letter.addEventListener("input", () => {
      try { localStorage.setItem("openLesson2040Letter", letter.value); } catch (_) {}
    });
  } catch (_) {}
  $("#copy-letter").addEventListener("click", async () => {
    if (!letter.value.trim()) return showToast("Алдымен хатыңды жаз.");
    try {
      await navigator.clipboard.writeText(letter.value);
      showToast("Хат көшірілді.");
    } catch (_) {
      letter.focus(); letter.select();
      const ok = document.execCommand("copy");
      showToast(ok ? "Хат көшірілді." : "Хатты белгілеп, Ctrl+C пернелерін бас.");
    }
  });
  $("#save-letter").addEventListener("click", () => {
    if (!letter.value.trim()) return showToast("Сақтау үшін алдымен хат жаз.");
    const blob = new Blob([letter.value], {type: "text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "mening-kazakstanym-2040-hat.txt";
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
    showToast("Хат мәтіндік файл ретінде сақталды.");
  });

  const dialog = $("#qr-dialog");
  const qrUrlInput = $("#qr-url");
  const defaultQrUrl = "https://t.me/FEEDBACKBERMAGANBET_BOT";
  const originalQrImage = $("#qrcode img")?.cloneNode(true);
  let activeQrUrl = defaultQrUrl;
  function validFeedbackUrl(value) {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL");
    if (parsed.hostname.toLowerCase() === "t.me" &&
        parsed.pathname.replace(/\/$/, "").toLowerCase() === "/feedbackbermaganbet_bot" &&
        !parsed.search && !parsed.hash) return defaultQrUrl;
    return parsed.href;
  }
  try {
    const stored = localStorage.getItem("openLessonFeedbackUrl");
    if (stored) {
      const parsed = new URL(validFeedbackUrl(stored));
      // Earlier previews sometimes saved only Telegram's homepage, which cannot receive feedback.
      activeQrUrl = parsed.hostname === "t.me" && /^\/?$/.test(parsed.pathname)
        ? defaultQrUrl : parsed.href;
      if (activeQrUrl === defaultQrUrl) localStorage.removeItem("openLessonFeedbackUrl");
    }
  } catch (_) {}
  function renderQr(url) {
    const holder = $("#qrcode");
    const feedbackLink = $("#feedback-link");
    const feedbackUsername = $("#feedback-username");
    if (feedbackLink) {
      feedbackLink.href = url;
      feedbackLink.textContent = url === defaultQrUrl ? "Telegram-ботты ашу ↗" : "Кері байланыс сілтемесін ашу ↗";
    }
    if (feedbackUsername) {
      feedbackUsername.textContent = url === defaultQrUrl
        ? "Telegram бот: @FEEDBACKBERMAGANBET_BOT" : new URL(url).host + new URL(url).pathname;
    }
    holder.replaceChildren();
    if (url === defaultQrUrl) {
      const image = originalQrImage?.cloneNode(true) || document.createElement("img");
      image.src = "assets/feedback-qr.png";
      image.alt = "@FEEDBACKBERMAGANBET_BOT Telegram-ботына арналған QR-код";
      holder.appendChild(image);
      return;
    }
    try {
      if (!window.QRCode) throw new Error("QR generator unavailable");
      new window.QRCode(holder, {
        text: url, width: 280, height: 280, colorDark: "#10233f", colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H
      });
    } catch (_) {
      holder.replaceChildren();
      const message = document.createElement("p");
      message.className = "qr-fallback";
      message.textContent = "Бұл сілтемеге QR-код жасалмады. Төмендегі сілтемені аш.";
      holder.appendChild(message);
    }
  }
  renderQr(activeQrUrl);
  $("#open-qr").addEventListener("click", () => {
    qrUrlInput.value = activeQrUrl;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else {
      const result = window.prompt("Кері байланыс сілтемесін енгізіңіз:", activeQrUrl);
      if (result) {
        try { updateQr(validFeedbackUrl(result.trim())); }
        catch (_) { showToast("Толық https:// немесе http:// сілтемесін енгізіңіз."); }
      }
    }
  });
  $("#cancel-qr").addEventListener("click", () => dialog.close());
  $("#reset-qr")?.addEventListener("click", () => {
    updateQr(defaultQrUrl);
    qrUrlInput.value = defaultQrUrl;
    dialog.close();
  });
  $("#qr-form").addEventListener("submit", event => {
    event.preventDefault();
    try {
      updateQr(validFeedbackUrl(qrUrlInput.value.trim()));
      dialog.close();
    } catch (_) {
      showToast("Толық https:// немесе http:// сілтемесін енгізіңіз.");
    }
  });
  function updateQr(url) {
    activeQrUrl = url;
    try {
      if (url === defaultQrUrl) localStorage.removeItem("openLessonFeedbackUrl");
      else localStorage.setItem("openLessonFeedbackUrl", url);
    } catch (_) {}
    renderQr(url);
    showToast(url === defaultQrUrl ? "Бастапқы QR-код қалпына келтірілді." : "Кері байланыс сілтемесі жаңартылды.");
  }

  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
  }

  // Basic keyboard navigation while not typing into a field.
  document.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const focused = document.activeElement;
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(focused?.tagName) ||
        focused?.isContentEditable || focused?.closest(".drop-slot, #card-bank, dialog[open]")) return;
    if (event.key === "ArrowRight") showScreen(current + 1);
    if (event.key === "ArrowLeft") showScreen(current - 1);
  });
})();
