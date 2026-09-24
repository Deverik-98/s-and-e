(() => {
  const { config, i18n } = window.SE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    lang: localStorage.getItem("se-lang") || ((navigator.language || "es").startsWith("en") ? "en" : "es"),
    guest: window.SE.cachedGuest && window.SE.cachedGuest.ok !== false ? window.SE.cachedGuest : null,
    code: window.SE.code || readInviteCode(),
    opened: false,
    picking: false,
    guestRequested: false,
  };

  function readInviteCode() {
    const fromQuery = new URLSearchParams(location.search).get(config.codeParam || "i");
    if (fromQuery) return fromQuery.trim();

    const reserved = new Set([...(config.inviteSlugs || []), "s-and-e", "index.html", "404.html"]);
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] === "s-and-e") parts.shift();
    const last = parts[parts.length - 1] || "";
    if (!last || reserved.has(last)) return "";
    return decodeURIComponent(last);
  }

  function cacheGuest(guest) {
    if (!state.code || !guest) return;
    try { localStorage.setItem("se-guest:" + state.code, JSON.stringify(guest)); } catch {}
  }

  const t = (key, vars = {}) => {
    const table = i18n[state.lang] || i18n.es;
    return String(table[key] || i18n.es[key] || key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  };

  function guestName() {
    const name = String(state.guest?.name || "").trim();
    return state.guest && state.guest.ok !== false && name ? name : "";
  }

  function partyList() {
    const party = Array.isArray(state.guest?.party) ? state.guest.party : [];
    if (party.length) return party;
    const name = guestName();
    if (!name) return [];
    return [{ id: "1", name, role: "titular", status: state.guest?.status || "pending" }];
  }

  function isGroup() {
    return partyList().length > 1;
  }

  function named(key) {
    const name = guestName();
    if (name && isGroup() && i18n[state.lang][`${key}ForGroup`]) return t(`${key}ForGroup`, { name });
    return name ? t(`${key}For`, { name }) : t(key);
  }

  function applyLang() {
    const name = guestName();
    document.documentElement.lang = state.lang;
    document.title = named("docTitle");
    $$("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    const greeting = $("#greeting");
    if (greeting) {
      greeting.textContent = !name
        ? t("greetingGeneric")
        : isGroup() ? t("greetingForGroup", { name }) : t("greetingFor", { name });
    }
    const letter = $("#letter");
    if (letter) letter.textContent = named("letter");
    const rsvpLead = $("#rsvp-lead");
    if (rsvpLead) rsvpLead.textContent = named("rsvpLead");
    const hint = $(".open-hint");
    if (hint) hint.textContent = named("openHint");
    const chip = $("#guest-chip");
    if (chip) {
      if (name) {
        chip.textContent = `${t("forGuest")} ${name}`;
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
    const saveBtn = $("#rsvp-save");
    const changeBtn = $("#rsvp-change");
    const box = $("#rsvp-party");
    const hasCode = Boolean(state.code);
    const guestOk = Boolean(state.guest && state.guest.ok !== false);
    const canRespond = hasCode && guestOk;
    const group = isGroup();
    const value = state.guest?.status || "pending";
    const answered = value !== "pending";
    const showPicker = canRespond && group && (state.picking || !answered);

    confirmBtn.classList.toggle("is-hidden", !canRespond || showPicker || answered);
    declineBtn.classList.toggle("is-hidden", !canRespond || showPicker || answered);
    saveBtn.classList.toggle("is-hidden", !showPicker);
    changeBtn.classList.toggle("is-hidden", !canRespond || !answered);
    box.classList.toggle("is-hidden", !showPicker);

    confirmBtn.textContent = t("rsvpConfirm");
    declineBtn.textContent = group ? t("rsvpDeclineGroup") : t("rsvpDecline");
    saveBtn.textContent = t("rsvpSave");

    if (showPicker) renderParty(box);

    if (!hasCode) status.textContent = t("rsvpNeedLink");
    else if (!guestOk) status.textContent = t("invalidCode");
    else if (value === "yes") status.textContent = named("rsvpYes");
    else if (value === "no") status.textContent = named("rsvpNo");
    else if (value === "partial") status.textContent = t("rsvpPartial");
    else status.textContent = named("rsvpPending");
  }

  function renderParty(box) {
    const people = partyList();
    box.innerHTML = `<p class="party-title">${t("rsvpWho")}</p>` + people.map((person) => `
      <label class="party-item">
        <input type="checkbox" data-person="${person.id}" ${person.status !== "no" ? "checked" : ""}>
        <span>${person.name}</span>
      </label>
    `).join("");
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
    ensureGuest();
    const envelope = $("#envelope");
    envelope.classList.add("is-open");
    playOpenSound();
    window.setTimeout(() => {
      $("#envelope-screen").classList.add("is-gone");
      $("#site").classList.add("is-visible");
      document.body.classList.remove("is-locked");
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
    const url = new URL(config.scriptUrl || window.SE.scriptUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetch(url.toString(), { method: "GET" }).then((r) => r.json());
  }

  function applyGuest(data) {
    if (!data) return;
    if (!data.ok && state.code === "demo") {
      data = {
        ok: true,
        name: "Invitado especial",
        variant: "completo",
        status: "pending",
        party: [
          { id: "1", name: "Invitado especial", role: "titular", status: "pending" },
          { id: "2", name: "Pedro Castillo", role: "acompanante", status: "pending" },
        ],
      };
    }
    if (data.ok !== false && !Array.isArray(data.party)) {
      data.party = [{ id: "1", name: data.name, role: "titular", status: data.status || "pending" }];
    }
    state.guest = data;
    if (data.ok !== false) cacheGuest(data);
    applyLang();
  }

  async function ensureGuest() {
    if (!state.code || state.guestRequested) return state.guestReady;
    state.guestRequested = true;
    state.guestReady = (async () => {
      if (!config.scriptUrl && !window.SE.scriptUrl) {
        applyGuest(state.code === "demo" ? { ok: false } : { ok: false });
        return;
      }
      try {
        applyGuest(await scriptGet({ action: "guest", i: state.code }));
      } catch {
        if (!state.guest) applyGuest(state.code === "demo" ? { ok: false } : { ok: false });
      }
    })();
    return state.guestReady;
  }

  function watchRsvp() {
    const section = $("#rsvp");
    if (!section || !("IntersectionObserver" in window)) {
      ensureGuest();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        ensureGuest();
        io.disconnect();
      }
    }, { rootMargin: "200px 0px" });
    io.observe(section);
  }

  async function sendRsvp(status, people) {
    if (!state.code || !state.guest || state.guest.ok === false) return;
    const previous = JSON.parse(JSON.stringify(state.guest));
    if (people) {
      const nextParty = partyList().map((person) => ({
        ...person,
        status: people[person.id] || "no",
      }));
      const yes = nextParty.filter((p) => p.status === "yes").length;
      const summary = yes === nextParty.length ? "yes" : yes === 0 ? "no" : "partial";
      applyGuest({ ...state.guest, status: summary, party: nextParty });
      state.picking = false;
    } else {
      applyGuest({
        ...state.guest,
        status,
        party: partyList().map((person) => ({ ...person, status })),
      });
      state.picking = false;
    }
    try {
      const payload = { action: "rsvp", i: state.code, status };
      if (people) {
        payload.p = Object.entries(people).map(([id, value]) => `${id}:${value}`).join("|");
      }
      const data = await scriptGet(payload);
      if (!data.ok) throw new Error("rsvp");
      applyGuest(data);
    } catch {
      applyGuest(previous);
      $("#rsvp-status").textContent = t("rsvpError");
    }
  }

  function saveParty() {
    const people = {};
    $$("#rsvp-party [data-person]").forEach((input) => {
      people[input.dataset.person] = input.checked ? "yes" : "no";
    });
    sendRsvp("yes", people);
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
    $("#rsvp-confirm").addEventListener("click", () => {
      if (isGroup()) {
        state.picking = true;
        renderRsvp();
        return;
      }
      sendRsvp("yes");
    });
    $("#rsvp-decline").addEventListener("click", () => sendRsvp("no"));
    $("#rsvp-save").addEventListener("click", saveParty);
    $("#rsvp-change").addEventListener("click", () => {
      if (isGroup()) {
        state.picking = true;
        renderRsvp();
        return;
      }
      sendRsvp("pending");
    });
  }

  function init() {
    document.body.classList.add("is-locked");
    bind();
    applyLang();
    revealPayment();
    tick();
    window.setInterval(tick, 1000);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      skipEnvelope();
    }
    watchRsvp();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
