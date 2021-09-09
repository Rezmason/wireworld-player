const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const oldThemes = {
	["default"]: [0x000000ff, 0x505050ff, 0xffee00ff, 0xff8800ff],
	classic: [0x000000ff, 0xff8800ff, 0xffffffff, 0x2c82f6ff],
	minty: [0x000000ff, 0x505050ff, 0x80ff80ff, 0x00c000ff],
	bubbleGum: [0x000000ff, 0x4c4c4cff, 0xff4cffff, 0xff4c4cff],
	brass: [0x101000ff, 0x404020ff, 0xffff20ff, 0x808020ff],
	freon: [0x000000ff, 0x4c4c4cff, 0x4cffffff, 0x4c4cffff],
	currant: [0x000000ff, 0x300050ff, 0xffff00ff, 0x8000a0ff],
	night: [0x000040ff, 0x4040a0ff, 0xffffddff, 0x8080ddff],
	gleam: [0x000000ff, 0xffff00ff, 0xffffffff, 0xfffff80ff],
	bright: [0x000000ff, 0x404040ff, 0xffffffff, 0x909090ff],
};

const theme = oldThemes.night;

const numberFormatter = new Intl.NumberFormat();
const maxFrameTime = 1000 / 10;
const desiredFrameTime = 1000 / 60;

const NULL = 0;

const headIDs = [];
const tailIDs = [];

let width, height, mem, firstStates, numCells, generation;
let firstHead = NULL;
let firstTail = NULL;

let turboActive = false;
let turboStepSize = 1;
let turboTimeout = null;

const neighbors_ = 0;
const numNeighbors_ = 8;
const next_ = 9;
const headCount_ = 10;
const isWire_ = 11;

const cellSize = isWire_ + 1;

let lastTurboTime, lastTurboGeneration;
const turboHistoryLength = 10;
const turboHistory = Array(turboHistoryLength);
let turboHistoryIndex = 0;
let turboAverageSpeed = 0;

const initialize = (data, restoredRender = null) => {
	width = data.width;
	height = data.height;

	const cellFirstStates = [CellState.DEAD];
	const cellGridIndices = [0];

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
	postMessage({
		type: "setup",
		args: [
			{
				width,
				height,
				cellGridIndices,
				theme,
			},
		],
	});

	cells.length = 0;
	cellGridIndices.length = 0;
	cellFirstStates.length = 0;

	reset(restoredRender);
};

const reset = (restoredRender) => {
	generation = restoredRender?.generation ?? 0;
	firstHead = NULL;
	firstTail = NULL;
	let lastHead = NULL;
	let lastTail = NULL;

	const restoredHeadIDs = new Set(restoredRender?.headIDs ?? []);
	const restoredTailIDs = new Set(restoredRender?.tailIDs ?? []);

	for (let i = 0; i < numCells; i++) {
		const cell = i * cellSize;
		let resetState = firstStates[cell / cellSize];

		if (restoredRender != null) {
			if (restoredHeadIDs.has(cell / cellSize)) {
				resetState = CellState.HEAD;
			} else if (restoredTailIDs.has(cell / cellSize)) {
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
	resetTurboHistory();
	render();
};

const update = () => {
	generation++;

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

const render = () => {
	headIDs.length = 0;
	tailIDs.length = 0;
	for (let cell = firstHead; cell != NULL; cell = mem[cell + next_]) {
		headIDs.push(cell / cellSize);
	}
	for (let cell = firstTail; cell != NULL; cell = mem[cell + next_]) {
		tailIDs.push(cell / cellSize);
	}

	let simulationSpeed = "---";
	if (turboActive) {
		const now = Date.now();
		const speed = (generation - lastTurboGeneration) / (now - lastTurboTime);
		turboAverageSpeed -= turboHistory[turboHistoryIndex] / turboHistoryLength;
		turboHistory[turboHistoryIndex] = speed;
		turboAverageSpeed += speed / turboHistoryLength;
		turboHistoryIndex = (turboHistoryIndex + 1) % turboHistoryLength;
		simulationSpeed = numberFormatter.format(Math.round(1000 * turboAverageSpeed));
	}

	postMessage({
		type: "render",
		args: [
			{
				generation: numberFormatter.format(generation),
				simulationSpeed,
				theme,
				width,
				height,
				headIDs,
				tailIDs,
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
	let now = Date.now();
	let lastUpdate = now;
	let lastRender = now;
	resetTurboHistory();

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

		const diff = now - lastUpdate;
		if (diff > maxFrameTime && turboStepSize > 1) {
			turboStepSize >>= 1;
		} else if (diff * 2 < maxFrameTime) {
			turboStepSize <<= 1;
		}
		lastUpdate = now;

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

const resetTurboHistory = () => {
	lastTurboTime = Date.now();
	lastTurboGeneration = generation;
	turboHistory.fill(0);
	turboHistoryIndex = 0;
	turboAverageSpeed = 0;
};

const engine = {
	initialize,
	advance,
	reset,
	startTurbo,
	stopTurbo,
};

self.addEventListener("message", ({ data }) => engine[data.type]?.(...(data.args ?? [])));
