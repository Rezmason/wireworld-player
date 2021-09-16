importScripts("engine_common.js");

const theme = oldThemes["minty"];

let numCells;
const cells = [];

const makeCell = (index, firstState, x, y) => {
	return {
		x,
		y,
		index,
		firstState,
		neighbors: [],
		numNeighbors: 0
	};
};

class NeighborsEngine extends Engine {
	_initialize(data, restoredRender = null) {
		numCells = 0;
		cells.length = 0;
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

		return cells.map(cell => cell.y * width + cell.x);
	}

	_reset(restoredRender) {
		cells.forEach((cell) => (cell.state = cell.firstState));
	}

	_update() {
			
		for (let i = 0; i < numCells; i++) {
			cells[i].oldState = cells[i].state;
		}

		// For every cell,
		for (let i = 0; i < numCells; i++) {
			const cell = cells[i];

			// Apply the rules:
			switch (cell.oldState) {
				case CellState.TAIL:
					// Tail --> Wire
					cell.state = CellState.WIRE;
					break;
				case CellState.HEAD:
					// Head --> Tail
					cell.state = CellState.TAIL;
					break;
				case CellState.WIRE:
					// Wire ?--> Head (1 or 2 head neighbors) : Wire
					let numHeadNeighbors = 0;
					const numNeighbors = cell.numNeighbors;
					for (let j = 0; j < numNeighbors; j++) {
						if (cell.neighbors[j].oldState === CellState.HEAD) {
							numHeadNeighbors++;
							if (numHeadNeighbors === 3) {
								break;
							}
						}
					}
					if (numHeadNeighbors === 1 || numHeadNeighbors === 2) {
						cell.state = CellState.HEAD;
					}
					break;
			}
		}
	}

	_render(headIDs, tailIDs) {
		for (let i = 0; i < numCells; i++) {
			const cell = cells[i];
			switch (cell.state) {
				case CellState.HEAD:
					headIDs.push(cell.index);
					break;
				case CellState.TAIL:
					tailIDs.push(cell.index);
					break;
			}
		}
	}
}

const engine = new NeighborsEngine(oldThemes["bright"]);
