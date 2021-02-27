const buttons = Object.fromEntries(Array.from(document.querySelectorAll("button")).map(element => [element.id.replace(/-/g, "_"), element]));
const labels = Object.fromEntries(Array.from(document.querySelectorAll("label")).map(element => [element.id.replace(/-/g, "_"), element]));
const sliders = Object.fromEntries(Array.from(document.querySelectorAll("input[type=range]")).map(element => [element.id.replace(/-/g, "_"), element]));
const canvas = document.querySelector("canvas#canvas");
const dragRegion = document.querySelector("drag-region");

labels.generation.querySelector(".wwguitext").textContent = "0";
labels.file_name.querySelector(".wwguitext").textContent = "";
labels.framerate.querySelector(".wwguitext").textContent = "120";

const DEAD = Symbol.for(" ");
const WIRE = Symbol.for("#");
const TAIL = Symbol.for("~");
const HEAD = Symbol.for("@");

const maxArea = 2048 * 2048; // TODO: base this on something, anything

let initZoom, initX, initY, x, y, zoom, scale, width, height, cells;
let dragging, dragX, dragY, dragMouseX, dragMouseY;
let zooming;
let dragRegionBounds;

const mclCharsToSymbols = {
	["."]: DEAD,
	["A"]: TAIL,
	["B"]: HEAD,
	["C"]: WIRE
}

const colorsByCellType = {
	[DEAD]: [0x22, 0x44, 0x00, 0xff], /*[0x00, 0x00, 0x00, 0xff],*/
	[WIRE]: [0x44, 0x88, 0x22, 0xff], /*[0x50, 0x50, 0x50, 0xff],*/
	[TAIL]: [0xff, 0xdd, 0x22, 0xff], /*[0xff, 0xee, 0x00, 0xff],*/
	[HEAD]: [0xff, 0xff, 0x44, 0xff], /*[0xff, 0x88, 0x00, 0xff],*/
}

const parseTXT = (file) => {
	const data = file.match(/^(\d+) +(\d+)\s*(.*)/ms);

	if (data == null) {
		return null;
	}

	return {
		width: parseInt(data[1]),
		height: parseInt(data[2]),
		cells: data[3]
		.split("\n")
		.map(
			line => line
				.split("")
				.map(char => Symbol.for(char))
		)
	};
};

const parseMCL = (file) => {
	const data = file.match(/^#MCell.*#BOARD (\d+)x(\d+).*?(#L.*)/ms);

	if (data == null) {
		return null;
	}

	const cells = data[3]
		.replace(/(#L |\$$|\r)/g, "")
		.split("\n")
		.filter(line => line.length > 0)
		.map(
			line => line
				.match(/([0-9]+)?([^\d])/g)
				.map(c => Array(c.length == 1 ? 1 : parseInt(c))
					.fill(c[c.length - 1])
				)
		)
		.flat(2)
		.join("")
		.split("$")
		.map(line => line.split("").map(c => mclCharsToSymbols[c]));

	return {
		width: Math.max(...cells.map(line => line.length))/*parseInt(data[1])*/,
		height: cells.length /*parseInt(data[2])*/,
		cells
	}
};

const setPosition = (newX, newY) => {
	x = Math.floor(newX);
	y = Math.floor(newY);
	canvas.style.transform = `translate(${x}px, ${y}px)`;
}

const setZoom = newZoom => {
	zoom = Math.max(0, Math.min(1, newZoom));
	scale = Math.pow(2, zoom * 4);
	console.log(scale, scale == 1);
	canvas.style.width = `${width * scale}px`;
	canvas.style.height = `${height * scale}px`;
}

const init = async () => {
	const path = "examples/mcl/owen_moore/computer_by_mark_owen_horizontal.mcl";
	const file = await fetch(path).then(response => response.text());
	// const file = await fetch("examples/mcl/owen_moore/computer_by_mark_owen.mcl").then(response => response.text());
	// const file = await fetch("examples/mcl/test/tiny.mcl").then(response => response.text());

	labels.file_name.querySelector(".wwguitext").textContent = path.split("/").pop();

	const data = parseMCL(file) ?? parseTXT(file);
	if (data == null) {
		return;
	}

	width = data.width;
	height = data.height;
	cells = data.cells;

	if (width * height > maxArea) {
		// Bad time
		return;
	}

	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	const imageData = ctx.createImageData(width, height);
	const pixels = imageData.data;

	pixels.fill(0xFF);

	for (let i = 0; i < height; i++) {
		if (cells[i] != null) {
			for (let j = 0; j < width; j++) {
				pixels.set(colorsByCellType[cells[i][j] ?? DEAD], (i * width + j) * 4);
			}
		}
	}

	ctx.putImageData(imageData, 0, 0);

	dragRegionBounds = dragRegion.getBoundingClientRect();

	let initScale;
	if (dragRegionBounds.width / dragRegionBounds.height > width / height) {
		initScale = dragRegionBounds.height / height;
	} else {
		initScale = dragRegionBounds.width / width;
	}

	initScale = Math.max(1, initScale);

	if (initScale < 1) {
		initScale = 1 / Math.floor(1 / initScale);
	} else {
		initScale = Math.floor(initScale);
	}

	initX = (dragRegionBounds.width - width * initScale) / 2;
	initY = (height > dragRegionBounds.height) ? 0 : (dragRegionBounds.height - height * initScale) / 2;

	initZoom = Math.log2(initScale) / 4;

	setPosition(initX, initY);
	setZoom(initZoom);
	sliders.zoom_slider.value = zoom;
};

init();

const changeZoom = (amount) => {
	setZoom(zoom + amount);
	sliders.zoom_slider.value = zoom;
}

const handleMouseWheel = ({target, clientX, clientY, deltaY}) => {
	if (dragging) {
		return;
	}
	if (target == sliders.zoom_slider) {
		// TODO: scale from center of viewport
	} else {
		// TODO: scale from mouse position
	}
	changeZoom(deltaY * -0.0001);
};

dragRegion.addEventListener("mousewheel", handleMouseWheel);
sliders.zoom_slider.addEventListener("mousewheel", handleMouseWheel);

sliders.zoom_slider.addEventListener("input", e => {
	// TODO: scale from center of viewport
	setZoom(sliders.zoom_slider.valueAsNumber);
})

dragRegion.addEventListener("mousedown", ({clientX, clientY, button}) => {
	if (button != 0) {
		return;
	}

	dragging = true;
	dragX = x;
	dragY = y;
	dragMouseX = clientX;
	dragMouseY = clientY;
});

dragRegion.addEventListener("mouseup", () => {
	dragging = false;
});

dragRegion.addEventListener("mousemove", ({clientX, clientY}) => {
	if (!dragging) {
		return;
	}
	setPosition(
		clientX - dragMouseX + dragX,
		clientY - dragMouseY + dragY
	)
});

document.body.addEventListener("mouseleave", () => {
	dragging = false;
	zooming = 0;
});

window.addEventListener("resize", () => {
	dragRegionBounds = dragRegion.getBoundingClientRect();
})

buttons.reset_view.addEventListener("click", () => {
	sliders.zoom_slider.value = 0;
	setPosition(initX, initY);
	setZoom(0);
});

const animateZoom = () => {
	if (zooming) {
		changeZoom(zooming);
		// TODO: scale from center of viewport
		requestAnimationFrame(animateZoom);
	}
}

buttons.zoom_in.addEventListener("mousedown", () => {
	zooming = 0.004;
	animateZoom();
});
buttons.zoom_in.addEventListener("mouseup", () => zooming = null);

buttons.zoom_out.addEventListener("mousedown", () => {
	zooming = -0.004;
	animateZoom();
});
buttons.zoom_out.addEventListener("mouseup", () => zooming = null);
