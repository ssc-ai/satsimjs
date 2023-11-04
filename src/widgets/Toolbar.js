import { defined, getElement } from "cesium"

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