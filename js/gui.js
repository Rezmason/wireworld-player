import { CellState } from "./data.js";
import { makeSlider } from "./gui-utils.js";
import { setPanZoomSize } from "./pan-zoom.js";

const events = new EventTarget();

const colorsByCellState = {
	[CellState.DEAD]: [0x22, 0x44, 0x00, 0xff] /*[0x00, 0x00, 0x00, 0xff],*/,
	[CellState.WIRE]: [0x44, 0x88, 0x22, 0xff] /*[0x50, 0x50, 0x50, 0xff],*/,
	[CellState.TAIL]: [0xff, 0xdd, 0x22, 0xff] /*[0xff, 0xee, 0x00, 0xff],*/,
	[CellState.HEAD]: [0xff, 0xff, 0x44, 0xff] /*[0xff, 0x88, 0x00, 0xff],*/
};

const collectUI = query =>
	Object.fromEntries(
		Array.from(document.querySelectorAll(query)).map(element => [
			element.id.replace(/-/g, "_"),
			element
		])
	);

const buttons = collectUI("button");
const labels = collectUI("label");
const rangeInputs = collectUI("input[type=range]");
const paper = document.querySelector("drag-region paper");
const canvases = collectUI("canvas");

const speedSlider = makeSlider(buttons.fast, buttons.slow, rangeInputs.speed);

Object.values(labels).forEach(label => {
	const textSpan = label.querySelector(".wwguitext");
	label.setText = text => {
		textSpan.textContent = text;
		label.text = text;
	};
	label.setText("");
});

Object.entries(buttons).forEach(([id, button]) => {
	const event = new Event(id);
	button.addEventListener("click", () => events.dispatchEvent(event));
});

const setFilePath = path => {
	labels.file_name.setText(path);
};

const setPaper = data => {
	const { width, height, cells } = data;

	canvases.lower.width = width;
	canvases.lower.height = height;
	canvases.upper.width = width;
	canvases.upper.height = height;

	const lowerCtx = canvases.lower.getContext("2d");
	const upperCtx = canvases.upper.getContext("2d");

	const lowerData = lowerCtx.createImageData(width, height);
	const lowerPixels = lowerData.data;
	const upperData = upperCtx.createImageData(width, height);
	const upperPixels = upperData.data;

	const deadColor = colorsByCellState[CellState.DEAD];
	const wireColor = colorsByCellState[CellState.WIRE];
	const tailColor = colorsByCellState[CellState.TAIL];
	const headColor = colorsByCellState[CellState.HEAD];

	for (let i = 0; i < height; i++) {
		if (cells[i] != null) {
			for (let j = 0; j < width; j++) {
				const state = cells[i][j] ?? CellState.DEAD;
				const index = (i * width + j) * 4;
				lowerPixels.set(
					state === CellState.DEAD ? deadColor : wireColor,
					index
				);
				if (state === CellState.TAIL) {
					upperPixels.set(tailColor, index);
				}
				if (state === CellState.HEAD) {
					upperPixels.set(headColor, index);
				}
			}
		}
	}

	lowerCtx.putImageData(lowerData, 0, 0);
	upperCtx.putImageData(upperData, 0, 0);

	setPanZoomSize(width, height);
};

export default {
	setFilePath,
	setPaper,
	events
};
