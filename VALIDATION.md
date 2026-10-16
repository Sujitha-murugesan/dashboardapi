# Validation proof

Tool: W3C Nu HTML Checker (vnu.jar 26.10.12), the engine behind validator.w3.org/nu.

Command:
```
java -jar node_modules/vnu-jar/build/dist/vnu.jar --also-check-css index.html users.html reports.html settings.html css/styles.css
```
Result: **no errors, no warnings** (exit code 0) for all four pages and `css/styles.css`.

One error was found and fixed during development: an `<output>` element nested inside a `<label for>`; it was moved into a separate linked hint.

To repeat with the web UI: open https://validator.w3.org/nuv/, choose "Text Field", paste each page's source, and click Check. For your submission, add screenshots of each green "Document checking completed. No errors or warnings to show." result to `docs/screenshots/`.
