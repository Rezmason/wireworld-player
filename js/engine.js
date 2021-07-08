import { CellState } from "./data.js";

let width, height, oldCells, newCells, originalCells, generation;
let playing = false,
	speed = 1,
	turbo = false;
let _drawTo;

const initialize = (data, drawTo) => {
	_drawTo = drawTo;
	width = data.width;
	height = data.height;
	originalCells = data.cells.map((row) => row.concat(Array(width - row.length).fill(CellState.DEAD)));
	reset();
};

const setRhythm = (rhythmData) => {
	const wasPlaying = playing;
	({ playing, speed, turbo } = rhythmData);
	if (playing && !wasPlaying) {
		start();
	}
};

const start = () => {
	advance();
};

const advance = () => {
	// Swap the old and new cells
	let swap = oldCells;
	oldCells = newCells;
	newCells = swap;

	// For every cell,
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const oldState = oldCells[y][x];
			newCells[y][x] = oldState;
			// Apply the rules:
			switch (oldState) {
				case CellState.DEAD:
					// Dead --> Dead
					break;
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
					neighborCounting: for (let yoffset = -1; yoffset < 2; yoffset++) {
						if (y + yoffset < 0 || y + yoffset >= width) {
							continue;
						}
						for (let columnOffset = -1; columnOffset < 2; columnOffset++) {
							if (yoffset === 0 && columnOffset === 0) {
								continue;
							}
							if (y + yoffset < 0 || y + yoffset >= height) {
								continue;
							}
							if (oldCells[y + yoffset][x + columnOffset] === CellState.HEAD) {
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
	}

	generation++;

	_drawTo({ width, height, cells: newCells });

	if (playing) {
		requestAnimationFrame(advance);
	}
};

const reset = () => {
	generation = 0;
	oldCells = originalCells.map((row) => row.slice());
	newCells = originalCells.map((row) => row.slice());
	_drawTo({ width, height, cells: newCells });
};

const engine = { initialize, setRhythm, advance, reset };

export { engine };
