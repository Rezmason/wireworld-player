const buf = new ArrayBuffer(2);
new Uint16Array(buf)[0] = 1;
const isLittleEndian = new Uint8ClampedArray(buf)[0] === 1;

const formatColorForEndian = (rgba) => {
	if (isLittleEndian) {
		return parseInt(rgba.toString(0x10).padStart(8, "0").match(/..?/g).reverse().join(""), 16);
	}
	return rgba;
};

const makeTheme = (deadColor, wireColor, tailColor, headColor) => ({
	dead: formatColorForEndian(deadColor),
	wire: formatColorForEndian(wireColor),
	tail: formatColorForEndian(tailColor),
	head: formatColorForEndian(headColor),
});

export default {
	["default"]: makeTheme(0x000000ff, 0x505050ff, 0xffee00ff, 0xff8800ff), // Orange and yellow over grey and black
	classic: makeTheme(0x000000ff, 0xff8800ff, 0x2c82f6ff, 0xffffffff), // White and blue over orange and black
	minty: makeTheme(0x000000ff, 0x505050ff, 0x00c000ff, 0x80ff80ff), // Spearmint over grey and black
	bright: makeTheme(0x000000ff, 0x404040ff, 0x909090ff, 0xffffffff), // White and grey over grey and black

	circuit: makeTheme(0x224400ff, 0x448822ff, 0xffdd22ff, 0xffff44ff), // Gold, green and emerald

	tamarind: makeTheme(0x440800ff, 0xbb4411ff, 0xff8822ff, 0xffddaaff), // brown, red, orange
	gourd: makeTheme(0x081100ff, 0x669911ff, 0x99cc44ff, 0xffffaaff), // green and yellow
	aubergine: makeTheme(0x0f001eff, 0x443366ff, 0x448800ff, 0xaaff33ff), // purple and green
	frigid: makeTheme(0x001144ff, 0x336688ff, 0x33ddffff, 0xffffffff), // blue, cyan and white
	coffee: makeTheme(0x100400ff, 0x664422ff, 0xbbaa99ff, 0xffeeccff), // brown and white
	regal: makeTheme(0x10050aff, 0xd09911ff, 0xffee88ff, 0xffffffff), // dark purple and gold
	birthday: makeTheme(0x770511ff, 0xee6688ff, 0xffaabbff, 0xffffddff), // fuschia, pink and buttercream
};
