/* Storage polyfill: replaces Claude's window.storage API with localStorage */
(function() {
  if (window.storage) return; // already exists
  
  var PREFIX = "dm_";
  
  window.storage = {
    get: function(key) {
      return new Promise(function(resolve, reject) {
        try {
          var raw = localStorage.getItem(PREFIX + key);
          if (raw === null) reject(new Error("Key not found: " + key));
          else resolve({ key: key, value: raw, shared: false });
        } catch(e) { reject(e); }
      });
    },
    set: function(key, value) {
      return new Promise(function(resolve, reject) {
        try {
          localStorage.setItem(PREFIX + key, value);
          resolve({ key: key, value: value, shared: false });
        } catch(e) { reject(e); }
      });
    },
    delete: function(key) {
      return new Promise(function(resolve) {
        localStorage.removeItem(PREFIX + key);
        resolve({ key: key, deleted: true, shared: false });
      });
    },
    list: function(prefix) {
      return new Promise(function(resolve) {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k.startsWith(PREFIX)) {
            var clean = k.slice(PREFIX.length);
            if (!prefix || clean.startsWith(prefix)) keys.push(clean);
          }
        }
        resolve({ keys: keys, shared: false });
      });
    }
  };
})();
