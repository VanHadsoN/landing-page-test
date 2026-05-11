function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function initSmoothAnchors() {
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      history.pushState(null, "", href);
    });
  });
}

function initTicker() {
  const tracks = document.querySelectorAll("[data-ticker]");
  if (tracks.length === 0) return;

  const rebuilders = [];

  tracks.forEach((track) => {
    const baseItems = Array.from(track.children);
    if (baseItems.length === 0) return;

    function rebuild() {
      track.innerHTML = "";
      baseItems.forEach((n) => track.appendChild(n.cloneNode(true)));

      const minWidth = window.innerWidth * 2.2;
      let safety = 0;
      while (track.scrollWidth < minWidth && safety < 12) {
        baseItems.forEach((n) => track.appendChild(n.cloneNode(true)));
        safety += 1;
      }

      const temp = document.createElement("div");
      temp.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;display:flex;gap:14px;padding:16px 0;";
      baseItems.forEach((n) => temp.appendChild(n.cloneNode(true)));
      document.body.appendChild(temp);
      const baseWidth = temp.scrollWidth || track.scrollWidth / 2;
      document.body.removeChild(temp);

      track.style.setProperty("--ticker-shift", `${baseWidth}px`);

      const pxPerSec = 110;
      const duration = Math.max(10, Math.round(baseWidth / pxPerSec));
      track.style.setProperty("--ticker-duration", `${duration}s`);
    }

    rebuilders.push(rebuild);
  });

  function rebuildAll() {
    rebuilders.forEach((fn) => fn());
  }

  rebuildAll();
  window.addEventListener("resize", debounce(rebuildAll, 150), { passive: true });
}

function initRevealOnScroll() {
  const nodes = document.querySelectorAll(".animate-on-scroll");
  if (nodes.length === 0) return;

  if (prefersReducedMotion()) {
    nodes.forEach((n) => n.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { root: null, threshold: 0.15 }
  );

  nodes.forEach((n) => io.observe(n));
}

function initStagesSlider() {
  const root = document.querySelector("[data-stages]");
  if (!root) return;

  const track = root.querySelector("[data-stages-track]");
  const prev = root.querySelector("[data-stages-prev]");
  const next = root.querySelector("[data-stages-next]");
  const dotsWrap = root.querySelector("[data-stages-dots]");

  if (!track || !prev || !next || !dotsWrap) return;

  let index = 0;

  function isMobile() {
    return window.matchMedia?.("(max-width: 900px)")?.matches ?? window.innerWidth <= 900;
  }

  function isCompactMobile() {
    return window.matchMedia?.("(max-width: 520px)")?.matches ?? window.innerWidth <= 520;
  }

  function getSlidesCount() {
    if (isCompactMobile()) return track.children.length;
    if (isMobile()) return track.querySelectorAll(".stage").length;
    return track.children.length;
  }

  function getMaxIndex() {
    return Math.max(0, getSlidesCount() - 1);
  }

  function renderDots() {
    dotsWrap.innerHTML = "";
    const count = getSlidesCount();
    for (let i = 0; i < count; i += 1) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot";
      b.setAttribute("aria-label", `Слайд ${i + 1}`);
      b.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(b);
    }
  }

  function updateUI() {
    if (!isMobile()) {
      track.style.transform = "";
      return;
    }

    const max = getMaxIndex();
    index = clamp(index, 0, max);
    track.style.transform = `translate3d(${-index * 100}%, 0, 0)`;

    prev.disabled = index <= 0;
    next.disabled = index >= max;

    const dots = dotsWrap.querySelectorAll(".dot");
    dots.forEach((d, i) => d.setAttribute("aria-current", i === index ? "true" : "false"));
  }

  function goTo(i) {
    index = i;
    updateUI();
  }

  prev.addEventListener("click", () => goTo(index - 1));
  next.addEventListener("click", () => goTo(index + 1));

  renderDots();
  updateUI();
  window.addEventListener(
    "resize",
    debounce(() => {
      renderDots();
      updateUI();
    }, 120),
    { passive: true }
  );
}

function initParticipantsCarousel() {
  const track = document.querySelector("[data-participants-track]");
  if (!track) return;

  const btnPrev = document.querySelector("[data-participants-prev]");
  const btnNext = document.querySelector("[data-participants-next]");
  const elCurrent = document.querySelector("[data-participants-current]");
  const elTotal = document.querySelector("[data-participants-total]");

  const original = Array.from(track.children);
  const total = original.length;
  if (total === 0) return;

  if (elTotal) elTotal.textContent = String(total);

  function slidesPerView() {
    if (window.matchMedia?.("(max-width: 640px)")?.matches) return 1;
    if (window.matchMedia?.("(max-width: 1020px)")?.matches) return 2;
    return 3;
  }

  let spv = slidesPerView();
  let index = spv;
  let isAnimating = false;
  let timer = null;

  function setupClones() {
    spv = slidesPerView();
    track.innerHTML = "";

    const head = original.slice(-spv).map((n) => n.cloneNode(true));
    const tail = original.slice(0, spv).map((n) => n.cloneNode(true));

    head.forEach((n) => {
      n.setAttribute("data-clone", "true");
      track.appendChild(n);
    });
    original.forEach((n) => track.appendChild(n.cloneNode(true)));
    tail.forEach((n) => {
      n.setAttribute("data-clone", "true");
      track.appendChild(n);
    });

    index = spv;
    jumpTo(index);
    updateCounter();
  }

  function slideWidth() {
    const first = track.children[0];
    if (!first) return 0;
    const rect = first.getBoundingClientRect();
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap || "0") || 0;
    return rect.width + gap;
  }

  function jumpTo(i) {
    track.style.transition = "none";
    track.style.transform = `translate3d(${-i * slideWidth()}px, 0, 0)`;
    track.getBoundingClientRect();
    track.style.transition = "";
  }

  function animateTo(i) {
    isAnimating = true;
    track.style.transform = `translate3d(${-i * slideWidth()}px, 0, 0)`;
  }

  function updateCounter() {
    const logical = ((index - spv) % total + total) % total;
    if (elCurrent) elCurrent.textContent = String(logical + 1);
  }

  function normalizeAfterTransition() {
    const maxIndex = spv + total - 1;
    if (index > maxIndex) {
      index = spv;
      jumpTo(index);
    } else if (index < spv) {
      index = spv + total - 1;
      jumpTo(index);
    }
    updateCounter();
    isAnimating = false;
  }

  function next() {
    if (isAnimating) return;
    index += 1;
    animateTo(index);
    updateCounter();
  }

  function prev() {
    if (isAnimating) return;
    index -= 1;
    animateTo(index);
    updateCounter();
  }

  function startAuto() {
    stopAuto();
    if (prefersReducedMotion()) return;
    timer = window.setInterval(() => next(), 4000);
  }

  function stopAuto() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  track.addEventListener("transitionend", () => normalizeAfterTransition());

  btnNext?.addEventListener("click", () => {
    stopAuto();
    next();
    startAuto();
  });
  btnPrev?.addEventListener("click", () => {
    stopAuto();
    prev();
    startAuto();
  });

  const root = document.querySelector("[data-participants]");
  root?.addEventListener("mouseenter", stopAuto);
  root?.addEventListener("mouseleave", startAuto);
  root?.addEventListener("focusin", stopAuto);
  root?.addEventListener("focusout", startAuto);

  window.addEventListener(
    "resize",
    debounce(() => {
      setupClones();
    }, 160),
    { passive: true }
  );

  setupClones();
  startAuto();
}

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  initSmoothAnchors();
  initTicker();
  initRevealOnScroll();
  initStagesSlider();
  initParticipantsCarousel();
});

