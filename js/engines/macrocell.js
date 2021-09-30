importScripts("engine_common.js");

const cellTemplate = {
	nw: null,
	ne: null,
	sw: null,
	se: null,
	result: null,
	state: -1,
	id: -1,
	depth: 0,
};

const cache = new Map();
const cellStatesToLeaves = new Map(Object.values(CellState).map((state) => [state, { ...cellTemplate, state, id: -state }]));

const DEAD_LEAF = cellStatesToLeaves.get(CellState.DEAD);
const TAIL_LEAF = cellStatesToLeaves.get(CellState.TAIL);
const HEAD_LEAF = cellStatesToLeaves.get(CellState.HEAD);
const WIRE_LEAF = cellStatesToLeaves.get(CellState.WIRE);

let topCell = null;
let ids = 0;
let stepSize = 1; // TODO: configure through UI someplace, support acceleration

let originalCells, width, height, size, treeDepth;
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

	size = 1;
	treeDepth = 0;
	const maxDimension = Math.max(width, height);
	while (size < maxDimension * 2) {
		size <<= 1;
		treeDepth++;
	}

	return cellGridIndices;
};

const lookup = (nw, ne, sw, se) => {
	const key = `${nw.id},${ne.id},${sw.id},${se.id}`;
	if (!cache.has(key)) {
		const cell = {
			...cellTemplate,
			depth: nw.depth + 1,
			id: ids++,
			nw,
			ne,
			sw,
			se,
		};
		cache.set(key, cell);
	}
	return cache.get(key);
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
	if (depth === 0) {
		return DEAD_LEAF;
	} else {
		const child = initEmptyCell(depth - 1);
		return lookup(child, child, child, child);
	}
}

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

	ids = 0;
	// TODO: empty cache
	topCell = padCell(initCell(originalCells, savedHeadIDs, savedTailIDs, treeDepth - 1, 0, 0));
};

const getCellResult = (cell) => {
	if (cell.result == null) {
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

			// Phase 2: 2x2
			// prettier-ignore
			const [
				p, q,
				r, s
			] = [
				getCellResult(lookup(a, b, d, e)),
				getCellResult(lookup(b, c, e, f)),
				getCellResult(lookup(d, g, e, h)),
				getCellResult(lookup(e, f, h, i))
			];

			cell.result = lookup(p, q, r, s);
		}
	}
	return cell.result;
};

const computeLeaf = (leaf, neighborLeaves) => {
	switch (leaf.state) {
		case CellState.DEAD:
			return DEAD_LEAF;
			break;
		case CellState.TAIL:
			return WIRE_LEAF;
			break;
		case CellState.HEAD:
			return TAIL_LEAF;
			break;
		case CellState.WIRE:
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
	}
};

const update = () => {
	topCell = padCell(getCellResult(topCell));
};

const renderCell = (headIDs, tailIDs, cell, x, y) => {
	if (cell.depth === 0) {
		switch (cell.state) {
			case CellState.HEAD:
				headIDs.push(cellIDsByGridIndex[y * width + x]);
				break;
			case CellState.TAIL:
				tailIDs.push(cellIDsByGridIndex[y * width + x]);
				break;
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
	renderCell(headIDs, tailIDs, topCell, -size / 4, -size / 4);
};

buildEngine(oldThemes["currant"], initialize, reset, update, render);
