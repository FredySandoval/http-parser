# Writing Pseudo-Code Guidelines

## Principles

* The function or class intention must be clearly defined in its **name**.
* Define an example of raw **input/output** in **JSDoc-style comments** at the top of each function.
* Use short, minimal, and simple comments inside functions/classes to annotate **important behaviors only**.
* Use **human terms**: "manage", "provide", "extract", "parse", "handle", etc.
* Avoid delving into code logic; prioritize describing the **action** in simple terms.
* Write **test shoulds** at the end of the file for simplicity.

---

## Example

```pseudo
/**
 * input: "1234A"
 * output: [1, 2, 3, 4]
 */
function string_to_array(input)
    converts a string into an array
    ignores non-numeric characters
    // human language for quick and easy reviews
    // no code logic, only action descriptions

class VariableRegistry
    // manages system variables

    /**
     * input: "myVar"
     * output: true | false
     */
    function has(name)
        checks if a variable exists

    /**
     * output: ["USER_ID", "SESSION_ID", "ENV"]
     */
    function getAll()
        lists all available system variables

```