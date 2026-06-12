// Scroll-triggered reveals; no-op when reduced motion is preferred.
(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var targets = document.querySelectorAll(".reveal, .specimen");
  if (reduced || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("seen"); });
    return;
  }
  targets.forEach(function (el) { el.classList.add("reveal"); });
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("seen");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  targets.forEach(function (el) { io.observe(el); });
})();
