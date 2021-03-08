import { CellState } from "./data.js";

let dragRegionBounds, dragRegionCenterX, dragRegionCenterY;
const minZoom = 0, maxZoom = 1, minScale = 2 ** (4 * minZoom), maxScale = 2 ** (4 * maxZoom);
let initScale, initX, initY, x, y, zoom, scale, width, height, cells;
let animatedZoomDelta;
let panning, panStartX, panStartY, panStartScale, panStartTouchAverage, panStartTouchDistance;
let touch1, touch2, mouseTouch;
let paperTransform;

const preventTouchDefault = func => event => {
	event.preventDefault();
	func(event);
}

const colorsByCellState = {
	[CellState.DEAD]: [0x22, 0x44, 0x00, 0xff], /*[0x00, 0x00, 0x00, 0xff],*/
	[CellState.WIRE]: [0x44, 0x88, 0x22, 0xff], /*[0x50, 0x50, 0x50, 0xff],*/
	[CellState.TAIL]: [0xff, 0xdd, 0x22, 0xff], /*[0xff, 0xee, 0x00, 0xff],*/
	[CellState.HEAD]: [0xff, 0xff, 0x44, 0xff], /*[0xff, 0x88, 0x00, 0xff],*/
}

const buttons = Object.fromEntries(Array.from(document.querySelectorAll("button")).map(element => [element.id.replace(/-/g, "_"), element]));
const labels = Object.fromEntries(Array.from(document.querySelectorAll("label")).map(element => [element.id.replace(/-/g, "_"), element]));
const sliders = Object.fromEntries(Array.from(document.querySelectorAll("input[type=range]")).map(element => [element.id.replace(/-/g, "_"), element]));
const paper = document.querySelector("drag-region paper");
const canvases = Object.fromEntries(Array.from(document.querySelectorAll("canvas")).map(element => [element.id.replace(/-/g, "_"), element]));
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
	x = newX;
	y = newY;
	const newTransform = `translate(${Math.floor(x)}px, ${Math.floor(y)}px)`;
	if (paperTransform !== newTransform) {
		paperTransform = newTransform;
		paper.style.transform = paperTransform;
	}
}

const setScale = (newScale) => {
	newScale = Math.min(maxScale, Math.max(minScale, newScale));
	if (newScale === scale) {
		return;
	}
	scale = newScale;
	zoom = Math.log2(scale) / 4;
	sliders.zoom_slider.value = zoom;
	paper.style.width = `${width * scale}px`;
	paper.style.height = `${height * scale}px`;
}

const transform = (startX, startY, srcX, srcY, srcScale, dstX, dstY, dstScale) => {
	setScale(dstScale);
	setPosition(
		(dstX - dragRegionBounds.x) + (startX - (srcX - dragRegionBounds.x)) * (scale / srcScale),
		(dstY - dragRegionBounds.y) + (startY - (srcY - dragRegionBounds.y)) * (scale / srcScale)
	);
}

const setZoom = (newZoom, clientX, clientY) => transform(x, y, clientX, clientY, scale, clientX, clientY, 2 ** (newZoom * 4));

const recomputeInitialLayout = () => {
	dragRegionBounds = dragRegion.getBoundingClientRect();
	dragRegionCenterX = (dragRegionBounds.left + dragRegionBounds.right) / 2;
	dragRegionCenterY = (dragRegionBounds.top + dragRegionBounds.bottom) / 2;

	if (dragRegionBounds.width / dragRegionBounds.height > width / height) {
		initScale = dragRegionBounds.height / height;
	} else {
		initScale = dragRegionBounds.width / width;
	}

	initScale = Math.max(minScale, Math.min(maxScale, initScale));

	if (initScale < 1) {
		initScale = 1 / Math.floor(1 / initScale);
	} else {
		initScale = Math.floor(initScale);
	}

	initX = (dragRegionBounds.width - width * initScale) / 2;
	initY = (height > dragRegionBounds.height) ? 0 : (dragRegionBounds.height - height * initScale) / 2;
}

const handleMouseWheel = ({target, clientX, clientY, deltaY}) => {
	const amount = deltaY * -0.0001;
	if (zoom + amount > maxZoom || zoom + amount < minZoom) {
		return;
	}
	endPan();
	if (target === sliders.zoom_slider) {
		setZoom(zoom + amount, dragRegionCenterX, dragRegionCenterY);
	} else {
		setZoom(zoom + amount, clientX, clientY);
	}
	if (mouseTouch != null) {
		touch1 = mouseTouch;
		beginPan();
	}
};

dragRegion.addEventListener("mousewheel", handleMouseWheel);
sliders.zoom_slider.addEventListener("mousewheel", handleMouseWheel);

sliders.zoom_slider.addEventListener("input", e => {
	setZoom(sliders.zoom_slider.valueAsNumber, dragRegionCenterX, dragRegionCenterY);
})

const distanceBetweenTouches = () => touch2 == null ? 1 : ((touch1.clientX - touch2.clientX) ** 2 + (touch1.clientY - touch2.clientY) ** 2) ** 0.5;

const averageBetwenTouches = () =>
	touch2 == null
	? {clientX: touch1.clientX, clientY: touch1.clientY}
	: {
		clientX: (touch1.clientX + touch2.clientX) / 2,
		clientY: (touch1.clientY + touch2.clientY) / 2
	};

const beginPan = () => {
	panning = true;
	panStartX = x;
	panStartY = y;
	panStartScale = scale;
	panStartTouchDistance = distanceBetweenTouches();
	panStartTouchAverage = averageBetwenTouches();
};

const updatePan = () => {
	const dstScale = panStartScale * distanceBetweenTouches() / panStartTouchDistance;
	const average = averageBetwenTouches();
	transform(panStartX, panStartY, panStartTouchAverage.clientX, panStartTouchAverage.clientY, panStartScale, average.clientX, average.clientY, dstScale);
}

const endPan = () => {
	panning = false;
	touch1 = null;
	touch2 = null;
}

const addTouch = (touch) => {
	if (touch1 == null) {
		touch1 = touch;
	} else if (touch2 == null) {
		touch2 = touch;
	}
	beginPan();
}

const removeTouch = (touch) => {
	const isTouch1 = touch1.identifier === touch.identifier;
	const isTouch2 = touch2 != null && touch2.identifier === touch.identifier;
	if (isTouch1 || isTouch2) {
		if (isTouch1) {
			touch1 = touch2;
		}
		touch2 = null;
		if (touch1 == null) {
			endPan();
		} else {
			beginPan();
		}
	}
};

const eachTouch = (touchList, func) => {
	const len = touchList.length;
	for (let i = 0; i < len; i++) {
		func(touchList.item(i));
	}
}

dragRegion.addEventListener("mousedown", ({clientX, clientY, button}) => {
	if (button !== 0) {
		return;
	}
	mouseTouch = {identifier: "mouse", clientX, clientY};
	addTouch(mouseTouch);
});

dragRegion.addEventListener("mouseup", ({button}) => {
	if (button !== 0) {
		return;
	}
	removeTouch(mouseTouch);
	mouseTouch = null;
});

dragRegion.addEventListener("mousemove", ({clientX, clientY}) => {
	if (mouseTouch == null) {
		return;
	}
	mouseTouch.clientX = clientX;
	mouseTouch.clientY = clientY;
	updatePan();
});

dragRegion.addEventListener("touchstart", preventTouchDefault(({changedTouches}) => {
	eachTouch(changedTouches, addTouch);
}));

dragRegion.addEventListener("touchmove", preventTouchDefault(({changedTouches}) => {
	if (!panning || touch1 == null) {
		return;
	}

	eachTouch(changedTouches, (touch) => {
		if (touch1.identifier === touch.identifier) {
			touch1 = touch;
		} else if (touch2 != null && touch2.identifier === touch.identifier) {
			touch2 = touch;
		}
	});

	updatePan();
}));

dragRegion.addEventListener("touchend", preventTouchDefault(({changedTouches}) => {
	eachTouch(changedTouches, removeTouch);
}));

const endGestures = () => {
	endPan();
	mouseTouch = null;
	animatedZoomDelta = 0;
}

document.body.addEventListener("mouseleave", endGestures);
window.addEventListener("blur", endGestures);

window.addEventListener("resize", () => {
	const oldBounds = dragRegionBounds;
	recomputeInitialLayout();
	const diffX = dragRegionBounds.width - oldBounds.width;
	const diffY = dragRegionBounds.height - oldBounds.height;
	setPosition(x + diffX / 2, y + diffY / 2);
})

buttons.reset_view.addEventListener("click", () => {
	setScale(initScale);
	setPosition(initX, initY);
});

const animateZoom = () => {
	if (animatedZoomDelta) {
		setZoom(zoom + animatedZoomDelta, dragRegionCenterX, dragRegionCenterY);
		requestAnimationFrame(animateZoom);
	}
}

const beginAnimatedZoom = (amount) => () => {
	animatedZoomDelta = amount;
	animateZoom();
};

const endAnimatedZoom = () => animatedZoomDelta = null;

buttons.zoom_in.addEventListener("mousedown", beginAnimatedZoom(0.004));
buttons.zoom_in.addEventListener("touchstart", preventTouchDefault(beginAnimatedZoom(0.004)));
buttons.zoom_out.addEventListener("mousedown", beginAnimatedZoom(-0.004));
buttons.zoom_out.addEventListener("touchstart", preventTouchDefault(beginAnimatedZoom(-0.004)));

document.body.addEventListener("mouseup", endAnimatedZoom);
document.body.addEventListener("touchend", endAnimatedZoom);
document.body.addEventListener("mouseleave", endAnimatedZoom);

const setFilePath = (path) => {
	labels.file_name.setText(path);
}

const setPaper = (data) => {
	({width, height, cells} = data);

	canvases.lower.width = width;
	canvases.lower.height = height;
	canvases.upper.width = width;
	canvases.upper.height = height;

	const lowerCtx = canvases.lower.getContext("2d");
	const upperCtx = canvases.upper.getContext("2d");

	const lowerData = lowerCtx.createImageData(width, height);
	const lowerPixels = lowerData.data;
	const upperData = upperCtx.createImageData(width, height);
	const upperPixels = upperData.data;

	const deadColor = colorsByCellState[CellState.DEAD];
	const wireColor = colorsByCellState[CellState.WIRE];
	const tailColor = colorsByCellState[CellState.TAIL];
	const headColor = colorsByCellState[CellState.HEAD];

	for (let i = 0; i < height; i++) {
		if (cells[i] != null) {
			for (let j = 0; j < width; j++) {
				const state = cells[i][j] ?? CellState.DEAD;
				const index = (i * width + j) * 4;
				lowerPixels.set(state === CellState.DEAD ? deadColor : wireColor, index);
				if (state === CellState.TAIL) {
					upperPixels.set(tailColor, index);
				}
				if (state === CellState.HEAD) {
					upperPixels.set(headColor, index);
				}
			}
		}
	}

	lowerCtx.putImageData(lowerData, 0, 0);
	upperCtx.putImageData(upperData, 0, 0);

	recomputeInitialLayout();
	setScale(initScale);
	setPosition(initX, initY);
}

export default {
	setFilePath,
	setPaper
};
