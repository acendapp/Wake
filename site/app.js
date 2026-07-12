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
