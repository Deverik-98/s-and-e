window.SE = window.SE || {};

SE.config = {
  couple: {
    bride: "Stefany",
    brideLast: "Gutierrez",
    groom: "Erikson",
    groomLast: "Pacheco",
    initials: "S&E",
  },
  weddingAt: "2026-12-26T17:00:00-04:00",
  timezone: "America/Caracas",
  venues: {
    church: {
      name: "Catedral de San Felipe",
      city: "",
      map: "https://maps.app.goo.gl/LHVNAJ6i5qG8KRHc7",
    },
    dinner: {
      name: "Eventos Platinum",
      city: "Av. La Paz, San Felipe, Yaracuy",
      map: "https://maps.app.goo.gl/uYQwyhexiueHMFBx5",
    },
  },
  schedule: [
    { time: "5:30 PM", key: "ceremony" },
    { time: "7:30 PM", key: "toast" },
    { time: "8:30 PM", key: "dinner" },
    { time: "10 PM", key: "cake" },
  ],
  payment: {
    holder: "Stefany Gutierrez",
    id: "V-25.686.075",
    bank: "0105 — Banco Mercantil C.A.",
    pagoMovil: "0412-950.31.62",
    qr: "assets/img/pago-movil-qr.webp",
  },
  audio: "assets/audio/ambiente.m4a",
  scriptUrl: "https://script.google.com/macros/s/AKfycbxQzrA-d-0ESODYfs0DlGn0t6JeA2XjCNi0YDXUXWMKAVEsfwcOUKOjRkwp2XyYW6z_jQ/exec",
  codeParam: "i",
  inviteSlug: "nos-casamos",
  inviteSlugs: ["nos-casamos", "te-invitamos-a-nuestra-boda"],
  pagesUrl: "https://deverik-98.github.io/s-and-e/",
};

SE.inviteUrl = function inviteUrl(code) {
  // Query form returns HTTP 200 (needed for WhatsApp/Open Graph previews).
  // Path form /nos-casamos/CODE still works for guests via 404.html, but scrapers often skip 404.
  const base = SE.config.pagesUrl.replace(/\/+$/, "");
  const param = SE.config.codeParam || "i";
  return `${base}/?${param}=${encodeURIComponent(code)}`;
};
