// Apps dropdown in the top-right of the home page.
// Click to open or close; clicking elsewhere or pressing Esc closes it.
(() => {
  const btn = document.getElementById('apps-btn');
  const menu = document.getElementById('apps-menu');
  if (!btn || !menu) return;

  function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.hidden;
    setOpen(open);
    if (open) menu.querySelector('a').focus({ preventScroll: true });
  });

  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !e.target.closest('.apps')) setOpen(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
  });

  // Close when keyboard focus leaves the menu.
  menu.addEventListener('focusout', e => {
    if (!e.relatedTarget || !e.relatedTarget.closest('.apps')) setOpen(false);
  });
})();
