/* Site scripts: contact form, and the home project-title visibility fix. No dependencies. */
(function () {
  var msg = { sending: 'Sending...', sent: 'Thanks! Your message has been sent.', failed: 'Something went wrong. Please try again.', invalid: 'Please check your email and message.' };
  try {
    var el = document.getElementById('nk-messages');
    if (el) msg = JSON.parse(el.textContent);
  } catch (e) { /* keep defaults */ }

  // Forms: capture-phase listener so Webflow's own submit handler never runs.
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.matches || !f.matches('form[data-form]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    var wrap = f.closest('.w-form');
    var done = wrap && wrap.querySelector('.w-form-done');
    var fail = wrap && wrap.querySelector('.w-form-fail');
    var btn = f.querySelector('[type="submit"]');
    var isInput = btn && btn.tagName === 'INPUT';
    var label = btn ? (isInput ? btn.value : btn.textContent) : '';

    if (fail) fail.style.display = 'none';
    if (btn) {
      btn.disabled = true;
      if (isInput) btn.value = msg.sending; else btn.textContent = msg.sending;
    }

    var data = {};
    new FormData(f).forEach(function (v, k) { data[k] = v; });

    fetch(f.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function () {
        f.reset();
        f.style.display = 'none';
        if (done) { done.style.display = 'block'; done.focus(); }
      })
      .catch(function () { if (fail) { fail.style.display = 'block'; fail.focus(); } })
      .then(function () {
        if (btn) {
          btn.disabled = false;
          if (isInput) btn.value = label; else btn.textContent = label;
        }
      });
  }, true);

  // Skip link: move focus into the main content so keyboard users continue from there.
  var skip = document.querySelector('.nk-skip');
  if (skip) skip.addEventListener('click', function () {
    var m = document.getElementById('main');
    if (m) setTimeout(function () { m.focus(); }, 0);
  });

  // Home: the project titles are animated by scroll and share one trigger, so a title can
  // be left parked on screen after its project has passed. Show each title only while its
  // own project is on screen.
  var work = document.querySelector('section.projects');
  if (work) {
    var items = [].slice.call(work.querySelectorAll('.project-container')).map(function (c) {
      return { box: c, labels: c.querySelectorAll('.project-name, .project-summary') };
    });
    var ticking = false;
    var sync = function () {
      ticking = false;
      var vh = window.innerHeight;
      items.forEach(function (it) {
        var r = it.box.getBoundingClientRect();
        var on = r.top < vh && r.bottom > vh * 0.72;
        it.labels.forEach(function (el) { el.style.visibility = on ? '' : 'hidden'; });
      });
    };
    var queue = function () { if (!ticking) { ticking = true; requestAnimationFrame(sync); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    sync();
  }
})();
