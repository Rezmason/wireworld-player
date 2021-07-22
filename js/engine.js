import { CellState } from "./data.js";

const minDelayMS = 10; // TODO: ought to be pinned to the RAF delay
const maxDelayMS = 1000;

let width, height, oldCells, newCells, originalCells, generation;
let playing = false,
	speed = 1,
	delayMS = minDelayMS,
	turbo = false;
let _render;

// Strategy 1: list all the cells that DO need to change (non-dead)
let nonDeadCells;

const initialize = (data, render) => {
	_render = render;
	width = data.width;
	height = data.height;
	originalCells = data.cells.map((row) => row.concat(Array(width - row.length).fill(CellState.DEAD)));
	nonDeadCells = [];

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (originalCells[y][x] !== CellState.DEAD) {
				nonDeadCells.push(y * width + x);
			}
		}
	}

	reset();
};

const setRhythm = (rhythmData) => {
	const wasPlaying = playing;
	({ playing, speed, turbo } = rhythmData);
	recomputeDelayMS();
	if (playing && !wasPlaying) {
		start();
	}
};

const recomputeDelayMS = () => {
	const x = Math.pow(speed, 1 / 5);
	delayMS = minDelayMS * x + maxDelayMS * (1 - x);
};

const start = () => {
	recomputeDelayMS();
	run();
};

const run = () => {
	advance();
	if (playing) {
		if (speed >= 1) {
			requestAnimationFrame(run);
		} else {
			setTimeout(run, delayMS);
		}
	}
};

const advance = () => {
	// Swap the old and new cells
	let swap = oldCells;
	oldCells = newCells;
	newCells = swap;

	// Strategy 1: for every non-dead cell,
	const numNonDeadCells = nonDeadCells.length;
	for (let i = 0; i < numNonDeadCells; i++) {
		const index = nonDeadCells[i];
		const x = index % width;
		const y = (index - x) / width;

		const oldState = oldCells[y][x];
		newCells[y][x] = oldState;
		// Apply the rules:
		switch (oldState) {
			case CellState.TAIL:
				// Tail --> Wire
				newCells[y][x] = CellState.WIRE;
				break;
			case CellState.HEAD:
				// Head --> Tail
				newCells[y][x] = CellState.TAIL;
				break;
			case CellState.WIRE:
				// Wire ?--> Head (1 or 2 head neighbors) : Wire
				let numHeadNeighbors = 0;
				neighborCounting: for (let yOffset = -1; yOffset < 2; yOffset++) {
					if (y + yOffset < 0 || y + yOffset >= height) {
						continue;
					}
					for (let xOffset = -1; xOffset < 2; xOffset++) {
						if (yOffset === 0 && xOffset === 0) {
							continue;
						}
						if (x + xOffset < 0 || x + xOffset >= width) {
							continue;
						}
						if (oldCells[y + yOffset][x + xOffset] === CellState.HEAD) {
							numHeadNeighbors++;
							if (numHeadNeighbors === 3) {
								break neighborCounting;
							}
						}
					}
				}
				if (numHeadNeighbors === 1 || numHeadNeighbors === 2) {
					newCells[y][x] = CellState.HEAD;
				}
				break;
		}
	}

	generation++;
	_render({ generation, width, height, cells: newCells, nonDeadCells });
};

const reset = () => {
	generation = 0;
	oldCells = originalCells.map((row) => row.slice());
	newCells = originalCells.map((row) => row.slice());
	_render({ generation, width, height, cells: newCells });
};

const engine = { initialize, setRhythm, advance, reset };

export { engine };
