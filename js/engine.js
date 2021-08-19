const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const numberFormatter = new Intl.NumberFormat();
const maxFrameTime = 1000 / 10;
const desiredFrameTime = 1000 / 60;

let width, height, cells, numCells, generation;
let firstHead = null,
	firstTail = null;

let turboActive = false;
let turboStepSize = 1;
let turboStartTime = null;
let turboStartGeneration;
let turboTimeout = null;

const makeCell = (index, firstState, x, y) => {
	return {
		x,
		y,
		index,
		gridIndex: y * width + x,
		firstState,
		neighbors: [],
		numNeighbors: 0,
		next: null,
		headCount: 0,
		isWire: false,
	};
};

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
					cell.neighbors[cell.numNeighbors] = neighbor;
					cell.numNeighbors++;
				}
			}
		}
	}

	reset(restoredRender);
};

const reset = (restoredRender) => {
	generation = restoredRender?.generation ?? 0;
	firstHead = null;
	firstTail = null;
	let lastHead = null;
	let lastTail = null;

	const headGridIndices = new Set(restoredRender?.headGridIndices ?? []);
	const tailGridIndices = new Set(restoredRender?.tailGridIndices ?? []);

	for (let i = 0; i < numCells; i++) {
		const cell = cells[i];
		let resetState = cell.firstState;

		if (restoredRender != null) {
			if (headGridIndices.has(cell.gridIndex)) {
				resetState = CellState.HEAD;
			} else if (tailGridIndices.has(cell.gridIndex)) {
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
	}
	render();
};

const update = () => {
	generation++;

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

const render = () => {
	const headGridIndices = [];
	const tailGridIndices = [];
	for (let cell = firstHead; cell != null; cell = cell.next) {
		headGridIndices.push(cell.gridIndex);
	}
	for (let cell = firstTail; cell != null; cell = cell.next) {
		tailGridIndices.push(cell.gridIndex);
	}

	let simulationSpeed = "---";
	if (turboActive) {
		simulationSpeed = numberFormatter.format(Math.round((1000 * (generation - turboStartGeneration)) / (Date.now() - turboStartTime)));
	}

	postMessage({
		type: "render",
		args: [
			{
				generation: numberFormatter.format(generation),
				simulationSpeed,
				width,
				height,
				headGridIndices,
				tailGridIndices,
			},
		],
	});
};

const advance = () => {
	update();
	render();
};

const startTurbo = () => {
	turboActive = true;
	turboStartGeneration = generation;
	turboStartTime = Date.now();
	let turboTime = turboStartTime;
	let now;
	let lastRender = turboStartTime;

	const loopTurbo = () => {
		for (let i = 0; i < turboStepSize; i++) {
			update();
			update();
			update();
			update();
			update();
			update();
		}

		now = Date.now();

		const diff = now - turboTime;
		if (diff > maxFrameTime && turboStepSize > 1) {
			turboStepSize >>= 1; // Halve it
		} else if (diff * 2 < maxFrameTime) {
			turboStepSize <<= 1; // Double it
		}
		turboTime = now;

		if (now - lastRender > desiredFrameTime) {
			lastRender = now;
			render();
		}

		turboTimeout = setTimeout(loopTurbo, 0);
	};
	loopTurbo();
};

const stopTurbo = () => {
	turboActive = false;
	clearTimeout(turboTimeout);
	turboTimeout = null;
};

const engine = {
	initialize,
	advance,
	reset,
	startTurbo,
	stopTurbo,
};

self.addEventListener("message", (event) => engine[event.data.type]?.(...(event.data.args ?? [])));
