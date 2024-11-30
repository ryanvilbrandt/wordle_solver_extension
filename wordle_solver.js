let word_list = null;


async function fetch_word_list() {
    if (word_list === null) {
        const dictionary_file_path = browser.runtime.getURL("wordle_dictionary.json");
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
                    observer.disconnect();
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
    console.log("fdsffdfs");
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
    const possible_words = get_possible_words(results);
    get_suggested_words(possible_words);
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
            if (results["incorrect_letters"].has(c)) {
                // Bad letter, go to next word
                check_word = false;
                break;
            }
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

function get_suggested_words(possible_words) {
    const ranked_word_dict = get_ranked_word_dict(possible_words);
    const top_words = get_top_n_words(ranked_word_dict, 3);
    console.log(top_words);
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
    }
    return ranked_word_dict;
}

function get_top_n_words(word_dict, n) {
    const entries = Object.entries(word_dict);
    const sortedEntries = entries.sort((a, b) => b[1] - a[1]);
    return sortedEntries.slice(0, n).map(([key]) => key);
}

// Check if enter key is visible at the start. If not, start observer.
if (!bind_to_enter_key()) {
    fetch_word_list();
    start_observer();
}
