importScripts("engine_common.js");

const theme = oldThemes["minty"];

let oldCells, newCells, originalCells;
const cellIDsByGridIndex = [];

// List all the cells that DO need to change (non-dead)
const nonDeadCells = [];

class AliveEngine extends Engine {
	_initialize(data) {
		cellIDsByGridIndex.length = 0;
		nonDeadCells.length = 0;
		let numCells = 0;
		originalCells = data.cellStates.map((row) => row.concat(Array(width - row.length).fill(CellState.DEAD)));
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const state = originalCells[y][x];
				if (state !== CellState.DEAD) {
					cellIDsByGridIndex[y * width + x] = numCells;
					nonDeadCells.push(y * width + x);
					numCells++;
				}
			}
		}
		return nonDeadCells.slice();
	}

	_reset(saveData) {
		oldCells = originalCells.map((row) => row.slice());

		if (saveData != null) {
			const savedHeadIDs = new Set(saveData.headIDs);
			const savedTailIDs = new Set(saveData.tailIDs);
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					if (originalCells[y][x] === CellState.DEAD) {
						continue;
					}
					const cellGridIndex = cellIDsByGridIndex[y * width + x];
					let state = CellState.WIRE;
					if (savedHeadIDs.has(cellGridIndex)) {
						state = CellState.HEAD;
					}
					if (savedTailIDs.has(cellGridIndex)) {
						state = CellState.TAIL;
					}
					oldCells[y][x] = state;
				}
			}
		}

		newCells = oldCells.map((row) => row.slice());
	}

	_update() {
		// Swap the old and new cells
		let swap = oldCells;
		oldCells = newCells;
		newCells = swap;

		// For every non-dead cell,
		const numNonDeadCells = nonDeadCells.length;
		for (let i = 0; i < numNonDeadCells; i++) {
			const index = nonDeadCells[i];
			const x = index % width;
			const y = (index - x) / width;

			const oldState = oldCells[y][x];
			newCells[y][x] = oldState;
			// Apply the rules:
			switch (oldState) {
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

	_render(headIDs, tailIDs) {
		const numNonDeadCells = nonDeadCells.length;
		for (let i = 0; i < numNonDeadCells; i++) {
			const index = nonDeadCells[i];
			const x = index % width;
			const y = (index - x) / width;

			const state = newCells[y][x];
			switch (state) {
				case CellState.HEAD:
					headIDs.push(cellIDsByGridIndex[index]);
					break;
				case CellState.TAIL:
					tailIDs.push(cellIDsByGridIndex[index]);
					break;
			}
		}
	}
}

const engine = new AliveEngine(oldThemes["night"]);
