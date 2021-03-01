import { CellState } from "./data.js";

let dragRegionBounds, dragRegionCenterX, dragRegionCenterY;
let initZoom, initX, initY, x, y, zoom, scale, width, height, cells;
let dragging, dragX, dragY, dragMouseX, dragMouseY;
let zooming;

const colorsByCellType = {
	[CellState.DEAD]: [0x22, 0x44, 0x00, 0xff], /*[0x00, 0x00, 0x00, 0xff],*/
	[CellState.WIRE]: [0x44, 0x88, 0x22, 0xff], /*[0x50, 0x50, 0x50, 0xff],*/
	[CellState.TAIL]: [0xff, 0xdd, 0x22, 0xff], /*[0xff, 0xee, 0x00, 0xff],*/
	[CellState.HEAD]: [0xff, 0xff, 0x44, 0xff], /*[0xff, 0x88, 0x00, 0xff],*/
}

const buttons = Object.fromEntries(Array.from(document.querySelectorAll("button")).map(element => [element.id.replace(/-/g, "_"), element]));
const labels = Object.fromEntries(Array.from(document.querySelectorAll("label")).map(element => [element.id.replace(/-/g, "_"), element]));
const sliders = Object.fromEntries(Array.from(document.querySelectorAll("input[type=range]")).map(element => [element.id.replace(/-/g, "_"), element]));
const canvas = document.querySelector("canvas#canvas");
const dragRegion = document.querySelector("drag-region");

Object.values(labels).forEach(label => {
	const textSpan = label.querySelector(".wwguitext");
	label.setText = text => {
		textSpan.textContent = text;
		label.text = text;
	};
});

labels.generation.setText("");
labels.file_name.setText("");
labels.framerate.setText("");

const setPosition = (newX, newY) => {
	x = Math.floor(newX);
	y = Math.floor(newY);
	canvas.style.transform = `translate(${x}px, ${y}px)`;
}

const setZoom = (newZoom, clientX, clientY) => {
	const oldScale = scale;
	zoom = Math.max(0, Math.min(1, newZoom));
	scale = Math.pow(2, zoom * 4);
	canvas.style.width = `${width * scale}px`;
	canvas.style.height = `${height * scale}px`;
	if (clientX != null && clientY != null) {
		clientX -= dragRegionBounds.x + x;
		clientY -= dragRegionBounds.y + y;
		const newX = x + clientX - clientX * (scale / oldScale);
		const newY = y + clientY - clientY * (scale / oldScale);
		setPosition(newX, newY);
	}
}

const recomputeInitialLayout = () => {
	dragRegionBounds = dragRegion.getBoundingClientRect();
	dragRegionCenterX = (dragRegionBounds.left + dragRegionBounds.right) / 2;
	dragRegionCenterY = (dragRegionBounds.top + dragRegionBounds.bottom) / 2;

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
}

const changeZoom = (amount, clientX, clientY) => {
	setZoom(zoom + amount, clientX, clientY);
	sliders.zoom_slider.value = zoom;
}

const handleMouseWheel = ({target, clientX, clientY, deltaY}) => {
	if (dragging) {
		return;
	}
	const amount = deltaY * -0.0001;
	if (target == sliders.zoom_slider) {
		changeZoom(amount, dragRegionCenterX, dragRegionCenterY);
	} else {
		changeZoom(amount, clientX, clientY);
	}
};

dragRegion.addEventListener("mousewheel", handleMouseWheel);
sliders.zoom_slider.addEventListener("mousewheel", handleMouseWheel);

sliders.zoom_slider.addEventListener("input", e => {
	setZoom(sliders.zoom_slider.valueAsNumber, dragRegionCenterX, dragRegionCenterY);
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
	const oldBounds = dragRegionBounds;
	recomputeInitialLayout();
	const diffX = dragRegionBounds.width - oldBounds.width;
	const diffY = dragRegionBounds.height - oldBounds.height;
	setPosition(x + diffX / 2, y + diffY / 2);
})

buttons.reset_view.addEventListener("click", () => {
	setZoom(initZoom, dragRegionCenterX, dragRegionCenterY);
	setPosition(initX, initY);
	sliders.zoom_slider.value = zoom;
});

const animateZoom = () => {
	if (zooming) {
		changeZoom(zooming, dragRegionCenterX, dragRegionCenterY);
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

const setFilePath = (path) => {
	labels.file_name.setText(path);
}

const setCanvas = (data) => {
	({width, height, cells} = data);

	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	const imageData = ctx.createImageData(width, height);
	const pixels = imageData.data;

	pixels.fill(0xFF);

	for (let i = 0; i < height; i++) {
		if (cells[i] != null) {
			for (let j = 0; j < width; j++) {
				pixels.set(colorsByCellType[cells[i][j] ?? CellState.DEAD], (i * width + j) * 4);
			}
		}
	}

	ctx.putImageData(imageData, 0, 0);

	recomputeInitialLayout();
	setZoom(initZoom);
	setPosition(initX, initY);
	sliders.zoom_slider.value = zoom;
}

export default {
	setFilePath,
	setCanvas
};
