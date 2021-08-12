import { CellState } from "./data.js";
import { collectUI } from "./gui-utils.js";
import { setPanZoomSize } from "./pan-zoom.js";

const labels = collectUI("label");
const canvases = collectUI("canvas");

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

	labels.generation.setText("0");
	labels.simulation_speed.setText("---");

	setPanZoomSize(width, height);
};

const update = ({ generation, simulationSpeed, width, height, headIndices, tailIndices }) => {
	const activeDrawing = drawings.active;

	labels.generation.setText(generation);
	labels.simulation_speed.setText(simulationSpeed);

	activeDrawing.pixels.fill(0x00000000);

	const headColor = statesToColors.get(CellState.HEAD);
	const numHeads = headIndices.length;
	for (let i = 0; i < numHeads; i++) {
		activeDrawing.pixels[headIndices[i]] = headColor;
	}

	const tailColor = statesToColors.get(CellState.TAIL);
	const numTails = tailIndices.length;
	for (let i = 0; i < numTails; i++) {
		activeDrawing.pixels[tailIndices[i]] = tailColor;
	}

	activeDrawing.imageData.data.set(activeDrawing.pixelBytes);
	activeDrawing.context.putImageData(activeDrawing.imageData, 0, 0);
};

const paper = {
	initialize,
	update,
};

export { paper };
