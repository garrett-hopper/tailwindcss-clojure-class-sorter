# Tailwind CSS Clojure Class Sorter

A VSCode extension that provides a source action to sort Tailwind CSS classes within your Clojure code, including Hiccup templates.

[**Install from VS Code Marketplace**](https://marketplace.visualstudio.com/items?itemName=viesheimeobe.tailwindcss-clojure-class-sorter)

## Features

- **Sort Tailwind Classes:** Provides a `source.sortTailwindClasses` source action that sorts Tailwind CSS classes.

## Prerequisites

While Tailwind CSS v4's standalone CLI can generate CSS without a `node_modules` folder for basic usage, installing Tailwind CSS via npm/yarn is required to use **Tailwind plugins** (like `@tailwindcss/forms`, `@tailwindcss/typography`, etc.). This extension relies on the standard Tailwind CSS library to correctly identify and sort classes provided by such plugins.

Ensure you have `tailwindcss` listed as a dependency in your `package.json` and installed in your `node_modules`:

```jsonc
// package.json
{
  "devDependencies": {
    "tailwindcss": "^4.0.0"
    // ... Tailwind plugins like @tailwindcss/forms, etc.
  }
}
```

## Configuration

### Workspace Settings (`.vscode/settings.json`)

It's recommended to configure the following settings in your project's `.vscode/settings.json` file:

```jsonc
{
  // Optional: Specify the path to your Tailwind v4 CSS-first configuration file.
  // This is necessary if you use Tailwind plugins, so the sorter
  // can correctly recognize and order plugin-provided classes.
  // The file should contain `@import "tailwindcss";` and may contain `@plugin` imports
  // If this is not set, `node_modules/tailwindcss/theme.css` is used
  "tailwindCssClojureClassSorter.tailwindCssPath": "src/index.css",

  // Optional: Automatically run the sorter on save.
  "editor.codeActionsOnSave": {
    "source.sortTailwindClasses": "always" // or "explicit"
  }
}
```

### Global VSCode Settings (for Tailwind CSS IntelliSense)

To enhance your development experience with Tailwind CSS in Clojure, it's highly recommended to configure the official [Tailwind CSS IntelliSense extension](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss). Add the following to your global `settings.json`:

```jsonc
{
  // Tell the Tailwind extension to treat Clojure(Script) files like HTML
  "tailwindCSS.includeLanguages": {
    "clojure": "html"
  },
  // Configure class detection patterns for Clojure
  "[clojure]": {
    "tailwindCSS.experimental.classRegex": [
      // Matches: :class "cls-1 cls-2 ..."
      ":class\\s+\"([^\"]+)\"",
      // Matches: ^:tw "cls-1 cls-2 ..."
      "\\^:tw\\s+\"([^\"]+)\"",
      // Matches classes in Hiccup-style vectors:
      // [:div#id.cls-1.cls-2 ...]
      // [:#id.cls-1.cls-2 ...]
      // [:.cls-1.cls-2 ...]
      ["\\[:[\\w-]*(?:#[\\w-]+)?((?:\\.[\\w-]+)+)(?=[\\s\\]])", "\\.([\\w-]+)"],
      // Matches keyword selectors:
      // :.cls-1.cls-2
      [":((?:\\.[\\w-]+)+)", "\\.([\\w-]+)"]
    ]
  }
}
```

## Supported Class Formats for Sorting

This extension specifically targets and sorts classes within strings matching the patterns used by the Tailwind CSS IntelliSense extension's `classRegex`. (Currently this is not dynamic. The 4 regexes used above are hard-coded in this extension.)

**Examples:**

1.  **:class attribute:**

    ```clojure
    ;; Before:
    [:div {:class "text-white p-4 m-2 border rounded bg-blue-500"}]
    ;; After:
    [:div {:class "m-2 rounded border bg-blue-500 p-4 text-white"}]
    ```

2.  **^:tw metadata:**
    _Note: This is useful when using Tailwind class strings inside of arbitrary forms or even outside of hiccup templates altogether._

    ```clojure
    ;; Before:
    (let [base-classes "p-4 m-2 border rounded" ; Will not be sorted due to missing ^:tw
          active-classes ^:tw "text-white bg-blue-500"] ; Strings marked with ^:tw will be sorted
      [:button {:class (str base-classes " " (when active? active-classes))}])
    ;; After:
    (let [base-classes "p-4 m-2 border rounded" ; Unsorted
          active-classes ^:tw "bg-blue-500 text-white"] ; Sorted
      [:button {:class (str base-classes " " (when active? active-classes))}])
    ```

3.  **Hiccup class shorthand:**

    ```clojure
    ;; Before:
    [:button#submit.text-white.p-4.m-2.border.rounded.bg-blue-500 "Save"]
    ;; After:
    [:button#submit.m-2.rounded.border.bg-blue-500.p-4.text-white "Save"]

    ;; Before:
    [:.text-white.p-4.m-2.border.rounded.bg-blue-500]
    ;; After:
    [:.m-2.rounded.border.bg-blue-500.p-4.text-white]
    ```

4.  **Keyword selectors:**
    ```clojure
    ;; Before:
    (let [button-class (if primary?
                         :.text-white.p-4.m-2.border.rounded.bg-blue-500
                         :.p-2.border)]
      [:button {:class button-class} "Action"])
    ;; After:
    (let [button-class (if primary?
                         :.m-2.rounded.border.bg-blue-500.p-4.text-white
                         :.border.p-2)]
      [:button {:class button-class} "Action"])
    ```

## License

This extension is licensed under the [MIT License](./LICENSE).
