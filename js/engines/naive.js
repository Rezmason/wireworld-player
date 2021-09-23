importScripts("engine_common.js");

let oldCells, newCells, originalCells, width, height;
const cellIDsByGridIndex = [];

const initialize = (data) => {
	({ width, height } = data);
	cellIDsByGridIndex.length = 0;
	let numCells = 0;
	const cellGridIndices = [];
	originalCells = data.cellStates.map((row) => row.concat(Array(width - row.length).fill(CellState.DEAD)));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const state = originalCells[y][x];
			if (state !== CellState.DEAD) {
				cellIDsByGridIndex[y * width + x] = numCells;
				cellGridIndices.push(y * width + x);
				numCells++;
			}
		}
	}
	return cellGridIndices;
};

const reset = (saveData) => {
	oldCells = originalCells.map((row) => row.slice());

	if (saveData != null) {
		const savedHeadIDs = new Set(saveData.headIDs);
		const savedTailIDs = new Set(saveData.tailIDs);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (originalCells[y][x] === CellState.DEAD) {
					continue;
				}
				const cellID = cellIDsByGridIndex[y * width + x];
				let state = CellState.WIRE;
				if (savedHeadIDs.has(cellID)) {
					state = CellState.HEAD;
				}
				if (savedTailIDs.has(cellID)) {
					state = CellState.TAIL;
				}
				oldCells[y][x] = state;
			}
		}
	}

	newCells = oldCells.map((row) => row.slice());
};

const update = () => {
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
};

const render = (headIDs, tailIDs) => {
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const state = newCells[y][x];
			switch (state) {
				case CellState.HEAD:
					headIDs.push(cellIDsByGridIndex[y * width + x]);
					break;
				case CellState.TAIL:
					tailIDs.push(cellIDsByGridIndex[y * width + x]);
					break;
			}
		}
	}
};

buildEngine(oldThemes["minty"], initialize, reset, update, render);
