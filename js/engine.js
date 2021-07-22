import { CellState } from "./data.js";

const minDelayMS = 10; // TODO: ought to be pinned to the RAF delay
const maxDelayMS = 1000;

let width, height, cells, numCells, originalCellStates, generation;
let playing = false,
	speed = 1,
	delayMS = minDelayMS,
	turbo = false;
let _render;

let totalTime;

const initialize = (data, render) => {
	_render = render;
	width = data.width;
	height = data.height;

	numCells = 0;
	cells = [];
	const cellGrid = Array(height)
		.fill()
		.map((_) => Array(width));

	data.cellStates.forEach((row, y) =>
		row.forEach((originalState, x) => {
			if (originalState == null || originalState === CellState.DEAD) {
				return;
			}

			const cell = { x, y, index: numCells, originalState, neighbors: [] };
			cells[numCells] = cell;
			cellGrid[y][x] = cell;
			numCells++;
		})
	);

	for (let i = 0; i < numCells; i++) {
		const cell = cells[i];
		const { x, y } = cell;
		meetNeighbors: for (let yOffset = -1; yOffset < 2; yOffset++) {
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
				const neighbor = cellGrid[y + yOffset][x + xOffset];
				if (neighbor != null) {
					cell.neighbors.push(neighbor);
				}
			}
			cell.numNeighbors = cell.neighbors.length;
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
	const start = performance.now();

	for (let i = 0; i < numCells; i++) {
		cells[i].oldState = cells[i].state;
	}

	// Strategy 2: for every cell,
	for (let i = 0; i < numCells; i++) {
		const cell = cells[i];

		// Apply the rules:
		switch (cell.oldState) {
			case CellState.TAIL:
				// Tail --> Wire
				cell.state = CellState.WIRE;
				break;
			case CellState.HEAD:
				// Head --> Tail
				cell.state = CellState.TAIL;
				break;
			case CellState.WIRE:
				// Wire ?--> Head (1 or 2 head neighbors) : Wire
				let numHeadNeighbors = 0;
				const numNeighbors = cell.numNeighbors;
				for (let j = 0; j < numNeighbors; j++) {
					if (cell.neighbors[j].oldState === CellState.HEAD) {
						numHeadNeighbors++;
						if (numHeadNeighbors === 3) {
							break;
						}
					}
				}
				if (numHeadNeighbors === 1 || numHeadNeighbors === 2) {
					cell.state = CellState.HEAD;
				}
				break;
		}
	}

	generation++;
	totalTime += performance.now() - start;
	_render({ generation, width, height, cells });
};

window.engineFrameTime = () => console.log(totalTime / (generation + 1).toFixed(3));

const reset = () => {
	generation = 0;
	totalTime = 0;
	cells.forEach((cell) => (cell.state = cell.originalState));
	_render({ generation, width, height, cells });
};

const engine = { initialize, setRhythm, advance, reset };

export { engine };
