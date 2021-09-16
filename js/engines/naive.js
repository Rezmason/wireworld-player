importScripts("engine_common.js");

const theme = oldThemes["minty"];

let oldCells, newCells, originalCells;
const xyToCellGridIndex = [];

class NaiveEngine extends Engine {
	_initialize(data) {
		xyToCellGridIndex.length = 0;
		let numCells = 0;
		const cellGridIndices = [];
		originalCells = data.cellStates.map((row) => row.concat(Array(width - row.length).fill(CellState.DEAD)));
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const state = originalCells[y][x];
				if (state !== CellState.DEAD) {
					xyToCellGridIndex[y * width + x] = numCells;
					cellGridIndices.push(y * width + x);
					numCells++;
				}
			}
		}
		return cellGridIndices;
	}

	_reset(restoredRender) {
		oldCells = originalCells.map((row) => row.slice());
		newCells = originalCells.map((row) => row.slice());
	}

	_update() {
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
	}

	_render(headIDs, tailIDs) {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const state = newCells[y][x];
				switch (state) {
					case CellState.HEAD:
						headIDs.push(xyToCellGridIndex[y * width + x]);
						break;
					case CellState.TAIL:
						tailIDs.push(xyToCellGridIndex[y * width + x]);
						break;
				}
			}
		}
	}
}

const engine = new NaiveEngine(oldThemes["minty"]);
