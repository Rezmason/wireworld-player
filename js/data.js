const CellState = Object.fromEntries(
	["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index])
);

const defaultLandscapeFilePath =
	"examples/mcl/owen_moore/computer_by_mark_owen_horizontal.mcl";
const defaultPortraitFilePath =
	"examples/txt/owen_moore/computer_by_mark_owen_vertical.mcl";

export { CellState, defaultLandscapeFilePath, defaultPortraitFilePath };
