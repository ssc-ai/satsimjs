import { defined, getElement } from "cesium"

let comboMenuStylesInjected = false;

function ensureComboMenuStyles() {
  if (comboMenuStylesInjected || typeof document === "undefined" || !document.head) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .satsim-toolbar-combo-menu::-webkit-scrollbar {
      width: 8px;
    }
    .satsim-toolbar-combo-menu::-webkit-scrollbar-track {
      background: #000;
    }
    .satsim-toolbar-combo-menu::-webkit-scrollbar-thumb {
      background: #4c5358;
    }
    .satsim-toolbar-combo-menu::-webkit-scrollbar-thumb:hover {
      background: #666f76;
    }
  `;
  document.head.appendChild(style);
  comboMenuStylesInjected = true;
}

function styleComboOption(element, selected, disabled) {
  element.style.background = selected ? "#2f5f88" : "#000";
  element.style.color = disabled ? "rgba(255, 255, 255, 0.55)" : "#fff";
}

/**
 * A toolbar widget for adding buttons, menus, and separators.
 *
 * @constructor
 * @param {Element|String} container The DOM element or ID that will contain the toolbar.
 */
function Toolbar(container) {
  this._container = getElement(container)
}

/**
 * Clears the toolbar.
 */
Toolbar.prototype.clear = function () {
  this._container.innerHTML = "";
}

/**
 * Adds a separator to the toolbar.
 */
Toolbar.prototype.addSeparator = function () {
  const separator = document.createElement("br");
  this._container.appendChild(separator);
}

/**
 * Adds a toggle button to the toolbar.
 *
 * @param {String} text The text label for the button.
 * @param {Boolean} checked Whether the button is initially checked.
 * @param {Function} onchange The function to call when the button is toggled.
 * @returns {HTMLInputElement} The input element for the toggle button.
 */
Toolbar.prototype.addToggleButton = function (text, checked, onchange) {
  const input = document.createElement("input");
  input.checked = checked;
  input.type = "checkbox";
  input.style.pointerEvents = "none";
  const label = document.createElement("label");
  label.appendChild(input);
  label.appendChild(document.createTextNode(text));
  label.style.pointerEvents = "none";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cesium-button";
  button.appendChild(label);
  button.onclick = function () {
    input.checked = !input.checked;
    onchange(input.checked);
  };
  this._container.appendChild(button);

  input.enable = function(value) {
    input.disabled = !value;
    button.disabled = !value;
  }

  return input;
}

/**
 * Adds a button to the toolbar.
 *
 * @param {String} text The text label for the button.
 * @param {Function} onclick The function to call when the button is clicked.
 * @returns {HTMLButtonElement} The button element.
 */
Toolbar.prototype.addToolbarButton = function (text, onclick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cesium-button";
    button.onclick = function () {
      onclick();
    };
    button.textContent = text;
    this._container.appendChild(button);

    button.enable = function(value) {
      button.disabled = !value;
    }

    return button;
}

/**
 * Adds an input field to the toolbar.
 *
 * @param {string} placeholder The placeholder text.
 * @param {Function} [oninput] Optional input-change callback.
 * @returns {HTMLInputElement} The input element.
 */
Toolbar.prototype.addToolbarInput = function (placeholder, oninput) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "cesium-button";
  input.placeholder = placeholder ?? "";
  if (typeof oninput === "function") {
    input.addEventListener("input", function () {
      oninput(input.value);
    });
  }
  input.enable = function(value) {
    input.disabled = !value;
  }
  this._container.appendChild(input);
  return input;
}

/**
 * Adds a combined input + dropdown menu control.
 *
 * @param {string} placeholder Placeholder text for the input.
 * @returns {{container: HTMLDivElement, input: HTMLInputElement, menu: HTMLSelectElement, enable: Function, showMenu: Function, hideMenu: Function}}
 */
Toolbar.prototype.addToolbarComboMenu = function (placeholder) {
  ensureComboMenuStyles();

  const container = document.createElement("div");
  container.style.position = "relative";
  container.style.display = "inline-block";
  container.style.verticalAlign = "top";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "cesium-button";
  input.placeholder = placeholder ?? "";
  input.autocomplete = "off";
  input.style.minWidth = "180px";
  container.appendChild(input);

  const menu = document.createElement("div");
  menu.className = "satsim-toolbar-combo-menu";
  menu._satsimComboMenu = true;
  menu._satsimOptionElements = [];
  menu.userOptions = [];
  menu.tabIndex = -1;
  menu.setAttribute("role", "listbox");
  menu.style.position = "absolute";
  menu.style.left = "0";
  menu.style.top = "calc(100% + 2px)";
  menu.style.minWidth = "100%";
  menu.style.maxHeight = "176px";
  menu.style.overflowY = "auto";
  menu.style.overflowX = "hidden";
  menu.style.zIndex = "1000";
  menu.style.display = "none";
  menu.style.background = "#000";
  menu.style.color = "#fff";
  menu.style.border = "0";
  menu.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.7)";
  menu.style.outline = "none";
  menu.style.padding = "4px 0";
  menu.style.scrollbarColor = "#4c5358 #000";
  menu.style.scrollbarWidth = "thin";

  let selectedIndex = -1;
  menu._satsimSetSelectedIndex = function(index) {
    const normalizedIndex = Number.isFinite(index) ? index : -1;
    selectedIndex = normalizedIndex;
    for (let i = 0; i < menu._satsimOptionElements.length; i++) {
      const optionElement = menu._satsimOptionElements[i];
      const option = menu.userOptions[i];
      const selected = i === selectedIndex;
      optionElement.setAttribute("aria-selected", selected ? "true" : "false");
      styleComboOption(optionElement, selected, !!option?.disabled);
    }
    const selectedElement = menu._satsimOptionElements[selectedIndex];
    if (selectedElement && typeof selectedElement.scrollIntoView === "function") {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  };

  Object.defineProperty(menu, "selectedIndex", {
    get: function() {
      return selectedIndex;
    },
    set: function(value) {
      menu._satsimSetSelectedIndex(Number(value));
    }
  });

  menu._satsimActivateIndex = function(index) {
    const item = menu.userOptions[index];
    if (!item || item.disabled) {
      return;
    }
    menu._satsimSetSelectedIndex(index);
    if (typeof item.onselect === "function") {
      item.onselect();
    }
    if (typeof menu.dispatchEvent === "function" && typeof Event === "function") {
      menu.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  menu.addEventListener("keydown", function(ev) {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp" && ev.key !== "Enter") {
      return;
    }

    if (ev.key === "Enter") {
      menu._satsimActivateIndex(menu.selectedIndex);
      ev.preventDefault();
      return;
    }

    const direction = ev.key === "ArrowDown" ? 1 : -1;
    let nextIndex = menu.selectedIndex;
    for (let i = 0; i < menu.userOptions.length; i++) {
      nextIndex += direction;
      if (nextIndex < 0) {
        nextIndex = menu.userOptions.length - 1;
      } else if (nextIndex >= menu.userOptions.length) {
        nextIndex = 0;
      }
      if (!menu.userOptions[nextIndex]?.disabled) {
        menu._satsimSetSelectedIndex(nextIndex);
        break;
      }
    }
    ev.preventDefault();
  });
  container.appendChild(menu);

  const combo = {
    container,
    input,
    menu,
    enable: function(value) {
      const enabled = !!value;
      input.disabled = !enabled;
      menu.disabled = !enabled;
      menu.setAttribute("aria-disabled", enabled ? "false" : "true");
      if (!enabled) {
        menu.style.display = "none";
      }
    },
    showMenu: function() {
      if (!menu.disabled) {
        menu.style.display = "block";
        if (menu.selectedIndex < 0 && menu.userOptions.length > 0) {
          menu._satsimSetSelectedIndex(0);
        }
      }
    },
    hideMenu: function() {
      menu.style.display = "none";
    }
  };

  this._container.appendChild(container);
  return combo;
}

/**
 * Adds a menu to the toolbar.
 *
 * @param {Object[]} options The menu options.
 * @param {String} options[].text The text label for the menu option.
 * @param {String} options[].value The value for the menu option.
 * @param {Object} [menu] The existing menu element to add options to.
 * @returns {HTMLSelectElement} The menu element.
 */
Toolbar.prototype.addToolbarMenu = function (options, menu) {
  if (!defined(menu)) {
    menu = document.createElement("select");
    menu.className = "cesium-button";
    menu.userOptions = [];
    menu.enable = function(value) {
      menu.disabled = !value;
    }
    menu.onchange = function () {
      const item = menu.userOptions[menu.selectedIndex];
      if (item && typeof item.onselect === "function") {
        item.onselect();
      }
    };
    this._container.appendChild(menu);
  }

  if (menu._satsimComboMenu) {
    const startingIndex = Array.isArray(menu.userOptions) ? menu.userOptions.length : 0;
    if (startingIndex === 0) {
      menu._satsimOptionElements = [];
      menu._satsimSetSelectedIndex(-1);
    }
    menu.userOptions.push(...options);

    for (let i = 0, len = options.length; i < len; ++i) {
      const optionIndex = startingIndex + i;
      const option = options[i];
      const optionElement = document.createElement("div");
      optionElement.setAttribute("role", "option");
      optionElement.textContent = option.text;
      optionElement.style.padding = "2px 16px";
      optionElement.style.lineHeight = "18px";
      optionElement.style.whiteSpace = "nowrap";
      optionElement.style.cursor = option.disabled ? "default" : "pointer";
      optionElement.style.userSelect = "none";
      styleComboOption(optionElement, false, !!option.disabled);

      optionElement.addEventListener("mousemove", function() {
        if (!option.disabled) {
          menu._satsimSetSelectedIndex(optionIndex);
        }
      });
      optionElement.addEventListener("mousedown", function(ev) {
        ev.preventDefault();
      });
      optionElement.addEventListener("click", function() {
        menu._satsimActivateIndex(optionIndex);
      });

      menu._satsimOptionElements.push(optionElement);
      menu.appendChild(optionElement);
    }

    return menu;
  }

  menu.userOptions.push(...options)

  for (let i = 0, len = options.length; i < len; ++i) {
    const option = document.createElement("option");
    option.textContent = options[i].text;
    option.value = options[i].value;
    menu.appendChild(option);
  }
  
  return menu;
}

/**
 * Resets the toolbar.
 */
Toolbar.prototype.reset = function () { }

export default Toolbar;
