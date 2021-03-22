const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const defaultLandscapeURL = "examples/txt/owen_moore/owen_moore_horizontal.txt";
const defaultPortraitURL = "examples/txt/owen_moore/owen_moore_vertical.txt";

const getDefaultURL = isPortrait => (isPortrait ? defaultPortraitURL : defaultLandscapeURL);

export { CellState, getDefaultURL };
