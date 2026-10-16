(function () {
  "use strict";

  // ----- Theme toggle (light/dark) -----
  var themeBtn = document.querySelector(".theme-toggle");
  if (themeBtn) {
    var root = document.documentElement;
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var isDark = function () {
      var t = root.getAttribute("data-theme");
      return t ? t === "dark" : mq.matches;
    };
    var sync = function () { themeBtn.setAttribute("aria-pressed", String(isDark())); };
    themeBtn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
      sync();
    });
    sync();
  }

  // ----- Mobile menu toggle -----
  var toggle = document.querySelector(".menu-toggle");
  var sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", function () {
      var open = sidebar.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // ----- Modal dialogs (native <dialog>: focus trap, Esc, focus return) -----
  document.querySelectorAll("[data-open-dialog]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dlg = document.getElementById(btn.getAttribute("data-open-dialog"));
      if (!dlg || typeof dlg.showModal !== "function") { return; }
      var name = btn.getAttribute("data-user");
      var target = dlg.querySelector("[data-confirm-name]");
      if (name && target) { target.textContent = name; }
      dlg.showModal();
    });
  });
  document.querySelectorAll("[data-close-dialog]").forEach(function (btn) {
    btn.addEventListener("click", function () { btn.closest("dialog").close(); });
  });

  // ----- Form validation with accessible messages -----
  function messageFor(el) {
    var v = el.validity;
    if (v.valueMissing) { return "This field is required."; }
    if (v.typeMismatch) { return "Enter a valid " + (el.type === "email" ? "email address" : "value") + "."; }
    if (v.tooShort) { return "Enter at least " + el.minLength + " characters."; }
    if (v.patternMismatch) { return "Use the format described below the field."; }
    return el.validationMessage;
  }

  function validateField(el) {
    var err = document.getElementById(el.id + "-err");
    if (!err) { return true; }
    if (el.checkValidity()) {
      el.removeAttribute("aria-invalid");
      err.hidden = true; err.textContent = "";
      return true;
    }
    el.setAttribute("aria-invalid", "true");
    err.textContent = messageFor(el);
    err.hidden = false;
    return false;
  }

  document.querySelectorAll("form.validate").forEach(function (form) {
    var fields = form.querySelectorAll("input:not([type=radio]), select, textarea");
    fields.forEach(function (el) {
      el.addEventListener("blur", function () { validateField(el); });
      el.addEventListener("input", function () { if (el.getAttribute("aria-invalid")) { validateField(el); } });
    });

    form.addEventListener("submit", function (e) {
      var invalid = [];
      fields.forEach(function (el) { if (!validateField(el)) { invalid.push(el); } });
      if (invalid.length) {
        e.preventDefault();
        var summary = document.getElementById("form-summary");
        if (summary) {
          summary.innerHTML = "";
          var h = document.createElement("h2");
          h.textContent = invalid.length + " problem" + (invalid.length > 1 ? "s" : "") + " to fix";
          var ul = document.createElement("ul");
          invalid.forEach(function (el) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            var lbl = form.querySelector('label[for="' + el.id + '"]');
            a.href = "#" + el.id;
            a.textContent = (lbl ? lbl.textContent.replace("*", "").trim() : el.name) + ": " + document.getElementById(el.id + "-err").textContent;
            li.appendChild(a); ul.appendChild(li);
          });
          summary.appendChild(h); summary.appendChild(ul);
          summary.hidden = false;
          summary.focus();
        } else {
          invalid[0].focus();
        }
      }
    });
  });

  // ----- Range output -----
  var range = document.getElementById("page-size");
  var out = document.getElementById("page-size-out");
  if (range && out) {
    range.addEventListener("input", function () { out.textContent = range.value; });
  }
})();
