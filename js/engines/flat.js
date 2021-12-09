importScripts("engine_common.js");

const NULL = 0;

let mem, firstStates, numCells;
let firstHead = NULL;
let firstTail = NULL;

const neighbors_ = 0;
const numNeighbors_ = 8;
const next_ = 9;
const headCount_ = 10;
const isWire_ = 11;

const cellSize = isWire_ + 1;

const initialize = (data) => {
	const { width, height } = data;
	const cellFirstStates = [CellState.DEAD];
	const cellGridIndices = [-1];

	numCells = 1;
	const cellGrid = Array(height)
		.fill()
		.map((_) => Array(width).fill(NULL));

	data.cellStates.forEach((row, y) =>
		row.forEach((firstState, x) => {
			if (firstState == null || firstState === CellState.DEAD) {
				return;
			}

			cellFirstStates[numCells] = firstState;
			cellGridIndices[numCells] = y * width + x;
			cellGrid[y][x] = numCells * cellSize;
			numCells++;
		})
	);

	const cells = Array(numCells * cellSize).fill(NULL);

	for (let i = 0; i < numCells; i++) {
		const gridIndex = cellGridIndices[i];
		const y = Math.floor(gridIndex / width);
		const x = gridIndex % width;
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
				if (neighbor != NULL) {
					cells[i * cellSize + neighbors_ + cells[i * cellSize + numNeighbors_]] = neighbor;
					cells[i * cellSize + numNeighbors_]++;
				}
			}
		}
	}

	mem = Uint32Array.from(cells);
	firstStates = Uint32Array.from(cellFirstStates);
	cells.length = 0;
	cellFirstStates.length = 0;
	return cellGridIndices;
};

const reset = (saveData) => {
	firstHead = NULL;
	firstTail = NULL;
	let lastHead = NULL;
	let lastTail = NULL;

	const savedHeadIDs = new Set(saveData?.headIDs ?? []);
	const savedTailIDs = new Set(saveData?.tailIDs ?? []);

	for (let i = 0; i < numCells; i++) {
		const cell = i * cellSize;
		let resetState = firstStates[cell / cellSize];

		if (saveData != null) {
			if (savedHeadIDs.has(cell / cellSize)) {
				resetState = CellState.HEAD;
			} else if (savedTailIDs.has(cell / cellSize)) {
				resetState = CellState.TAIL;
			} else {
				resetState = CellState.WIRE;
			}
		}

		mem[cell + isWire_] = 0;
		mem[cell + next_] = NULL;
		switch (resetState) {
			case CellState.HEAD:
				if (firstHead == NULL) {
					firstHead = cell;
				} else {
					mem[lastHead + next_] = cell;
				}
				lastHead = cell;
				break;
			case CellState.TAIL:
				if (firstTail == NULL) {
					firstTail = cell;
				} else {
					mem[lastTail + next_] = cell;
				}
				lastTail = cell;
				break;
			case CellState.WIRE:
				mem[cell + isWire_] = 1;
				break;
		}
	}
};

const update = () => {
	// generate new list of heads from heads
	let firstNewHead = NULL;
	let lastNewHead = NULL;
	let numNeighbors, neighbor, next;

	// add all wire neighbors of heads to new heads list and count their head neighbors
	for (let cell = firstHead; cell != NULL; cell = mem[cell + next_]) {
		numNeighbors = mem[cell + numNeighbors_];
		for (let i = 0; i < numNeighbors; i++) {
			neighbor = mem[cell + neighbors_ + i];
			if (mem[neighbor + isWire_] === 1) {
				if (mem[neighbor + headCount_] === 0) {
					if (firstNewHead == NULL) {
						firstNewHead = neighbor;
					} else {
						mem[lastNewHead + next_] = neighbor;
					}
					lastNewHead = neighbor;
				}
				mem[neighbor + headCount_]++;
			}
		}
	}
	if (lastNewHead != NULL) {
		mem[lastNewHead + next_] = NULL;
	}

	// remove cells from front of list until first cell is a valid new head
	while (firstNewHead != NULL && mem[firstNewHead + headCount_] > 2) {
		mem[firstNewHead + headCount_] = 0;
		firstNewHead = mem[firstNewHead + next_];
	}

	// remove cells from list if they are invalid
	for (let cell = firstNewHead; cell != NULL; cell = mem[cell + next_]) {
		next = mem[cell + next_];
		while (next != NULL && mem[next + headCount_] > 2) {
			mem[next + headCount_] = 0;
			mem[cell + next_] = mem[next + next_];
			next = mem[cell + next_];
		}
		mem[cell + headCount_] = 0;
		mem[cell + isWire_] = 0;
	}

	// turn all tails to wires
	for (let cell = firstTail; cell != NULL; cell = mem[cell + next_]) {
		mem[cell + isWire_] = 1;
	}

	firstTail = firstHead;
	firstHead = firstNewHead;
};

const render = (headIDs, tailIDs) => {
	for (let cell = firstHead; cell != NULL; cell = mem[cell + next_]) {
		headIDs.push(cell / cellSize);
	}
	for (let cell = firstTail; cell != NULL; cell = mem[cell + next_]) {
		tailIDs.push(cell / cellSize);
	}
};

buildEngine(themes["frigid"], initialize, reset, update, render);
