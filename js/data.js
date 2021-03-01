const CellState = {
	DEAD: Symbol.for(" "),
	WIRE: Symbol.for("#"),
	TAIL: Symbol.for("~"),
	HEAD: Symbol.for("@")
};

const defaultFilePath = "examples/mcl/owen_moore/computer_by_mark_owen_horizontal.mcl";

export {
	CellState,
	defaultFilePath
};
