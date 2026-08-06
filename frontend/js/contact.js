import { API_BASE } from "./main.js";

const $ = (id) => document.getElementById(id);

function toast(type, title, message) {
  const fn = window.CamporaToast;
  if (typeof fn === "function") fn(type, title, message);
}

function setErr(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
}

function validateForm({ name, email, message, phone }) {
  const errors = {};

  if (!name || name.trim().length < 2) errors.name = "Please enter your name.";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Please enter a valid email.";
  if (phone && phone.trim().length > 0 && phone.trim().length < 7) errors.phone = "Phone looks too short.";
  if (!message || message.trim().length < 5) errors.message = "Message must be at least 5 characters.";

  return errors;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = $("contactForm");
  if (!form) return;

  const nameInput = $("contactName");
  const emailInput = $("contactEmail");
  const phoneInput = $("contactPhone");
  const msgInput = $("contactMessage");

  const nameErr = $("contactNameError");
  const emailErr = $("contactEmailError");
  const phoneErr = $("contactPhoneError");
  const msgErr = $("contactMessageError");

  const btn = $("contactBtn");
  const loading = $("contactLoading");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    setErr(nameErr, "");
    setErr(emailErr, "");
    setErr(phoneErr, "");
    setErr(msgErr, "");

    const payload = {
      name: nameInput?.value?.trim() || "",
      email: emailInput?.value?.trim() || "",
      phone: phoneInput?.value?.trim() || "",
      message: msgInput?.value?.trim() || "",
    };

    const errors = validateForm(payload);
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      setErr(nameErr, errors.name);
      setErr(emailErr, errors.email);
      setErr(phoneErr, errors.phone);
      setErr(msgErr, errors.message);
      return;
    }

    try {
      if (btn) btn.disabled = true;
      if (loading) loading.hidden = false;

      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          message: payload.message,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Failed to send (${res.status})`);
      }

      toast("success", "Message Sent", data?.message || "Thanks! We’ll reply soon.");
      form.reset();
    } catch (err) {
      toast("error", "Send Failed", err?.message || "Unable to send message.");
    } finally {
      if (btn) btn.disabled = false;
      if (loading) loading.hidden = true;
    }
  });
});

