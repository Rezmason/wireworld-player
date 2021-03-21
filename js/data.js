const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const defaultLandscapeURL = "examples/mcl/owen_moore/computer_by_mark_owen_horizontal.mcl";
const defaultPortraitURL = "examples/txt/owen_moore/computer_by_mark_owen_vertical.mcl";

const getDefaultURL = isPortrait => (isPortrait ? defaultPortraitURL : defaultLandscapeURL);

export { CellState, getDefaultURL };
