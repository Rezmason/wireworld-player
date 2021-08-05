import { CellState } from "./data.js";
import { makeEventTarget, isUIElement, makeSlider, mapKeyToMouseEvent } from "./gui-utils.js";
import { setPanZoomSize } from "./pan-zoom.js";

const params = new URL(document.location).searchParams;
const a11y = params.has("a11y") || params.has("accessibility");
if (a11y) {
	document.body.classList.remove("wwgui");
}

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

const initialState = {
	generation: 0,
	playing: false,
	playingUnderPopup: false,
	turbo: checkboxes.turbo.checked,
	speed: parseFloat(rangeInputs.speed.value),
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

const deadColor = formatColorForEndian(/*0x224400ff*/ 0x000000ff);
const wireColor = formatColorForEndian(/*0x448822ff*/ 0x505050ff);
const tailColor = formatColorForEndian(/*0xffdd22ff*/ 0xffee00ff);
const headColor = formatColorForEndian(/*0xffff44ff*/ 0xff8800ff);

const statesToColors = new Map([
	[CellState.DEAD, deadColor],
	[CellState.WIRE, wireColor],
	[CellState.TAIL, tailColor],
	[CellState.HEAD, headColor],
]);

let drawings;

const initializePaper = (data) => {
	const { width, height, cellStates } = data;
	const numBytes = width * height * 4;
	drawings = Object.fromEntries(
		Object.entries(canvases).map(([id, canvas]) => {
			canvas.width = width;
			canvas.height = height;
			canvas.style.width = width;
			canvas.style.height = height;
			const context = canvas.getContext("2d");
			const imageData = context.createImageData(width, height);
			const buffer = new ArrayBuffer(numBytes);
			const pixels = new Uint32Array(buffer);
			const pixelBytes = new Uint8ClampedArray(buffer);
			return [id, { canvas, context, imageData, buffer, pixels, pixelBytes }];
		})
	);

	const baseDrawing = drawings.base;
	baseDrawing.pixels.fill(statesToColors.get(CellState.DEAD));
	for (let y = 0; y < height; y++) {
		if (cellStates[y] != null) {
			for (let x = 0; x < width; x++) {
				const state = (cellStates[y][x] ?? CellState.DEAD) === CellState.DEAD ? CellState.DEAD : CellState.WIRE;
				const color = statesToColors.get(state);
				const pixelIndex = y * width + x;
				baseDrawing.pixels[pixelIndex] = color;
			}
		}
	}
	baseDrawing.imageData.data.set(baseDrawing.pixelBytes);
	baseDrawing.context.putImageData(baseDrawing.imageData, 0, 0);

	labels.generation.setText(state.generation);

	setPanZoomSize(width, height);
};

const updatePaper = (generation, width, height, headIndices, tailIndices) => {
	const activeDrawing = drawings.active;

	if (state.generation !== generation) {
		state.generation = generation;
		labels.generation.setText(state.generation);
	}

	activeDrawing.pixels.fill(0x00000000);

	const headColor = statesToColors.get(CellState.HEAD);
	const numHeadIndices = headIndices.length;
	for (let i = 0; i < numHeadIndices; i++) {
		activeDrawing.pixels[headIndices[i]] = headColor;
	}

	const tailColor = statesToColors.get(CellState.TAIL);
	const numTailIndices = tailIndices.length;
	for (let i = 0; i < numTailIndices; i++) {
		activeDrawing.pixels[tailIndices[i]] = tailColor;
	}

	activeDrawing.imageData.data.set(activeDrawing.pixelBytes);
	activeDrawing.context.putImageData(activeDrawing.imageData, 0, 0);
};

const reset = (filename) => {
	const speed = state.speed;
	Object.assign(state, initialState);
	if (speed != null) {
		state.speed = speed;
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
	initializePaper,
	updatePaper,
	events,
	state,
	showErrorPopup,
	showAboutPopup,
	hideAboutPopup,
	hideLoadingPopup,
};

export { gui };
