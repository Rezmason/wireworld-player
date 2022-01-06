importScripts("engine_common.js");

let cells, numCells;

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

const initialize = (data) => {
	const { width, height } = data;
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

	return cells.map((cell) => cell.y * width + cell.x);
};

const reset = (saveData) => {
	firstHead = null;
	firstTail = null;
	let lastHead = null;
	let lastTail = null;

	const savedHeadIDs = new Set(saveData?.headIDs ?? []);
	const savedTailIDs = new Set(saveData?.tailIDs ?? []);

	cells.forEach((cell, id) => {
		let resetState = cell.firstState;

		if (saveData != null) {
			if (savedHeadIDs.has(id)) {
				resetState = CellState.HEAD;
			} else if (savedTailIDs.has(id)) {
				resetState = CellState.TAIL;
			} else {
				resetState = CellState.WIRE;
			}
		}

		cell.next = null;
		cell.isWire = false;
		switch (resetState) {
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
};

const update = () => {
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
					neighbor.headCount = 1;
					neighbor.next = null;
					if (firstNewHead == null) {
						firstNewHead = neighbor;
					} else {
						lastNewHead.next = neighbor;
					}
					lastNewHead = neighbor;
				} else {
					neighbor.headCount++;
				}
			}
		}
	}

	// remove cells from front of list until first cell is a valid new head
	while (firstNewHead.headCount > 2) {
		firstNewHead.headCount = 0;
		firstNewHead = firstNewHead.next;
	}

	// remove cells from list if they are invalid
	for (let newHead = firstNewHead; newHead != null; newHead = newHead.next) {
		let cell = newHead.next;
		while (cell != null && cell.headCount > 2) {
			cell.headCount = 0;
			cell = cell.next;
		}
		newHead.next = cell;
		newHead.headCount = 0;
		newHead.isWire = false;
	}

	// turn all tails to wires
	for (let cell = firstTail; cell != null; cell = cell.next) {
		cell.isWire = true;
	}

	firstTail = firstHead;
	firstHead = firstNewHead;
};

const render = (headIDs, tailIDs) => {
	for (let cell = firstHead; cell != null; cell = cell.next) {
		headIDs.push(cell.index);
	}
	for (let cell = firstTail; cell != null; cell = cell.next) {
		tailIDs.push(cell.index);
	}
};

buildEngine(initialize, reset, update, render);
