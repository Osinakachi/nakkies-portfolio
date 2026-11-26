/* Runs first: marks the page as JS-enabled (and touch) so the Webflow styles apply. */
!function (o, c) {
  var n = c.documentElement, t = " w-mod-";
  n.className += t + "js";
  if ("ontouchstart" in o || (o.DocumentTouch && c instanceof o.DocumentTouch)) n.className += t + "touch";
}(window, document);
