import { CellState } from "./data.js";

const minDelayMS = 10; // TODO: ought to be pinned to the RAF delay
const maxDelayMS = 1000;

let width, height, cells, numCells, originalCellStates, generation;
let playing = false,
	speed = 1,
	delayMS = minDelayMS,
	turbo = false,
	count = 1,
	timeoutID;
let _render;

let totalTime;

const makeCell = (index, firstState, x, y) => {
	return {
		x,
		y,
		index,
		firstState,
		neighbors: [],
		numNeighbors: 0,
		next: null,
		headCount: 0,
		isWire: false,
	};
};

let firstHead = null;
let firstTail = null;

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
		row.forEach((firstState, x) => {
			if (firstState == null || firstState === CellState.DEAD) {
				return;
			}

			const cell = makeCell(numCells, firstState, x, y);
			cells[numCells] = cell;
			cellGrid[y][x] = cell;
			numCells++;
		})
	);

	for (const cell of cells) {
		const { x, y } = cell;
		for (let yOffset = -1; yOffset < 2; yOffset++) {
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
		}
		cell.numNeighbors = cell.neighbors.length;
	}

	reset();
};

const setRhythm = (rhythmData) => {
	const wasPlaying = playing;
	const wasTurbo = turbo;
	({ playing, speed, turbo } = rhythmData);
	count = turbo ? 96 : 1; // 6, 96, 192
	recomputeDelayMS();
	if (playing && !wasPlaying) {
		start();
	} else if (playing && !wasTurbo && turbo) {
		clearTimeout(timeoutID);
		cancelAnimationFrame(run);
		run();
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
	for (let i = 0; i < count; i++) {
		update();
	}
	_render(generation, width, height, firstHead, firstTail);

	if (playing) {
		if (turbo || speed >= 1) {
			requestAnimationFrame(run);
		} else {
			timeoutID = setTimeout(run, delayMS);
		}
	}
};

const update = () => {
	generation++;

	const start = performance.now();

	// generate new list of heads from heads
	let firstNewHead = null;
	let lastNewHead = null;
	let numNeighbors, neighbor;

	// add all wire neighbors of heads to new heads list and count their head neighbors
	for (let cell = firstHead; cell != null; cell = cell.next) {
		numNeighbors = cell.numNeighbors;
		for (let i = 0; i < numNeighbors; i++) {
			neighbor = cell.neighbors[i];
			if (neighbor.isWire) {
				if (neighbor.headCount === 0) {
					if (firstNewHead == null) {
						firstNewHead = neighbor;
					} else {
						lastNewHead.next = neighbor;
					}
					lastNewHead = neighbor;
				}
				neighbor.headCount++;
			}
		}
	}
	if (lastNewHead != null) {
		lastNewHead.next = null;
	}

	// remove cells from front of list until first cell is a valid new head
	while (firstNewHead != null && firstNewHead.headCount > 2) {
		firstNewHead.headCount = 0;
		firstNewHead = firstNewHead.next;
	}

	// remove cells from list if they are invalid
	for (let cell = firstNewHead; cell != null; cell = cell.next) {
		while (cell.next != null && cell.next.headCount > 2) {
			cell.next.headCount = 0;
			cell.next = cell.next.next;
		}
		cell.headCount = 0;
		cell.isWire = false;
	}

	// turn all tails to wires
	for (let cell = firstTail; cell != null; cell = cell.next) {
		cell.isWire = true;
	}

	firstTail = firstHead;
	firstHead = firstNewHead;

	totalTime += performance.now() - start;
};

const advance = () => {
	update();
	_render(generation, width, height, firstHead, firstTail);
};

window.engineFrameTime = () => console.log(totalTime / (generation + 1).toFixed(3));

const reset = () => {
	generation = 0;
	totalTime = 0;
	firstHead = null;
	firstTail = null;
	let lastHead = null;
	let lastTail = null;
	cells.forEach((cell) => {
		cell.isWire = false;
		switch (cell.firstState) {
			case CellState.HEAD:
				if (firstHead == null) {
					firstHead = cell;
				} else {
					lastHead.next = cell;
				}
				lastHead = cell;
				break;
			case CellState.TAIL:
				if (firstTail == null) {
					firstTail = cell;
				} else {
					lastTail.next = cell;
				}
				lastTail = cell;
				break;
			case CellState.WIRE:
				cell.isWire = true;
				break;
		}
	});
	_render(generation, width, height, firstHead, firstTail);
};

const engine = { initialize, setRhythm, advance, reset };

export { engine };
