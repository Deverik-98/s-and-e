(() => {
  const { config, i18n } = window.SE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    lang: localStorage.getItem("se-lang") || ((navigator.language || "es").startsWith("en") ? "en" : "es"),
    guest: null,
    code: new URLSearchParams(location.search).get(config.codeParam || "i") || "",
    opened: sessionStorage.getItem("se-opened") === "1",
    busy: false,
  };

  const t = (key, vars = {}) => {
    const table = i18n[state.lang] || i18n.es;
    return String(table[key] || i18n.es[key] || key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  };

  function applyLang() {
    document.documentElement.lang = state.lang;
    document.title = t("docTitle");
    $$("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    const greeting = $("#greeting");
    if (greeting) {
      greeting.textContent = state.guest?.name
        ? t("greetingFor", { name: state.guest.name })
        : t("greetingGeneric");
    }
    const chip = $("#guest-chip");
    if (chip) {
      if (state.guest?.name) {
        chip.textContent = `${t("forGuest")} ${state.guest.name}`;
        chip.classList.remove("is-hidden");
      } else {
        chip.classList.add("is-hidden");
      }
    }
    $("#lang-toggle").textContent = t("langSwitch");
    $("#lang-toggle").setAttribute("aria-label", t("langLabel"));
    renderRsvp();
    toggleDinner();
  }

  function toggleDinner() {
    const hideDinner = state.guest?.variant === "iglesia";
    $$("[data-dinner]").forEach((el) => el.classList.toggle("is-hidden", hideDinner));
  }

  function renderRsvp() {
    const status = $("#rsvp-status");
    const confirmBtn = $("#rsvp-confirm");
    const declineBtn = $("#rsvp-decline");
    const changeBtn = $("#rsvp-change");
    const hasCode = Boolean(state.code);
    const guestOk = Boolean(state.guest && state.guest.ok !== false);
    const canRespond = hasCode && guestOk;
    const value = state.guest?.status || "pending";

    confirmBtn.classList.toggle("is-hidden", !canRespond || value !== "pending");
    declineBtn.classList.toggle("is-hidden", !canRespond || value !== "pending");
    changeBtn.classList.toggle("is-hidden", !canRespond || value === "pending");

    if (!hasCode) status.textContent = t("rsvpNeedLink");
    else if (!guestOk) status.textContent = t("invalidCode");
    else if (value === "yes") status.textContent = t("rsvpYes");
    else if (value === "no") status.textContent = t("rsvpNo");
    else status.textContent = t("rsvpPending");
  }

  function playOpenSound() {
    const file = $("#sfx-open");
    if (file && file.currentSrc && file.readyState >= 2) {
      file.currentTime = 0;
      file.play().catch(() => {});
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(392, now);
    osc.frequency.exponentialRampToValueAtTime(262, now + 0.45);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.72);
  }

  function openEnvelope() {
    if (state.opened) return;
    const envelope = $("#envelope");
    envelope.classList.add("is-open");
    playOpenSound();
    window.setTimeout(() => {
      $("#envelope-screen").classList.add("is-gone");
      $("#site").classList.add("is-visible");
      document.body.classList.remove("is-locked");
      sessionStorage.setItem("se-opened", "1");
      state.opened = true;
    }, 980);
  }

  function skipEnvelope() {
    $("#envelope-screen").classList.add("is-gone");
    $("#site").classList.add("is-visible");
    document.body.classList.remove("is-locked");
  }

  function tick() {
    const target = new Date(config.weddingAt).getTime();
    const now = Date.now();
    let diff = Math.max(0, target - now);
    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    diff -= hours * 3600000;
    const minutes = Math.floor(diff / 60000);
    diff -= minutes * 60000;
    const seconds = Math.floor(diff / 1000);
    $("#cd-days").textContent = String(days).padStart(2, "0");
    $("#cd-hours").textContent = String(hours).padStart(2, "0");
    $("#cd-minutes").textContent = String(minutes).padStart(2, "0");
    $("#cd-seconds").textContent = String(seconds).padStart(2, "0");
  }

  function scriptGet(params) {
    const url = new URL(config.scriptUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetch(url.toString(), { method: "GET" }).then((r) => r.json());
  }

  async function loadGuest() {
    if (!state.code) {
      state.guest = null;
      return;
    }
    if (!config.scriptUrl) {
      state.guest = { name: state.code === "demo" ? "Invitado especial" : "", variant: "completo", status: "pending", ok: state.code === "demo" };
      if (state.code !== "demo") state.guest = { ok: false };
      return;
    }
    try {
      const data = await scriptGet({ action: "guest", i: state.code });
      state.guest = data;
    } catch {
      state.guest = { ok: false };
    }
  }

  async function sendRsvp(status) {
    if (!state.code || state.busy) return;
    state.busy = true;
    renderRsvp();
    try {
      if (config.scriptUrl) {
        const data = await scriptGet({ action: "rsvp", i: state.code, status });
        if (!data.ok) throw new Error("rsvp");
        state.guest = data;
      } else if (state.guest) {
        state.guest.status = status;
      }
    } catch {
      $("#rsvp-status").textContent = t("rsvpError");
      state.busy = false;
      return;
    }
    state.busy = false;
    renderRsvp();
  }

  function revealPayment() {
    const box = $("#payment-box");
    const qr = $("#qr-img");
    const hasData = Boolean(config.payment.bank || config.payment.pagoMovil);
    box.classList.toggle("is-hidden", !hasData);
    $("#pay-holder").textContent = config.payment.holder || "";
    $("#pay-bank").textContent = config.payment.bank || "";
    $("#pay-pm").textContent = config.payment.pagoMovil || "";
    if (qr && config.payment.qr) {
      qr.addEventListener("error", () => qr.parentElement.classList.add("is-hidden"));
      qr.src = config.payment.qr;
    } else if (qr) {
      qr.parentElement.classList.add("is-hidden");
    }
  }

  function bind() {
    $("#envelope").addEventListener("click", openEnvelope);
    $("#envelope").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openEnvelope();
      }
    });
    $("#lang-toggle").addEventListener("click", () => {
      state.lang = state.lang === "es" ? "en" : "es";
      localStorage.setItem("se-lang", state.lang);
      applyLang();
    });
    $("#rsvp-confirm").addEventListener("click", () => sendRsvp("yes"));
    $("#rsvp-decline").addEventListener("click", () => sendRsvp("no"));
    $("#rsvp-change").addEventListener("click", () => sendRsvp("pending"));
  }

  async function init() {
    document.body.classList.add("is-locked");
    bind();
    await loadGuest();
    applyLang();
    revealPayment();
    tick();
    window.setInterval(tick, 1000);
    if (state.opened || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      skipEnvelope();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
