// Waitlist form handling. Progressive enhancement: the form is a plain POST that
// works without JS once you wire a real endpoint. With JS, we submit in the
// background and show an inline confirmation instead of navigating away.
//
// To go live: create a free form on Formspree (or similar) and replace
// `your-form-id` in index.html's <form action="…">. Until then, the endpoint is a
// placeholder and we just show an optimistic thank-you so the page still demos.

(function () {
  var form = document.getElementById('waitlist-form');
  var msg = document.getElementById('waitlist-msg');
  if (!form || !msg) return;

  var wired = form.action.indexOf('your-form-id') === -1;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = (new FormData(form).get('email') || '').toString().trim();
    if (!email) return;

    if (!wired) {
      // Endpoint not connected yet — confirm locally so the demo feels complete.
      msg.textContent = "You're on the list — we'll be in touch. ✦";
      form.reset();
      return;
    }

    msg.textContent = 'Adding you…';
    fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    })
      .then(function (res) {
        if (res.ok) {
          msg.textContent = "You're on the list — we'll be in touch. ✦";
          form.reset();
        } else {
          msg.textContent = 'Something went wrong. Please try again.';
        }
      })
      .catch(function () {
        msg.textContent = 'Something went wrong. Please try again.';
      });
  });
})();

// Scroll reveal — fade/slide elements in as they enter the viewport. Elements
// start hidden via the .reveal class (in CSS); we add .is-visible on intersect.
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  var reduce =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (el) {
      el.classList.add('is-visible');
    });
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
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
})();
