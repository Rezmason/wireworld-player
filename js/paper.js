import { CellState } from "./data.js";
import { collectUI } from "./gui-utils.js";
import { setPanZoomSize } from "./pan-zoom.js";
import themes from "./themes.js";

const labels = collectUI("label");
const canvases = collectUI("canvas");

let theme = themes["circuit"];
let drawings;
let cellGridIndices;
let lastHeadIDs = [];
let lastTailIDs = [];

const initialize = (themeName, data) => {
	const { width, height } = data;
	cellGridIndices = data.cellGridIndices;
	theme = themes[themeName];
	const numBytes = width * height * 4;
	drawings = Object.fromEntries(
		Object.entries(canvases).map(([id, canvas]) => {
			canvas.width = width;
			canvas.height = height;
			canvas.style.width = width;
			canvas.style.height = height;
			const context = canvas.getContext("2d");
			const imageData = context.createImageData(width, height);
			const pixels = new Uint32Array(imageData.data.buffer);
			return [id, { canvas, context, imageData, pixels }];
		})
	);

	drawBaseLayer();

	labels.generation.setText("0");
	labels.simulation_speed.setText("---");

	if (!data.isRestore) {
		setPanZoomSize(width, height);
	}
};

const drawBaseLayer = () => {
	const basePixels = drawings.base.pixels;
	const wireColor = theme.wire;
	basePixels.fill(theme.dead);
	for (let i = 0, len = cellGridIndices.length; i < len; i++) {
		basePixels[cellGridIndices[i]] = wireColor;
	}

	drawings.base.context.putImageData(drawings.base.imageData, 0, 0);
};

const update = ({ generation, simulationSpeed, width, height, headIDs, tailIDs }) => {
	const activePixels = drawings.active.pixels;
	const activeImageData = drawings.active.imageData;

	labels.generation.setText(generation);
	labels.simulation_speed.setText(simulationSpeed);

	for (let i = 0, len = lastHeadIDs.length; i < len; i++) {
		activePixels[cellGridIndices[lastHeadIDs[i]]] = 0x0;
	}

	for (let i = 0, len = lastTailIDs.length; i < len; i++) {
		activePixels[cellGridIndices[lastTailIDs[i]]] = 0x0;
	}

	lastHeadIDs = headIDs;
	lastTailIDs = tailIDs;

	const tailColor = theme.tail;
	const headColor = theme.head;

	for (let i = 0, len = lastHeadIDs.length; i < len; i++) {
		activePixels[cellGridIndices[lastHeadIDs[i]]] = headColor;
	}

	for (let i = 0, len = lastTailIDs.length; i < len; i++) {
		activePixels[cellGridIndices[lastTailIDs[i]]] = tailColor;
	}

	drawings.active.context.putImageData(activeImageData, 0, 0);
};

const paper = {
	initialize,
	update,
};

export { paper };
