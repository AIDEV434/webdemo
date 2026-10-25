/* Demo guard: light copy deterrents for client previews.
   Pairs with demo-watermark.css. Delete both files and their includes for the final site. */
(function () {
  'use strict';

  var isField = function (el) {
    return el && el.closest && el.closest('input, textarea, select, [contenteditable]');
  };

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { if (!isField(e.target)) e.preventDefault(); });
  ['copy', 'cut'].forEach(function (type) {
    document.addEventListener(type, function (e) { if (!isField(e.target)) e.preventDefault(); });
  });

  // Save, view source, print and the common developer tools shortcuts
  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    var blocked =
      key === 'f12' ||
      (mod && (key === 's' || key === 'u' || key === 'p')) ||
      (mod && (e.shiftKey || e.altKey) && (key === 'i' || key === 'j' || key === 'c'));
    if (blocked) e.preventDefault();
  });
})();
