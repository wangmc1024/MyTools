/* ============================================================
   Mobile Nav Toggle — shared across all sub-app pages
   Load this after portal-nav.css on every page that has a
   #navToggle button and .nav-links dropdown.
   ============================================================ */
(function () {
  'use strict';

  function initNavToggle() {
    var toggle = document.getElementById('navToggle');
    if (!toggle || toggle._bound) return;
    toggle._bound = true;

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var nav = this.closest('nav, #portalNavbar, .nav-glass');
      if (!nav) return;
      var links = nav.querySelector('.nav-links, .navbar-links');
      if (links) {
        var isOpen = links.classList.toggle('is-open');
        this.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    });

    // Close menu when clicking outside the navbar
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#portalNavbar, .nav-glass')) {
        var openMenu = document.querySelector('.nav-links.is-open, .navbar-links.is-open');
        if (openMenu) openMenu.classList.remove('is-open');
        var btn = document.getElementById('navToggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavToggle);
  } else {
    initNavToggle();
  }
})();
