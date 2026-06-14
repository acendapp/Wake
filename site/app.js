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
