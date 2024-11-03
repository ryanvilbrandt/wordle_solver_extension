function start_observer() {
  // The website usually starts with a splash screen. Set up a MutationObserver to check for changes to the webpage
  // and wait for the Enter key to become available. Once it's visible, bind a function to it and disable the observer.
  const mutationObserver = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        if (bind_to_enter_key()) {
          observer.disconnect();
        }
      }
    }
  });
  // Start observing the entire document for added nodes
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function bind_to_enter_key() {
  const keys = document.querySelectorAll('[class*="Key-module_key"]');
  for (const key of keys) {
    if (key.attributes["data-key"].value === "↵") {
      console.log(key);
      key.addEventListener("click", enter_pressed);
      return true;
    }
  }
  return false;
}

function enter_pressed() {
  console.log("Enter button pressed!");
  const rows = document.querySelectorAll('[class*="Row-module_row"]');
  let words = [];
  for (const row of rows) {
    const word = get_word(row);
    if (word)
      words.push();
  }
  console.log(words);
}

function get_word(row) {
  const letters = row.querySelectorAll('[class*="Tile-module_tile"]');
  let word = [];
  for (const letter of letters) {
    if (letter.textContent)
      word.push({"letter": letter.textContent, "state": letter.attributes["data-state"].value});
  }
  console.log(word);
  return word;
}

function solve() {

}

// Check if enter key is visible at the start. If not, start observer.
if (!bind_to_enter_key()) {
  start_observer();
}
