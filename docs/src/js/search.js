/**
 * Command search/filter for the kokoIRC documentation commands page.
 *
 * Finds the search input, listens for input events, and shows/hides
 * .command-entry elements based on whether the command name or text
 * matches the filter query (case-insensitive).  Category headings
 * are hidden when all their commands are filtered out.
 */
(function () {
  var input = document.getElementById("command-search");
  if (!input) return;

  var clearBtn = document.getElementById("search-clear");
  var countEl = document.getElementById("search-count");
  var entries = document.querySelectorAll(".command-entry");
  var catHeadings = document.querySelectorAll('h2[id^="cat-"]');

  function filter() {
    var q = input.value.toLowerCase().trim();
    var visible = 0;

    entries.forEach(function (entry) {
      var name = entry.getAttribute("data-command") || "";
      var cat = entry.getAttribute("data-category") || "";
      var text = entry.textContent || "";
      var match =
        !q ||
        name.includes(q) ||
        cat.toLowerCase().includes(q) ||
        text.toLowerCase().includes(q);
      entry.style.display = match ? "" : "none";
      if (match) visible++;
    });

    // Hide category headings when all their commands are hidden
    catHeadings.forEach(function (h) {
      var next = h.nextElementSibling;
      var hasVisible = false;
      while (next && !next.matches("h2")) {
        if (
          next.classList.contains("command-entry") &&
          next.style.display !== "none"
        ) {
          hasVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      h.style.display = hasVisible ? "" : "none";
    });

    // Update match count
    if (countEl) {
      countEl.textContent = q
        ? visible + " command" + (visible !== 1 ? "s" : "") + " found"
        : "";
    }
  }

  input.addEventListener("input", filter);

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      input.value = "";
      filter();
      input.focus();
    });
  }
})();
