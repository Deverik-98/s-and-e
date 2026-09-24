window.SE = window.SE || {};

SE.config = {
  couple: {
    bride: "Stefany",
    brideLast: "Gutierrez",
    groom: "Erikson",
    groomLast: "Pacheco",
    initials: "S&E",
  },
  weddingAt: "2026-12-25T16:00:00-04:00",
  timezone: "America/Caracas",
  venues: {
    church: {
      name: "Catedral de San Felipe",
      city: "San Felipe, Yaracuy",
      map: "https://maps.app.goo.gl/LHVNAJ6i5qG8KRHc7",
    },
    dinner: {
      name: "Hotel La Antigua Misión",
      city: "San Felipe, Yaracuy",
      map: "https://maps.app.goo.gl/FopyTYkhcWWBcd487",
    },
  },
  schedule: [
    { time: "16:00", key: "church" },
    { time: "18:00", key: "dinner" },
    { time: "20:00", key: "close" },
  ],
  payment: {
    bank: "",
    pagoMovil: "",
    holder: "Stefany Gutierrez / Erikson Pacheco",
    qr: "",
  },
  audio: "assets/audio/ambiente.m4a",
  scriptUrl: "https://script.google.com/macros/s/AKfycbxQzrA-d-0ESODYfs0DlGn0t6JeA2XjCNi0YDXUXWMKAVEsfwcOUKOjRkwp2XyYW6z_jQ/exec",
  codeParam: "i",
  inviteSlug: "nos-casamos",
  inviteSlugs: ["nos-casamos", "te-invitamos-a-nuestra-boda"],
  pagesUrl: "https://deverik-98.github.io/s-and-e/",
};

SE.inviteUrl = function inviteUrl(code) {
  const base = SE.config.pagesUrl.replace(/\/+$/, "");
  const slug = SE.config.inviteSlug;
  return `${base}/${slug}/${encodeURIComponent(code)}`;
};
