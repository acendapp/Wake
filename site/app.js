// Early-access signup — POSTs the email to Web3Forms, which relays every
// submission to the address tied to the access key (set in index.html).
// Progressive enhancement: until the key is set, we confirm locally so the
// page still works and never looks broken.
(function () {
  var form = document.getElementById('notify-form');
  var msg = document.getElementById('notify-msg');
  if (!form || !msg) return;

  var keyEl = form.querySelector('[name="access_key"]');
  var wired =
    keyEl && keyEl.value && keyEl.value.indexOf('WEB3FORMS_ACCESS_KEY') === -1;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = (new FormData(form).get('email') || '').toString().trim();
    if (!email) return;

    if (!wired) {
      // Key not set yet — confirm locally so the page still demos.
      msg.textContent = "You're on the list — we'll be in touch. ✦";
      form.reset();
      return;
    }

    var btn = form.querySelector('button');
    msg.textContent = 'Adding you…';
    if (btn) btn.disabled = true;

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var ok = data && data.success;
        msg.textContent = ok
          ? "You're on the list — we'll be in touch. ✦"
          : 'Something went wrong. Please try again.';
        if (ok) form.reset();
      })
      .catch(function () {
        msg.textContent = 'Something went wrong. Please try again.';
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  });
})();

// Scroll reveal — fade/slide elements in as they enter the viewport. Elements
// start hidden via the .reveal class (in CSS); we add .is-visible on intersect.
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  var revealAll = function () {
    els.forEach(function (el) {
      el.classList.add('is-visible');
    });
  };

  var reduce =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    revealAll();
    return;
  }

  try {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -6% 0px' }
    );

    els.forEach(function (el) {
      // Stagger siblings in the same group so grids cascade in.
      var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) {
        return c.classList.contains('reveal');
      });
      var i = sibs.indexOf(el);
      if (i > 0) el.style.transitionDelay = Math.min(i, 5) * 80 + 'ms';
      io.observe(el);
    });

    // Safety net: if anything is still hidden a few seconds in (observer never
    // fired, e.g. an edge-case layout), reveal it so content is never stuck.
    setTimeout(function () {
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-visible');
      });
    }, 2500);
  } catch (err) {
    revealAll();
  }
})();
