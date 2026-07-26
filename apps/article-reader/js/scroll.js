// ============================================================
//  PROGRESS BAR
// ============================================================

function updateProgress() {
  var scrollTop = window.scrollY;
  var docHeight = document.documentElement.scrollHeight - window.innerHeight;
  var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  document.getElementById('progressBar').style.width = progress + '%';
}
window.addEventListener('scroll', updateProgress);

// ============================================================
//  SCROLL-HIDE: only portalNavbar hides on scroll, header stays visible
// ============================================================

(function() {
  var navbar = document.getElementById('portalNavbar');
  var THRESHOLD = 100; // px scrolled before hiding
  var lastScrollY = 0;
  var ticking = false;

  function updateNavVisibility() {
    var scrollY = window.scrollY;
    if (scrollY > THRESHOLD) {
      if (navbar) navbar.style.transform = 'translateY(-100%)';
    } else {
      if (navbar) navbar.style.transform = '';
    }
    lastScrollY = scrollY;
    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(updateNavVisibility);
      ticking = true;
    }
  }, { passive: true });
})();
