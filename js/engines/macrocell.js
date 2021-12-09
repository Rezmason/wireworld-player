importScripts("engine_common.js");

const MAX_CACHE_SIZE = 1e6;

const cellTemplate = {
	nw: null,
	ne: null,
	sw: null,
	se: null,
	result: null,
	nextCell: null,
	prevCell: null,
	id: -1,
	key: null,
	depth: 0,
	referenceCount: 0,
	inUse: false,
	// lastUseGen: -1,
};

const cache = new Map();
let zeroCount = 0;
let firstCell = null;
let lastCell = null;
const firstPoolCell = { ...cellTemplate };
let lastPoolCell = firstPoolCell;
const cellStatesToLeaves = new Map(Object.values(CellState).map((state) => [state, { ...cellTemplate, id: -1 - state, key: state, inUse: true }]));

const DEAD_LEAF = cellStatesToLeaves.get(CellState.DEAD);
const TAIL_LEAF = cellStatesToLeaves.get(CellState.TAIL);
const HEAD_LEAF = cellStatesToLeaves.get(CellState.HEAD);
const WIRE_LEAF = cellStatesToLeaves.get(CellState.WIRE);

let topCell = null;
let ids = 0;
let gen = 0;
// Note: the max step size for WW computer is 10.
let stepSize = 10; // TODO: configure through UI someplace, support acceleration

let originalCells, width, height, size, treeDepth;
const cellIDsByGridIndex = [];

const poolCell = (cell) => {
	if (!cell.inUse) {
		throw new Error("Pooling a cell that isn't in use.");
	}
	cell.nw = null;
	cell.ne = null;
	cell.sw = null;
	cell.se = null;
	cell.result = null;
	cell.id = -1;
	cell.depth = 0;
	cell.key = null;
	cell.referenceCount = 0;
	cell.inUse = false;
	// cell.lastUseGen = -1;

	cell.nextCell = null;
	cell.prevCell = lastPoolCell;
	lastPoolCell.nextCell = cell;
	lastPoolCell = cell;
};

const incrementReferenceCount = (cell) => {
	if (cell == null) {
		return;
	}
	if (cell.referenceCount === 0) {
		zeroCount--;
	}
	cell.referenceCount++;
};

const decrementReferenceCount = (cell) => {
	if (cell == null) {
		return;
	}
	cell.referenceCount--;
	if (cell.referenceCount === 0) {
		zeroCount++;
	}
};

const refCell = (cell) => {
	// cell.lastUseGen = gen;

	if (!cell.inUse) {
		throw new Error("Referencing a cell that isn't in use.");
	}

	if (cell === firstCell) {
		return cell;
	}

	if (firstCell == null) {
		firstCell = cell;
		lastCell = cell;
		return cell;
	}

	// Move the cell to the front of the linked list

	if (cell.nextCell != null) {
		cell.nextCell.prevCell = cell.prevCell;
	}
	if (cell.prevCell != null) {
		cell.prevCell.nextCell = cell.nextCell;
	}

	if (lastCell === cell) {
		lastCell = cell.prevCell;
	}

	firstCell.prevCell = cell;
	cell.nextCell = firstCell;
	firstCell = cell;
	return cell;
};

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

	size = 1;
	treeDepth = 0;
	const maxDimension = Math.max(width, height);
	while (size < maxDimension * 2) {
		size <<= 1;
		treeDepth++;
	}
	treeDepth = Math.max(1, treeDepth) - 1;
	// stepSize = Math.max(1, Math.min(stepSize, treeDepth));
	stepSize = treeDepth;

	return cellGridIndices;
};

const lookup = (nw, ne, sw, se) => {
	const key = `${nw.id},${ne.id},${sw.id},${se.id}`;
	if (!cache.has(key)) {
		let cell = lastPoolCell;
		if (cell === firstPoolCell) {
			cell = { ...cellTemplate };
		} else {
			lastPoolCell = lastPoolCell.prevCell;
			lastPoolCell.nextCell = null;
			cell.prevCell = null;
		}

		zeroCount++;

		cell.inUse = true;
		cell.depth = nw.depth + 1;
		cell.id = ids++;
		cell.nw = nw;
		cell.ne = ne;
		cell.sw = sw;
		cell.se = se;
		incrementReferenceCount(nw);
		incrementReferenceCount(ne);
		incrementReferenceCount(sw);
		incrementReferenceCount(se);
		cell.key = key;

		cache.set(key, cell);
	}
	return refCell(cache.get(key));
};

const initCell = (cells, savedHeadIDs, savedTailIDs, depth, x, y) => {
	if (depth === 0) {
		let state = cells[y]?.[x] ?? CellState.DEAD;

		if (savedHeadIDs != null && state !== CellState.DEAD) {
			const cellID = cellIDsByGridIndex[y * width + x];
			state = CellState.WIRE;
			if (savedHeadIDs.has(cellID)) {
				state = CellState.HEAD;
			}
			if (savedTailIDs.has(cellID)) {
				state = CellState.TAIL;
			}
		}

		const leaf = cellStatesToLeaves.get(state);
		return leaf;
	} else {
		const childDepth = depth - 1;
		const offset = 2 ** childDepth;
		const nw = initCell(cells, savedHeadIDs, savedTailIDs, childDepth, x, y);
		const ne = initCell(cells, savedHeadIDs, savedTailIDs, childDepth, x + offset, y);
		const sw = initCell(cells, savedHeadIDs, savedTailIDs, childDepth, x, y + offset);
		const se = initCell(cells, savedHeadIDs, savedTailIDs, childDepth, x + offset, y + offset);
		return lookup(nw, ne, sw, se);
	}
};

const initEmptyCell = (depth) => {
	if (depth < 0) {
		throw new Error("Why is this happening?!");
	}
	if (depth === 0) {
		return DEAD_LEAF;
	} else {
		const child = initEmptyCell(depth - 1);
		return lookup(child, child, child, child);
	}
};

const padCell = (cell) => {
	const empty = initEmptyCell(cell.depth - 1);
	return lookup(
		lookup(empty, empty, empty, cell.nw),
		lookup(empty, empty, cell.ne, empty),
		lookup(empty, cell.sw, empty, empty),
		lookup(cell.se, empty, empty, empty)
	);
};

const reset = (saveData) => {
	const savedHeadIDs = saveData != null ? new Set(saveData.headIDs) : null;
	const savedTailIDs = saveData != null ? new Set(saveData.tailIDs) : null;
	reinitialize(savedHeadIDs, savedTailIDs);
};

const reinitialize = (headIDs, tailIDs) => {
	ids = 0;
	for (const cell of cache.values()) {
		poolCell(cell);
	}
	firstCell = null;
	lastCell = null;
	cache.clear();
	zeroCount = 0;
	topCell = initCell(originalCells, headIDs, tailIDs, treeDepth, 0, 0);
	incrementReferenceCount(topCell);
};

const getCellResult = (cell) => {
	if (cell.result == null) {
		refCell(cell.nw);
		refCell(cell.ne);
		refCell(cell.sw);
		refCell(cell.se);

		if (cell.depth === 2) {
			// A 4x4 grid's 2x2 result can be naively solved

			// prettier-ignore
			const [
				a, b, c, d,
				e, f, g, h,
				i, j, k, l,
				m, n, o, p
			] = [
				cell.nw.nw, cell.nw.ne, cell.ne.nw, cell.ne.ne,
				cell.nw.sw, cell.nw.se, cell.ne.sw, cell.ne.se,
				cell.sw.nw, cell.sw.ne, cell.se.nw, cell.se.ne,
				cell.sw.sw, cell.sw.se, cell.se.sw, cell.se.se,
			];

			const nw = computeLeaf(f, [a, b, c, e, g, i, j, k]);
			const ne = computeLeaf(g, [b, c, d, f, h, j, k, l]);
			const sw = computeLeaf(j, [e, f, g, i, k, m, n, o]);
			const se = computeLeaf(k, [f, g, h, j, l, n, o, p]);

			cell.result = lookup(nw, ne, sw, se);
		} else {
			// Piece together the solution from the child cells and temporary cells

			// Phase 1: 3x3
			// prettier-ignore
			const [
				a, b, c,
				d, e, f,
				g, h, i
			] = [
				getCellResult(cell.nw),
				getCellResult(lookup(cell.nw.ne, cell.ne.nw, cell.nw.se, cell.ne.sw)),
				getCellResult(cell.ne),
				getCellResult(lookup(cell.nw.sw, cell.nw.se, cell.sw.nw, cell.sw.ne)),
				getCellResult(lookup(cell.nw.se, cell.ne.sw, cell.sw.ne, cell.se.nw)),
				getCellResult(lookup(cell.ne.sw, cell.ne.se, cell.se.nw, cell.se.ne)),
				getCellResult(cell.sw),
				getCellResult(lookup(cell.sw.ne, cell.se.nw, cell.sw.se, cell.se.sw)),
				getCellResult(cell.se)
			];

			if (cell.depth - 2 < stepSize) {
				cell.result = lookup(
					getCellResult(lookup(a, b, d, e)),
					getCellResult(lookup(b, c, e, f)),
					getCellResult(lookup(d, e, g, h)),
					getCellResult(lookup(e, f, h, i))
				);
			} else {
				// prettier-ignore
				cell.result = lookup(
					lookup(a.se, b.sw, d.ne, e.nw),
					lookup(b.se, c.sw, e.ne, f.nw),
					lookup(d.se, e.sw, g.ne, h.nw),
					lookup(e.se, f.sw, h.ne, i.nw)
				);
			}
		}
		incrementReferenceCount(cell.result);
	}
	return cell.result;
};

const computeLeaf = (leaf, neighborLeaves) => {
	switch (leaf) {
		case DEAD_LEAF:
			return DEAD_LEAF;
			break;
		case TAIL_LEAF:
			return WIRE_LEAF;
			break;
		case HEAD_LEAF:
			return TAIL_LEAF;
			break;
		case WIRE_LEAF:
			let numHeadNeighbors = 0;
			neighborCounting: for (let i = 0; i < 8; i++) {
				if (neighborLeaves[i] === HEAD_LEAF) {
					numHeadNeighbors++;
					if (numHeadNeighbors === 3) {
						break neighborCounting;
					}
				}
			}
			if (numHeadNeighbors === 1 || numHeadNeighbors === 2) {
				return HEAD_LEAF;
			} else {
				return WIRE_LEAF;
			}
			break;
		default:
			throw new Error(`Cell isn't a leaf: ${[leaf.id, leaf.nw?.id, leaf.ne?.id, leaf.sw?.id, leaf.ne?.id]}`);
	}
};

const update = (generation) => {
	gen = generation;
	decrementReferenceCount(topCell);
	topCell = getCellResult(padCell(topCell));
	incrementReferenceCount(topCell);

	if (cache.size > MAX_CACHE_SIZE) {
		if (zeroCount / MAX_CACHE_SIZE < 0.5) {
			postDebug("Wipe and rebuild");
			wipeAndRebuild();
		} else {
			// postDebug("Destroy least used zero reference cells");
			destroyLeastUsedZeroReferenceCells();
		}
		// TODO: ask someone who knows better whether some other strategy or overlooked characteristic of Hashlife can improve this stuff

		postDebug((zeroCount / MAX_CACHE_SIZE).toPrecision(3));
	}

	return 2 ** (stepSize - 1);
};

const wipeAndRebuild = () => {
	const headIDs = [];
	const tailIDs = [];
	renderCell(headIDs, tailIDs, topCell, 0, 0);
	reinitialize(new Set(headIDs), new Set(tailIDs));
};

const destroyLeastUsedZeroReferenceCells = () => {
	const originalFirstCell = firstCell;
	let cell = lastCell;

	while (cell !== originalFirstCell && cache.size > MAX_CACHE_SIZE) {
		if (cell.referenceCount > 0) {
			cell = cell.prevCell;
			refCell(cell.nextCell);
			continue;
		}

		if (cell.nextCell != null) {
			cell.nextCell.prevCell = cell.prevCell;
		}
		cell.prevCell.nextCell = cell.nextCell;

		if (!cache.delete(cell.key)) {
			postDebug("Key not found", cell.key);
		}

		const removedCell = cell;
		if (lastCell === removedCell) {
			lastCell = cell.prevCell;
		}
		cell = cell.prevCell;

		zeroCount--;
		cache.delete(removedCell.key);

		if (removedCell.nw != null) {
			decrementReferenceCount(removedCell.nw);
			decrementReferenceCount(removedCell.ne);
			decrementReferenceCount(removedCell.sw);
			decrementReferenceCount(removedCell.se);
			removedCell.nw = null;
			removedCell.ne = null;
			removedCell.sw = null;
			removedCell.se = null;
		}
		if (removedCell.result != null) {
			decrementReferenceCount(removedCell.result);
			removedCell.result = null;
		}
		removedCell.prevCell = null;
		removedCell.nextCell = null;
		removedCell.destroyed = true;
	}
};

const renderCell = (headIDs, tailIDs, cell, x, y) => {
	if (cell.depth === 0) {
		if (cell === HEAD_LEAF) {
			headIDs.push(cellIDsByGridIndex[y * width + x]);
		} else if (cell === TAIL_LEAF) {
			tailIDs.push(cellIDsByGridIndex[y * width + x]);
		}
	} else {
		const offset = 2 ** (cell.depth - 1);
		renderCell(headIDs, tailIDs, cell.nw, x, y);
		renderCell(headIDs, tailIDs, cell.ne, x + offset, y);
		renderCell(headIDs, tailIDs, cell.sw, x, y + offset);
		renderCell(headIDs, tailIDs, cell.se, x + offset, y + offset);
	}
};

const render = (headIDs, tailIDs) => {
	renderCell(headIDs, tailIDs, topCell, 0, 0);
	// postDebug("cache size:", (cache.size / MAX_CACHE_SIZE).toPrecision(2));
};

buildEngine(themes["aubergine"], initialize, reset, update, render);
