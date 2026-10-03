(() => {
  const { config, i18n } = window.SE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    lang: localStorage.getItem("se-lang") || ((navigator.language || "es").startsWith("en") ? "en" : "es"),
    guest: window.SE.cachedGuest && window.SE.cachedGuest.ok !== false ? window.SE.cachedGuest : null,
    code: window.SE.code || readInviteCode(),
    opened: false,
    opening: false,
    audioUnlocked: false,
    picking: false,
    guestRequested: false,
    muted: localStorage.getItem("se-muted") === "1",
    musicReady: false,
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
    const muteBtn = $("#mute-toggle");
    if (muteBtn) {
      muteBtn.classList.toggle("is-paused", state.muted || $("#ambiente")?.paused);
      muteBtn.setAttribute("aria-label", state.muted ? t("unmute") : t("mute"));
    }
    renderRsvp();
    toggleDinner();
  }

  function toggleDinner() {
    const hideDinner = state.guest?.variant === "iglesia";
    $$("[data-dinner]").forEach((el) => el.classList.toggle("is-hidden", hideDinner));
    markTimelineEnds();
    updateTimelineRose();
  }

  function visibleTimelineItems() {
    return $$(".timeline li").filter((li) => !li.classList.contains("is-hidden"));
  }

  function markTimelineEnds() {
    const items = $$(".timeline li");
    items.forEach((li) => li.classList.remove("is-last"));
    const visible = visibleTimelineItems();
    visible[visible.length - 1]?.classList.add("is-last");
  }

  function timelineRoseRange() {
    const wrap = $(".timeline-wrap");
    const rose = $(".timeline-rose");
    const items = visibleTimelineItems();
    if (!wrap || !rose || !items.length) return { start: 0, end: 0 };
    const markerOffset = 14; // matches li::after top
    const roseMid = rose.offsetHeight / 2 || 22;
    const start = items[0].offsetTop + markerOffset - roseMid;
    const end = items[items.length - 1].offsetTop + markerOffset - roseMid;
    return { start: Math.max(0, start), end: Math.max(0, end) };
  }

  function timelineScrollProgress() {
    const section = $(".schedule-section");
    if (!section) return 0;
    const rect = section.getBoundingClientRect();
    const view = window.innerHeight || 1;
    // Scrub while the schedule block crosses the viewport (Tilda-like scroll SBS)
    const start = view * 0.72;
    const end = view * 0.28;
    const t = (start - rect.top) / (start - end + rect.height * 0.55);
    return Math.min(1, Math.max(0, t));
  }

  function updateTimelineRose() {
    const rose = $(".timeline-rose");
    if (!rose) return;
    const { start, end } = timelineRoseRange();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = reduce ? 0 : timelineScrollProgress();
    const y = start + (end - start) * progress;
    rose.style.setProperty("--rose-y", `${y}px`);
  }

  function bindTimelineRose() {
    markTimelineEnds();
    updateTimelineRose();
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateTimelineRose();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
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

  function prepareMusic() {
    const audio = $("#ambiente");
    const src = config.audio;
    if (!audio || !src || state.musicReady === "missing") return audio;
    if (!audio.getAttribute("src") && !audio.querySelector("source")) {
      audio.src = src;
    }
    audio.loop = true;
    audio.preload = "auto";
    try { audio.load(); } catch {}
    return audio;
  }

  function showAudioFab() {
    const btn = $("#mute-toggle");
    if (!btn) return;
    btn.classList.add("is-ready");
    applyLang();
  }

  function startMusic() {
    const audio = prepareMusic();
    if (!audio) return;
    state.audioUnlocked = true;
    audio.muted = false;
    state.muted = false;
    localStorage.setItem("se-muted", "0");
    audio.volume = 1;
    const play = audio.play();
    if (play && play.then) {
      play.then(() => {
        state.musicReady = true;
        applyLang();
      }).catch(() => {});
    }
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

  function unlockAudio() {
    if (state.audioUnlocked || state.opening || state.opened) return;
    const audio = prepareMusic();
    if (!audio) return;
    const p = audio.play();
    if (p && p.then) {
      p.then(() => {
        if (state.opening || state.opened) return;
        audio.pause();
        audio.currentTime = 0;
        state.audioUnlocked = true;
      }).catch(() => {});
    }
  }

  function playHero() {
    const hero = $("#hero-video");
    if (!hero) return;
    hero.muted = true;
    const play = hero.play();
    if (play && play.catch) play.catch(() => {});
  }

  function setScrollLock(on) {
    document.documentElement.classList.toggle("is-locked", on);
    document.body.classList.toggle("is-locked", on);
    if (on) window.scrollTo(0, 0);
  }

  function unlockScrollAfterEnvelope(overlay) {
    window.scrollTo(0, 0);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.scrollTo(0, 0);
      setScrollLock(false);
    };
    const onEnd = (e) => {
      if (e.target !== overlay) return;
      if (e.propertyName && e.propertyName !== "opacity") return;
      finish();
    };
    overlay.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, 1600);
  }

  function revealInvitation() {
    if (state.opened) return;
    state.opened = true;
    window.scrollTo(0, 0);
    const overlay = $("#envelope-screen");
    overlay.classList.add("is-gone");
    $("#site").classList.add("is-visible");
    // Keep scroll locked until the envelope fade fully finishes
    unlockScrollAfterEnvelope(overlay);
    showAudioFab();
    playHero();
    applyLang();
    markTimelineEnds();
    requestAnimationFrame(updateTimelineRose);
  }

  function playOpenVideo(video) {
    const overlay = $("#envelope-screen");
    overlay.classList.add("is-playing");
    try { video.currentTime = 0; } catch {}
    const play = video.play();
    if (play && play.catch) {
      play.catch(() => {
        playOpenSound();
        window.setTimeout(revealInvitation, 700);
      });
    }
  }

  function openEnvelope() {
    if (state.opened || state.opening) return;
    state.opening = true;
    window.scrollTo(0, 0);
    setScrollLock(true);
    startMusic();
    ensureGuest();
    const tap = $("#tap-wrap");
    if (tap) tap.classList.add("is-hidden");
    const video = $("#open-video");
    if (!video) {
      playOpenSound();
      window.setTimeout(revealInvitation, 800);
      return;
    }
    // Fade invitation in before ~4s (open clip keeps playing underneath)
    window.setTimeout(revealInvitation, 4500);
    if (video.readyState >= 2) {
      playOpenVideo(video);
      return;
    }
    video.addEventListener("canplay", () => playOpenVideo(video), { once: true });
    video.load();
    window.setTimeout(() => {
      if (!state.opened && video.paused) playOpenVideo(video);
    }, 700);
  }

  function skipEnvelope() {
    state.opened = true;
    window.scrollTo(0, 0);
    const overlay = $("#envelope-screen");
    overlay.classList.add("is-gone");
    $("#site").classList.add("is-visible");
    unlockScrollAfterEnvelope(overlay);
    showAudioFab();
    playHero();
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
    const blockScroll = (e) => {
      if (!document.body.classList.contains("is-locked")) return;
      e.preventDefault();
    };
    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });
    window.addEventListener("scroll", () => {
      if (document.body.classList.contains("is-locked") && window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    }, { passive: true });

    const overlay = $("#envelope-screen");
    overlay.addEventListener("touchstart", unlockAudio, { passive: true });
    overlay.addEventListener("click", openEnvelope);
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openEnvelope();
      }
    });
    const openVideo = $("#open-video");
    if (openVideo) {
      openVideo.addEventListener("timeupdate", () => {
        // Start fade a bit earlier so opacity is gone around ~4s
        if (openVideo.currentTime >= 3.35) {
          revealInvitation();
        }
      });
      openVideo.addEventListener("ended", revealInvitation);
      openVideo.addEventListener("error", () => window.setTimeout(revealInvitation, 600));
    }
    $("#mute-toggle").addEventListener("click", () => {
      const audio = $("#ambiente");
      if (!audio) return;
      if (audio.paused) {
        state.muted = false;
        audio.muted = false;
        audio.play().catch(() => {});
      } else {
        state.muted = true;
        audio.pause();
      }
      localStorage.setItem("se-muted", state.muted ? "1" : "0");
      applyLang();
    });
    $("#rsvp-seal")?.addEventListener("click", () => {
      const confirmBtn = $("#rsvp-confirm");
      if (confirmBtn && !confirmBtn.classList.contains("is-hidden") && !confirmBtn.disabled) {
        confirmBtn.click();
        return;
      }
      $("#rsvp-change")?.click();
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
    setScrollLock(true);
    prepareMusic();
    bind();
    applyLang();
    revealPayment();
    bindTimelineRose();
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
