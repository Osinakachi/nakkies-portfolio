/* Site scripts: form submission (Cloudflare Pages Functions) and blog filter. */
(function () {
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
      var wait = btn.getAttribute('data-wait') || 'Sending...';
      if (isInput) btn.value = wait; else btn.textContent = wait;
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
        if (done) done.style.display = 'block';
      })
      .catch(function () { if (fail) fail.style.display = 'block'; })
      .then(function () {
        if (btn) {
          btn.disabled = false;
          if (isInput) btn.value = label; else btn.textContent = label;
        }
      });
  }, true);

  // Blog: filter posts by category.
  var chips = document.querySelectorAll('[data-filter]');
  if (chips.length) {
    var posts = document.querySelectorAll('[data-category]');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var want = chip.getAttribute('data-filter');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        posts.forEach(function (p) {
          p.hidden = want !== 'all' && p.getAttribute('data-category') !== want;
        });
      });
    });
  }
})();
