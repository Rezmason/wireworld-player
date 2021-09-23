import { params } from "./utils.js";
import { collectUI, makeEventTarget, isUIElement, makeSlider, mapKeyToMouseEvent } from "./gui-utils.js";

const a11y = params.a11y ?? params.accessibility ?? false;
if (a11y) {
	document.body.classList.remove("wwgui");
}

const state = {};
const events = makeEventTarget();
const stateChangedEvent = new Event("statechanged");
const advanceEvent = new Event("advance");

const buttons = collectUI("button");
const checkboxes = collectUI("input[type=checkbox]");
const selects = collectUI("select");
const options = collectUI("option");
const labels = collectUI("label");
const rangeInputs = collectUI("input[type=range]");
const popups = collectUI("popup");
const popupRoot = document.querySelector("popup-root");

const initialState = {
	playing: false,
	playingUnderPopup: false,
	turbo: checkboxes.turbo.checked,
	speed: parseFloat(rangeInputs.speed.value),
	engineName: (options[params.engine] ?? options.macrocell).value,
};

const hidePopup = () => {
	if (state.currentPopup != null) {
		state.currentPopup.classList.remove("onscreen");
		state.currentPopup = null;
		state.playing = state.playingUnderPopup;
		state.playingUnderPopup = false;
		popupRoot.classList.remove("onscreen");
		events.dispatchEvent(stateChangedEvent);
		if (state.lastFocusedElement != null) {
			state.lastFocusedElement.focus();
			state.lastFocusedElement = null;
		}
	}
};

const showPopup = (popup) => {
	hidePopup();
	const lastFocusedElement = document.activeElement;
	if (isUIElement(lastFocusedElement) && !popupRoot.contains(lastFocusedElement)) {
		state.lastFocusedElement = lastFocusedElement;
	}
	state.playingUnderPopup = state.playing;
	state.playing = false;
	state.currentPopup = popup;
	popupRoot.classList.add("onscreen");
	popup.classList.add("onscreen");
	events.dispatchEvent(stateChangedEvent);
	if (state.lastFocusedElement != null) {
		Array.from(popup.querySelectorAll("a, button, input")).pop()?.focus();
	}
};

popupRoot.addEventListener("click", ({ target }) => {
	if (!state.splash && target === popupRoot) {
		hidePopup();
	}
});

Object.values(popups).forEach((popup) => {
	Array.from(popup.querySelectorAll("button.close-popup")).forEach((button) => {
		button.addEventListener("click", () => hidePopup());
	});
});

popups.confirm_reset.querySelector("button.reset-ok").addEventListener("click", () => {
	state.playingUnderPopup = false;
	hidePopup();
	events.dispatchEvent(new Event("resetsim"));
});

const showLoadFromFile = (file) => {
	state.file = file;
	state.url = null;
	popups.loading.querySelector(".title").textContent = `Loading ${state.file.name}`;
	showPopup(popups.loading);
	events.dispatchEvent(new Event("load"));
};

const filePicker = document.createElement("input");
filePicker.type = "file";
filePicker.accept = ".mcl,.rle,.txt";
filePicker.addEventListener("change", () => {
	showLoadFromFile(filePicker.files[0]);
});

document.addEventListener("dragenter", (event) => {
	// Ignore drag events if a popup is open
	if (state.currentPopup != null) {
		return;
	}

	// TODO: look at file name and mimetype, maybe decide whether to accept it

	event.preventDefault();
	document.body.classList.toggle("accepting_drag", true);
	showPopup(popups.drag_and_drop);
});

document.addEventListener("dragover", (event) => {
	event.preventDefault();
});

document.addEventListener("dragleave", (event) => {
	event.preventDefault();
	if (event.target === document.body) {
		hidePopup();
		document.body.classList.toggle("accepting_drag", false);
	}
});

document.addEventListener("drop", (event) => {
	event.preventDefault();
	hidePopup();
	document.body.classList.toggle("accepting_drag", false);
	showLoadFromFile(event.dataTransfer.files[0]);
});

const speedSlider = makeSlider(buttons.slow, buttons.fast, rangeInputs.speed, 0.01, "BracketLeft", "BracketRight");
speedSlider.addEventListener("change", () => {
	state.speed = speedSlider.value;
	events.dispatchEvent(stateChangedEvent);
});

Object.values(labels).forEach((label) => {
	const textSpan = label.querySelector(".wwguitext");
	label.setText = (text) => {
		textSpan.textContent = text;
		label.text = text;
	};
	label.setText("");
});

const listenToButton = (id, keyMapping, func) => {
	const button = buttons[id];
	button.addEventListener("click", func);
	if (keyMapping != null) {
		mapKeyToMouseEvent(button, keyMapping);
	}
};

const listenToCheckbox = (id, keyMapping, func) => {
	const checkbox = checkboxes[id];
	checkbox.addEventListener("change", func);
	if (keyMapping != null) {
		mapKeyToMouseEvent(checkbox, keyMapping);
	}
};

listenToButton("stop", "Backquote", () => {
	showPopup(popups.confirm_reset);
});

listenToButton("play_pause", "Space", () => {
	state.playing = !state.playing;
	events.dispatchEvent(stateChangedEvent);
});

listenToButton("step", "Period", () => {
	events.dispatchEvent(advanceEvent);
});

listenToCheckbox("turbo", "KeyT", () => {
	state.turbo = checkboxes.turbo.checked;
	events.dispatchEvent(stateChangedEvent);
});

selects.engine.value = state.engineName;
selects.engine.addEventListener("input", (event) => {
	state.engineName = selects.engine.value;
	events.dispatchEvent(stateChangedEvent);
});

listenToButton("snapshot", null, () => {
	// TODO: copy current canvas to a PNG and download it
});

listenToButton("help", null, () => {
	showPopup(popups.help);
});

listenToButton("about", null, () => {
	showPopup(popups.about);
});

listenToButton("load", "KeyL", () => {
	filePicker.click();
});

const setFilePath = (path) => {
	labels.file_name.setText(path);
};

const reset = (filename) => {
	const { speed, turbo, engineName } = state;
	Object.assign(state, initialState);
	if (speed != null) {
		state.speed = speed;
	}
	if (turbo != null) {
		state.turbo = turbo;
		checkboxes.turbo.checked = state.turbo;
	}
	if (engineName != null) {
		state.engineName = engineName;
		selects.engine.value = state.engineName;
	}
	setFilePath(filename);
};

const showAboutPopup = (initial) => {
	state.splash = initial;
	popups.about.classList.toggle("splash", initial);
	showPopup(popups.about);
};

const hideAboutPopup = () => {
	state.splash = false;
	popups.about.classList.toggle("splash", false);
	if (state.currentPopup === popups.about) {
		hidePopup();
	}
};

const showErrorPopup = (titleText, subtitleText, bodyText) => {
	popups.error.querySelector(".title").textContent = titleText;
	popups.error.querySelector(".subtitle").textContent = subtitleText;
	popups.error.querySelector("content").textContent = bodyText;
	showPopup(popups.error);
};

const hideLoadingPopup = () => {
	if (state.currentPopup === popups.loading) {
		hidePopup();
	}
};

reset("");

const gui = {
	reset,
	events,
	state,
	showErrorPopup,
	showAboutPopup,
	hideAboutPopup,
	hideLoadingPopup,
};

export { gui };
