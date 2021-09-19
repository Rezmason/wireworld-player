import { CellState } from "./data.js";
import { collectUI } from "./gui-utils.js";
import { setPanZoomSize } from "./pan-zoom.js";

const labels = collectUI("label");
const canvases = collectUI("canvas");

const isLittleEndian = (() => {
	const buf = new ArrayBuffer(2);
	new Uint16Array(buf)[0] = 1;
	return new Uint8ClampedArray(buf)[0] === 1;
})();

const formatColorForEndian = (rgba) => {
	if (isLittleEndian) {
		return parseInt(rgba.toString(0x10).padStart(8, "0").match(/..?/g).reverse().join(""), 16);
	}
	return rgba;
};

const makeTheme = (deadColor, wireColor, tailColor, headColor) => ({
	dead: formatColorForEndian(deadColor),
	wire: formatColorForEndian(wireColor),
	tail: formatColorForEndian(tailColor),
	head: formatColorForEndian(headColor),
});

const circuitTheme = makeTheme(0x224400ff, 0x448822ff, 0xffdd22ff, 0xffff44ff);
const classicTheme = makeTheme(0x000000ff, 0x505050ff, 0xffee00ff, 0xff8800ff);

let theme = circuitTheme;
let drawings;
let cellGridIndices;
let lastHeadIDs = [];
let lastTailIDs = [];

const initialize = (data) => {
	const { width, height } = data;
	cellGridIndices = data.cellGridIndices;
	if (data.theme != null) {
		theme = makeTheme(...data.theme);
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
