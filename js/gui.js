import { CellState } from "./data.js";
import { makeEventTarget, makeSlider, mapKeyToMouseEvent } from "./gui-utils.js";
import { setPanZoomSize } from "./pan-zoom.js";

const params = new URL(document.location).searchParams;
const a11y = params.has("a11y") || params.has("accessibility");
if (a11y) {
	document.body.classList.remove("wwgui");
}

const initialState = {
	playing: false,
	playingUnderPopup: false,
	turbo: false,
	speed: 0,
};

const state = {};
const events = makeEventTarget();
const stateChangedEvent = new Event("statechanged");
const advanceEvent = new Event("advance");

const collectUI = (query) =>
	Object.fromEntries(Array.from(document.querySelectorAll(query)).map((element) => [element.classList.item(0).replace(/-/g, "_"), element]));

const buttons = collectUI("button");
const checkboxes = collectUI("input[type=checkbox]");
const labels = collectUI("label");
const rangeInputs = collectUI("input[type=range]");
const paper = document.querySelector("drag-region paper");
const canvases = collectUI("canvas");
const popups = collectUI("popup");
const popupRoot = document.querySelector("popup-root");

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
	if (!popupRoot.contains(lastFocusedElement)) {
		state.lastFocusedElement = lastFocusedElement;
	}
	state.playingUnderPopup = state.playing;
	state.playing = false;
	state.currentPopup = popup;
	popupRoot.classList.add("onscreen");
	popup.classList.add("onscreen");
	events.dispatchEvent(stateChangedEvent);
	Array.from(popup.querySelectorAll("a, button, input")).pop()?.focus();
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

document.body.addEventListener("dragenter", (event) => {
	if (state.currentPopup != null) {
		return;
	}
	event.stopPropagation();
	event.preventDefault();
	showPopup(popups.drag_and_drop);
});

document.body.addEventListener("dragover", (event) => {
	event.stopPropagation();
	event.preventDefault();
});

document.body.addEventListener("drop", (event) => {
	if (state.currentPopup !== popups.drag_and_drop) {
		return;
	}
	event.stopPropagation();
	event.preventDefault();
	hidePopup();
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

checkboxes.turbo.addEventListener("change", () => {
	state.turbo = checkboxes.turbo.checked;
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

const testLittleEndian = () => {
	const buf = new ArrayBuffer(2);
	new Uint16Array(buf).set([0x0001], 0);
	return Array.from(new Uint8ClampedArray(buf))[0] === 1;
};

const isLittleEndian = testLittleEndian();

const formatColorForEndian = (rgba) => {
	if (isLittleEndian) {
		return (((rgba >> 0) & 0xff) << 24) | (((rgba >> 8) & 0xff) << 16) | (((rgba >> 16) & 0xff) << 8) | (((rgba >> 24) & 0xff) << 0);
	}
	return rgba;
};

const deadColor = formatColorForEndian(0x224400ff /*0x000000ff*/);
const wireColor = formatColorForEndian(0x448822ff /*0x505050ff*/);
const tailColor = formatColorForEndian(0xffdd22ff /*0xffee00ff*/);
const headColor = formatColorForEndian(0xffff44ff /*0xff8800ff*/);

const setPaper = (data) => {
	const { width, height, cells } = data;
	const numBytes = width * height * 4;

	const drawings = Object.fromEntries(
		Object.entries(canvases).map(([id, canvas]) => {
			canvas.width = width;
			canvas.height = height;
			canvas.style.width = width;
			canvas.style.height = height;
			const context = canvas.getContext("2d");
			const imageData = context.createImageData(width, height);
			const buffer = new ArrayBuffer(numBytes);
			const pixels = new Uint32Array(buffer);
			return [id, { context, imageData, buffer, pixels }];
		})
	);

	for (let i = 0; i < height; i++) {
		if (cells[i] != null) {
			for (let j = 0; j < width; j++) {
				const state = cells[i][j] ?? CellState.DEAD;
				const index = i * width + j;
				drawings.base.pixels[index] = state === CellState.DEAD ? deadColor : wireColor;
				if (state === CellState.TAIL) {
					drawings.tail.pixels[index] = tailColor;
				}
				if (state === CellState.HEAD) {
					drawings.head.pixels[index] = headColor;
				}
			}
		}
	}

	Object.values(drawings).forEach(({ imageData, buffer, context }) => {
		imageData.data.set(new Uint8ClampedArray(buffer));
		context.putImageData(imageData, 0, 0);
	});

	setPanZoomSize(width, height);
};

const reset = (filename) => {
	Object.assign(state, initialState);
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

export default {
	reset,
	setPaper,
	events,
	state,
	showErrorPopup,
	showAboutPopup,
	hideAboutPopup,
	hideLoadingPopup,
};
