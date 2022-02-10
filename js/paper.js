import { CellState } from "./data.js";
import { collectUI } from "./gui-utils.js";
import { setPanZoomSize } from "./pan-zoom.js";

const labels = collectUI("label");
const canvases = collectUI("canvas");

const numberFormatter = new Intl.NumberFormat();
const cellGridIndicesByWorkerName = new Map();
let theme = null;
let themeChanged = false;
let drawings;
let lastWorkerName = null;
let lastHeadIDs = [];
let lastTailIDs = [];

const reset = () => {
	cellGridIndicesByWorkerName.clear();
	lastWorkerName = null;
	lastHeadIDs = [];
	lastTailIDs = [];
};

const setTheme = (newTheme) => {
	theme = newTheme;
	themeChanged = true;
	if (lastWorkerName != null) {
		update({ name: lastWorkerName, headIDs: lastHeadIDs, tailIDs: lastTailIDs });
	}
};

const drawBackground = () => {
	const name = Array.from(cellGridIndicesByWorkerName.keys())[0];
	const cellGridIndices = cellGridIndicesByWorkerName.get(name);
	const basePixels = drawings.base.pixels;
	const wireColor = theme.wire;
	basePixels.fill(theme.dead);
	for (let i = 0, len = cellGridIndices.length; i < len; i++) {
		basePixels[cellGridIndices[i]] = wireColor;
	}

	drawings.base.context.putImageData(drawings.base.imageData, 0, 0);
};

const registerWorker = (data) => {
	const { width, height } = data;
	cellGridIndicesByWorkerName.set(data.name, data.cellGridIndices);

	if (cellGridIndicesByWorkerName.size > 1) {
		return;
	}

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

	labels.generation.setText("0");
	labels.simulation_speed.setText("---");

	if (!data.isRestore) {
		setPanZoomSize(width, height);
	}

	drawBackground();
};

const update = ({ name, generation, turboSpeed, width, height, headIDs, tailIDs }) => {
	if (!cellGridIndicesByWorkerName.has(name)) {
		return;
	}

	if (themeChanged) {
		themeChanged = false;
		drawBackground();
	}

	const activePixels = drawings.active.pixels;
	const activeImageData = drawings.active.imageData;

	if (lastWorkerName !== null) {
		const lastCellGridIndices = cellGridIndicesByWorkerName.get(lastWorkerName);

		if (generation != null) {
			labels.generation.setText(numberFormatter.format(generation));
		}

		if (turboSpeed != null) {
			labels.simulation_speed.setText(turboSpeed > 0 ? numberFormatter.format(Math.round(1000 * turboSpeed)) : "---");
		}

		for (let i = 0, len = lastHeadIDs.length; i < len; i++) {
			activePixels[lastCellGridIndices[lastHeadIDs[i]]] = 0x0;
		}

		for (let i = 0, len = lastTailIDs.length; i < len; i++) {
			activePixels[lastCellGridIndices[lastTailIDs[i]]] = 0x0;
		}
	}

	lastWorkerName = name;
	lastHeadIDs = headIDs;
	lastTailIDs = tailIDs;

	const cellGridIndices = cellGridIndicesByWorkerName.get(name);

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
	reset,
	registerWorker,
	update,
	setTheme,
};

export { paper };
