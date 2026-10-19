(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const screens = $$(".screen");
  const navItems = $$(".nav-item");
  let current = 0;
  function showScreen(index) {
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
    window.location.hash = "screen-" + (current + 1);
  }
  navItems.forEach(button => button.addEventListener("click", () => showScreen(Number(button.dataset.go))));
  $("#prev").addEventListener("click", () => showScreen(current - 1));
  $("#next").addEventListener("click", () => showScreen(current + 1));
  const hashMatch = window.location.hash.match(/^#screen-([1-5])$/);
  showScreen(hashMatch ? Number(hashMatch[1]) - 1 : 0);

  $$(".flip-card").forEach(card => {
    card.addEventListener("click", () => {
      const flipped = card.classList.toggle("flipped");
      card.setAttribute("aria-pressed", String(flipped));
    });
  });

  const matchResult = $("#match-result");
  $("#check-match").addEventListener("click", () => {
    let score = 0;
    let complete = true;
    $$(".stage").forEach(stage => {
      const selects = $$("select", stage);
      const values = selects.map(select => select.value);
      if (values.some(value => !value)) complete = false;
      const correct = values.slice().sort().join(",") === stage.dataset.answer.split(",").sort().join(",");
      stage.classList.remove("correct", "incorrect");
      if (values.every(Boolean)) {
        stage.classList.add(correct ? "correct" : "incorrect");
        if (correct) score += 1;
      }
    });
    matchResult.textContent = complete
      ? `Нәтиже: ${score}/3 балл` 
      : `Әр кезеңнің екі сипаттамасын таңдаңыз. Қазіргі нәтиже: ${score}/3 балл`;
    matchResult.style.color = complete && score === 3 ? "#16816f" : "var(--ink)";
    showToast(complete ? `Тексеру аяқталды: ${score}/3 балл` : "Барлық кезең үшін екі жауаптан таңдаңыз.");
  });
  $("#reset-match").addEventListener("click", () => {
    $$(".stage").forEach(stage => {
      $$("select", stage).forEach(select => { select.value = ""; });
      stage.classList.remove("correct", "incorrect");
    });
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
  let activeQrUrl = "https://t.me/";
  try {
    activeQrUrl = localStorage.getItem("openLessonFeedbackUrl") || activeQrUrl;
  } catch (_) {}
  function renderQr(url) {
    const holder = $("#qrcode");
    holder.replaceChildren();
    if (window.QRCode) {
      try {
        new QRCode(holder, {text: url, width: 280, height: 280, colorDark: "#10233f", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H});
      } catch (_) {
        holder.textContent = url;
      }
    } else {
      const link = document.createElement("a");
      link.href = url; link.target = "_blank"; link.rel = "noopener";
      link.textContent = "QR кітапханасы жүктелмеді. Сілтемені ашу үшін басыңыз.";
      link.style.cssText = "font-size:12px;text-align:center;overflow-wrap:anywhere;padding:12px";
      holder.appendChild(link);
    }
  }
  // qrcodejs is loaded with defer; render on DOM ready and again shortly after.
  renderQr(activeQrUrl);
  window.addEventListener("load", () => renderQr(activeQrUrl), {once:true});
  $("#open-qr").addEventListener("click", () => {
    qrUrlInput.value = activeQrUrl;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else {
      const result = window.prompt("Кері байланыс сілтемесін енгізіңіз:", activeQrUrl);
      if (result) updateQr(result);
    }
  });
  $("#cancel-qr").addEventListener("click", () => dialog.close());
  $("#qr-form").addEventListener("submit", event => {
    event.preventDefault();
    const value = qrUrlInput.value.trim();
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL");
      updateQr(parsed.href);
      dialog.close();
    } catch (_) {
      showToast("Толық https:// немесе http:// сілтемесін енгізіңіз.");
    }
  });
  function updateQr(url) {
    activeQrUrl = url;
    try { localStorage.setItem("openLessonFeedbackUrl", url); } catch (_) {}
    renderQr(url);
    showToast("QR-код жаңа сілтемеге жаңартылды.");
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
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(document.activeElement?.tagName)) return;
    if (event.key === "ArrowRight") showScreen(current + 1);
    if (event.key === "ArrowLeft") showScreen(current - 1);
  });
})();
