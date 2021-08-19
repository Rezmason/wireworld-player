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

const deadColor = formatColorForEndian(/*0x224400ff*/ 0x000000ff);
const wireColor = formatColorForEndian(/*0x448822ff*/ 0x505050ff);
const tailColor = formatColorForEndian(/*0xffdd22ff*/ 0xffee00ff);
const headColor = formatColorForEndian(/*0xffff44ff*/ 0xff8800ff);

let drawings;
let gridIndices;

const initialize = (data) => {
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
			const pixels = new Uint32Array(imageData.data.buffer);
			return [id, { canvas, context, imageData, pixels }];
		})
	);

	const baseDrawing = drawings.base;
	baseDrawing.pixels.fill(deadColor);
	for (let y = 0; y < height; y++) {
		if (cellStates[y] != null) {
			for (let x = 0; x < width; x++) {
				const color = (cellStates[y][x] ?? CellState.DEAD) === CellState.DEAD ? deadColor : wireColor;
				const pixelIndex = y * width + x;
				baseDrawing.pixels[pixelIndex] = color;
			}
		}
	}
	baseDrawing.context.putImageData(baseDrawing.imageData, 0, 0);

	labels.generation.setText("0");
	labels.simulation_speed.setText("---");

	setPanZoomSize(width, height);
};

const setGridIndices = (indices) => {
	gridIndices = indices;
};

const update = ({ generation, simulationSpeed, width, height, headIDs, tailIDs }) => {
	const activeDrawing = drawings.active;

	labels.generation.setText(generation);
	labels.simulation_speed.setText(simulationSpeed);

	activeDrawing.pixels.fill(0x00000000);

	const numHeads = headIDs.length;
	for (let i = 0; i < numHeads; i++) {
		activeDrawing.pixels[gridIndices[headIDs[i]]] = headColor;
	}

	const numTails = tailIDs.length;
	for (let i = 0; i < numTails; i++) {
		activeDrawing.pixels[gridIndices[tailIDs[i]]] = tailColor;
	}

	activeDrawing.context.putImageData(activeDrawing.imageData, 0, 0);
	drawings.glow.context.putImageData(activeDrawing.imageData, 0, 0);
};

const paper = {
	initialize,
	update,
	setGridIndices,
};

export { paper };
