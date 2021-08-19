const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const numberFormatter = new Intl.NumberFormat();
const maxFrameTime = 1000 / 10;
const desiredFrameTime = 1000 / 60;

const NULL = 0;

const headGridIndices = [];
const tailGridIndices = [];

let width, height, mem, allGridIndices, allFirstStates, numCells, generation;
let firstHead = NULL;
let firstTail = NULL;

let turboActive = false;
let turboStepSize = 1;
let turboStartTime = null;
let turboStartGeneration;
let turboTimeout = null;

const neighbors_ = 0;
const numNeighbors_ = 8;
const next_ = 9;
const headCount_ = 10;
const isWire_ = 11;

const cellSize = isWire_ + 1;

const initialize = (data, restoredRender = null) => {
	width = data.width;
	height = data.height;

	const firstStates = [CellState.DEAD];
	const gridIndices = [0];

	numCells = 1;
	const cellGrid = Array(height)
		.fill()
		.map((_) => Array(width).fill(NULL));

	data.cellStates.forEach((row, y) =>
		row.forEach((firstState, x) => {
			if (firstState == null || firstState === CellState.DEAD) {
				return;
			}

			firstStates[numCells] = firstState;
			gridIndices[numCells] = y * width + x;
			cellGrid[y][x] = numCells * cellSize;
			numCells++;
		})
	);

	const cells = Array(numCells * cellSize).fill(NULL);

	for (let i = 0; i < numCells; i++) {
		const gridIndex = gridIndices[i];
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
	allGridIndices = Uint32Array.from(gridIndices);
	allFirstStates = Uint32Array.from(firstStates);
	cells.length = null;

	reset(restoredRender);
};

const reset = (restoredRender) => {
	generation = restoredRender?.generation ?? 0;
	firstHead = NULL;
	firstTail = NULL;
	let lastHead = NULL;
	let lastTail = NULL;

	const restoredHeadGridIndices = new Set(restoredRender?.headGridIndices ?? []);
	const restoredTailGridIndices = new Set(restoredRender?.tailGridIndices ?? []);

	for (let i = 0; i < numCells; i++) {
		const cell = i * cellSize;
		let resetState = allFirstStates[cell / cellSize];

		if (restoredRender != null) {
			if (restoredHeadGridIndices.has(allGridIndices[cell / cellSize])) {
				resetState = CellState.HEAD;
			} else if (restoredTailGridIndices.has(allGridIndices[cell / cellSize])) {
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
	render();
};

const update = () => {
	generation++;

	// generate new list of heads from heads
	let firstNewHead = NULL;
	let lastNewHead = NULL;
	let numNeighbors, neighbor;

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
		while (mem[cell + next_] != NULL && mem[mem[cell + next_] + headCount_] > 2) {
			mem[mem[cell + next_] + headCount_] = 0;
			mem[cell + next_] = mem[mem[cell + next_] + next_];
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

const render = () => {
	headGridIndices.length = 0;
	tailGridIndices.length = 0;
	for (let cell = firstHead; cell != NULL; cell = mem[cell + next_]) {
		headGridIndices.push(allGridIndices[cell / cellSize]);
	}
	for (let cell = firstTail; cell != NULL; cell = mem[cell + next_]) {
		tailGridIndices.push(allGridIndices[cell / cellSize]);
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
