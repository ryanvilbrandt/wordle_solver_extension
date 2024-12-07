let word_list = null;


async function fetch_word_list() {
    if (word_list === null) {
        const browserAPI = typeof browser !== "undefined" ? browser : chrome;
        const dictionary_file_path = browserAPI.runtime.getURL("wordle_dictionary.json");
        const response = await fetch(dictionary_file_path);
        word_list = await response.json();
    }
}

function start_observer() {
    // The website usually starts with a splash screen. Set up a MutationObserver to check for changes to the webpage
    // and wait for the Enter key to become available. Once it's visible, bind a function to it and disable the observer.
    const mutationObserver = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                if (bind_to_enter_key()) {
                    console.debug("Disconnecting observer");
                    observer.disconnect();
                    console.debug("Solving words");
                    enter_pressed();
                }
            }
        }
    });
    // Start observing the entire document for added nodes
    mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function bind_to_enter_key() {
    // Look for the "Enter" key on the page. If you can find it, bind its click event to a function.
    const keys = document.querySelectorAll('[class*="Key-module_key"]');
    for (const key of keys) {
        if (key.attributes["data-key"].value === "↵") {
            key.addEventListener("click", enter_pressed);
            // Also bind the Enter key on the keyboard.
            document.addEventListener("keydown", function(event) {
                if (event.key === "Enter")
                    enter_pressed();
            });
            return true;
        }
    }
    return false;
}

function enter_pressed() {
    console.log("Enter button pressed!");
    wait_for_tile_update(get_words_and_solve);
}

function wait_for_tile_update(callback) {
    const check_interval = 500; // Check every 500ms
    const interval = setInterval(() => {
        if (check_rows_for_tile_state()) {
            clearInterval(interval); // Stop checking
            callback(); // Execute the callback
        }
    }, check_interval);
}

function check_rows_for_tile_state() {
    // Select all rows
    const rows = document.querySelectorAll('[class*="Row-module_row__"]');

    // Iterate over each row
    return Array.from(rows).every(row => {
        // Select all tiles in the current row
        const tiles = row.querySelectorAll('[class*="Tile-module_tile__"]');

        // Convert NodeList to array and check their data-state and data-animation
        const tile_states = Array.from(tiles).map(tile => tile.getAttribute('data-state'));
        const animation_states = Array.from(tiles).map(tile => tile.getAttribute('data-animation'));

        // Check if all are "empty" or none are "empty"
        const all_empty = tile_states.every(state => state === "empty");
        const none_empty = tile_states.every(state => state !== "empty");
        const all_idle = animation_states.every(state => state === "idle");

        return (all_empty || none_empty) && all_idle;
    });
}


function get_words_and_solve() {
    const rows = document.querySelectorAll('[class*="Row-module_row"]');
    let words = [];
    for (const row of rows) {
        const word = get_word(row);
        if (word.length !== 0)
            words.push(word);
    }
    console.log(words);
    solve(words);
}

function get_word(row) {
    const letters = row.querySelectorAll('[class*="Tile-module_tile"]');
    let word = [];
    for (const letter of letters) {
        if (letter.textContent)
            word.push({"letter": letter.textContent, "state": letter.attributes["data-state"].value});
    }
    // console.log(word);
    return word;
}

function solve(words) {
    const results = check_guesses(words);
    // Check if all the correct letters have been found
    if (results["correct_letters"].every(item => item !== "")) {
        update_hint_div("You win!!");
        return;
    }
    const possible_words = get_possible_words(results);
    const top_n_words = get_suggested_words(possible_words, 5);
    update_hint_div(`${possible_words.length} possible words.\nTop suggestions: ${top_n_words.join(", ")}`);
}

function update_hint_div(text) {
    let hint_div = document.querySelector("#solver-hint-div");
    if (!hint_div) {
        const board = document.querySelector('[class*="Board-module_board__"]');
        // Create a new div element
        hint_div = document.createElement('div');
        hint_div.id = "solver-hint-div";
        hint_div.textContent = text;
        hint_div.style.color = "goldenrod";
        hint_div.style.position = "absolute";

        // Insert the new div before the board element
        board.parentNode.insertBefore(hint_div, board);

        // Get the board's position
        const rect = board.getBoundingClientRect();

        // Position the new div relative to the board
        hint_div.style.top = `${rect.top - hint_div.offsetHeight * 2}px`; // Above the board
        hint_div.style.left = `${rect.left}px`;

        // Respect new lines in the textContent
        hint_div.style.whiteSpace = "pre";
    } else {
        hint_div.textContent = text;
    }
}

function check_guesses(words) {
    const correct_letters = ["", "", "", "", ""];
    const extra_letters = new Set();
    const incorrect_letters = new Set();
    const wrong_positions = {};
    for (const word of words) {
        for (const [i, letter] of word.entries()) {
            const c = letter["letter"];
            if (letter["state"] === "correct") {
                correct_letters[i] = c;
                if (wrong_positions.hasOwnProperty(c))
                    delete wrong_positions[c];
                extra_letters.delete(c);
            } else if (letter["state"] === "present") {
                extra_letters.add(c);
                if (!wrong_positions.hasOwnProperty(c))
                    wrong_positions[c] = new Set();
                wrong_positions[c].add(i);
            } else if (letter["state"] === "absent") {
                if (!wrong_positions.hasOwnProperty(c))
                    incorrect_letters.add(c);
            }
        }
    }
    console.log(correct_letters);
    console.log(extra_letters);
    console.log(incorrect_letters);
    console.log(wrong_positions);
    return {
        "correct_letters": correct_letters, "extra_letters": extra_letters, "incorrect_letters": incorrect_letters,
        "wrong_positions": wrong_positions,
    }
}

function get_possible_words(results) {
    const possible_words = [];
    for (const word of word_list) {
        const extra_letters_to_check = new Set();
        let check_word = true;
        for (let i = 0; i < word.length; i++) {
            const c = word[i];
            if (results["correct_letters"][i] !== "") {
                if (results["correct_letters"][i] === c) {
                    // Good letter, check next letter
                    continue;
                }
                else {
                    // Doesn't match known letter, go to next word
                    check_word = false;
                    break;
                }
            }
            if (results["incorrect_letters"].has(c)) {
                // Bad letter, go to next word
                check_word = false;
                break;
            }
            if (results["wrong_positions"].hasOwnProperty(c) && results["wrong_positions"][c].has(i)) {
                // Letter was already tried in this spot, go to next word
                check_word = false;
                break;
            }
            extra_letters_to_check.add(c);
        }
        if (check_word && set_difference(results["extra_letters"], extra_letters_to_check).size === 0)
            possible_words.push(word);
    }
    console.log(possible_words);
    return possible_words;
}

function set_difference(set1, set2) {
    return new Set([...set1].filter(item => !set2.has(item)));
}

function get_suggested_words(possible_words, top_n_words) {
    const ranked_word_dict = get_ranked_word_dict(possible_words);
    const top_words = get_top_n_words(ranked_word_dict, top_n_words);
    console.log(`Top words: ${top_words}`);
    return top_words;
}

function get_ranked_word_dict(possible_words) {
    const letter_position_counts = {};
    for (const word of possible_words) {
        for (let i = 0; i < word.length; i++) {
            const c = word[i];
            if (!letter_position_counts.hasOwnProperty(c))
                letter_position_counts[c] = [0, 0, 0, 0, 0];
            letter_position_counts[c][i]++;
        }
    }
    const ranked_word_dict = {};
    for (const word of possible_words) {
        let word_ranking = 0;
        for (let i = 0; i < word.length; i++) {
            const c = word[i];
            word_ranking += letter_position_counts[c][i];
        }
        ranked_word_dict[word] = word_ranking;
        // Penalize any word with repeated letters
        if ((new Set(word)).size < word.length)
            ranked_word_dict[word] /= Math.floor(ranked_word_dict[word] / 2);
    }
    return ranked_word_dict;
}

function get_top_n_words(word_dict, n) {
    const entries = Object.entries(word_dict);
    const sortedEntries = entries.sort((a, b) => b[1] - a[1]);
    return sortedEntries.slice(0, n).map(([key]) => key);
}

fetch_word_list();

// Check if enter key is visible at the start. If not, start observer.
if (!bind_to_enter_key()) {
    start_observer();
}
