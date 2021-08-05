const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

self.addEventListener("message", (event) => {
	switch (event.data.type) {
		case "initialize":
			initialize(...event.data.args);
			break;
		case "advance":
			advance();
			break;
		case "reset":
			reset();
			break;
		case "turbo":
			turbo();
	}
});

let width, height, cells, numCells, originalCellStates, generation;

const render = () => {
	const headIndices = [];
	const tailIndices = [];
	for (let cell = firstHead; cell != null; cell = cell.next) {
		headIndices.push(cell.pixelIndex);
	}
	for (let cell = firstTail; cell != null; cell = cell.next) {
		tailIndices.push(cell.pixelIndex);
	}
	postMessage({ type: "render", args: [{ generation, width, height, headIndices, tailIndices }] });
};

const makeCell = (index, firstState, x, y) => {
	return {
		x,
		y,
		index,
		pixelIndex: y * width + x,
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

const initialize = (data, restoredRender = null) => {
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

	reset(restoredRender);
};

const turbo = () => {
	let lastRender = performance.now();
	while (true) {
		for (let i = 0; i < 192; i++) {
			update();
		}
		let now = performance.now();
		if (now - lastRender > 100) {
			lastRender = now;
			render();
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
};

const advance = () => {
	update();
	render();
};

const reset = (restoredRender) => {
	generation = restoredRender?.generation ?? 0;
	firstHead = null;
	firstTail = null;
	let lastHead = null;
	let lastTail = null;

	const headIndices = new Set(restoredRender?.headIndices ?? []);
	const tailIndices = new Set(restoredRender?.tailIndices ?? []);

	cells.forEach((cell) => {
		let resetState = cell.firstState;

		if (restoredRender != null) {
			if (headIndices.has(cell.pixelIndex)) {
				resetState = CellState.HEAD;
			} else if (tailIndices.has(cell.pixelIndex)) {
				resetState = CellState.TAIL;
			} else {
				resetState = CellState.WIRE;
			}
		}

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
	render();
};
