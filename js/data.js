const CellState = Object.fromEntries([
	"HEAD",
	"TAIL",
	"WIRE",
	"DEAD"
].map((name, index) => [name, index]));

const defaultFilePath = "examples/mcl/owen_moore/computer_by_mark_owen_horizontal.mcl";

export {
	CellState,
	defaultFilePath
};
