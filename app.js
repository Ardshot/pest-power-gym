const CONFIG = {
  endpoint: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",
  maxSignups: 100,
  contactEmail: "privatevsemvaram@gmail.com"
};

const form = document.getElementById("signup-form");
const msg = document.getElementById("form-msg");
const submitBtn = form.querySelector("button[type=submit]");
const remainingEls = document.querySelectorAll("[data-remaining]");
const progressEl = document.querySelector("[data-progress]");

let remaining = CONFIG.maxSignups;
let submitting = false;

function setMessage(text, type) {
  msg.textContent = text;
  msg.classList.remove("is-success", "is-error");
  if (type) msg.classList.add(type);
}

function setRemaining(value) {
  remaining = Math.max(0, Math.min(CONFIG.maxSignups, Number(value) || 0));
  remainingEls.forEach((el) => {
    el.textContent = String(remaining);
  });
  if (progressEl) {
    const taken = CONFIG.maxSignups - remaining;
    progressEl.style.width = Math.round((taken / CONFIG.maxSignups) * 100) + "%";
  }
  if (remaining <= 0) {
    submitBtn.disabled = true;
    submitBtn.textContent = "A helyek elfogytak";
    setMessage("Sajnáljuk, mind a 100 hely betelt. Írj nekünk e-mailt, és felkerülhetsz a várólistára.", "is-error");
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent = "Ingyenes hónap igénylése";
  }
}

function configured() {
  return CONFIG.endpoint.startsWith("https://script.google.com/");
}

async function loadCount() {
  if (!configured()) return;
  try {
    const res = await fetch(CONFIG.endpoint + "?action=count", { method: "GET" });
    const data = await res.json();
    if (data && data.ok && typeof data.remaining === "number") {
      setRemaining(data.remaining);
    }
  } catch (err) {
    console.warn("Could not load remaining spots.", err);
  }
}

function value(name) {
  const el = form.elements[name];
  return el ? String(el.value || "").trim() : "";
}

function checked(name) {
  const el = form.elements[name];
  return Boolean(el && el.checked);
}

function validate(name, email, consent) {
  if (name.length < 2) return "Kérjük, add meg a teljes neved.";
  if (name.length > 80) return "A név legfeljebb 80 karakter lehet.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Kérjük, adj meg egy érvényes e-mail címet.";
  if (!consent) return "Az adatkezelési tájékoztató elfogadása kötelező.";
  return "";
}

async function handleSubmit(event) {
  event.preventDefault();
  if (submitting) return;

  if (!configured()) {
    setMessage("A regisztráció hamarosan megnyílik.", "");
    return;
  }

  const name = value("name");
  const email = value("email").toLowerCase();
  const phone = value("phone");
  const newsletter = checked("newsletter");
  const consent = checked("consent");
  const honey = value("company");

  if (honey) {
    form.reset();
    setMessage("Köszönjük, a jelentkezésedet rögzítettük.", "is-success");
    return;
  }

  const problem = validate(name, email, consent);
  if (problem) {
    setMessage(problem, "is-error");
    return;
  }

  submitting = true;
  submitBtn.disabled = true;
  setMessage("Küldés folyamatban…", "");

  try {
    const res = await fetch(CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name, email, phone, newsletter })
    });
    const data = await res.json();

    if (data && data.ok) {
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      form.reset();
      setMessage("Köszönjük, " + name.split(" ")[0] + "! A helyedet rögzítettük. Hamarosan e-mailben jelentkezünk a részletekkel.", "is-success");
    } else if (data && data.error === "duplicate") {
      setMessage("Ezzel az e-mail címmel már regisztráltál. Ha nem te voltál, írj nekünk: " + CONFIG.contactEmail, "is-error");
    } else if (data && data.error === "full") {
      setRemaining(0);
      setMessage("Sajnáljuk, mind a 100 hely betelt. Írj nekünk e-mailt, és felkerülhetsz a várólistára.", "is-error");
    } else if (data && data.error === "email") {
      setMessage("Kérjük, adj meg egy érvényes e-mail címet.", "is-error");
    } else if (data && data.error === "name") {
      setMessage("Kérjük, add meg a teljes neved.", "is-error");
    } else {
      setMessage("Nem sikerült rögzíteni a jelentkezést. Kérjük, próbáld újra, vagy írj a " + CONFIG.contactEmail + " címre.", "is-error");
    }
  } catch (err) {
    setMessage("Hálózati hiba történt. Kérjük, próbáld újra, vagy írj a " + CONFIG.contactEmail + " címre.", "is-error");
  } finally {
    submitting = false;
    if (remaining > 0) submitBtn.disabled = false;
  }
}

document.getElementById("year").textContent = new Date().getFullYear();
form.addEventListener("submit", handleSubmit);
loadCount();

if (!configured()) {
  submitBtn.disabled = true;
  submitBtn.textContent = "Hamarosan nyílik";
  setMessage("A regisztráció hamarosan megnyílik.", "");
}
