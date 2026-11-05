mergeInto(LibraryManager.library, {
  BloomReady: function() { if(window.bloomReady) window.bloomReady(); },
  BloomStatus: function(value) { if(window.bloomStatus) window.bloomStatus(UTF8ToString(value)); }
});
