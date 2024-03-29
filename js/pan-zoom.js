import { makeSlider, listenForWheel, preventTouchDefault, mapKeyToMouseEvent } from "./gui-utils.js";

let dragRegionBounds, dragRegionCenterX, dragRegionCenterY;
const maxPower = 6,
	minScale = 2 ** (maxPower * 0),
	maxScale = 2 ** (maxPower * 1);
let initScale, initX, initY, x, y, scale, width, height, cells;
let panning, panStartX, panStartY, panStartScale, panStartTouchAverage, panStartTouchDistance;
let touch1, touch2, mouseTouch;
let paperTransform;

const resetViewButton = document.querySelector("button.reset-view");
const paper = document.querySelector("drag-region paper");
const dragRegion = document.querySelector("drag-region");
const canvases = Array.from(paper.querySelectorAll("canvas"));

const zoomSlider = makeSlider(
	document.querySelector("button.zoom-out"),
	document.querySelector("button.zoom-in"),
	document.querySelector("input.zoom"),
	0.005,
	"Minus",
	"Equal"
);

const setPosition = (newX, newY) => {
	x = newX;
	y = newY;
	const newTransform = `translate(${Math.floor(x)}px, ${Math.floor(y)}px)`;
	if (paperTransform !== newTransform) {
		paperTransform = newTransform;
		paper.style.transform = paperTransform;
	}
};

const setScale = (newScale) => {
	newScale = Math.min(maxScale, Math.max(minScale, newScale));
	if (newScale === scale) {
		return;
	}
	scale = newScale;
	zoomSlider.value = Math.log2(scale) / maxPower;
	const dimensions = [Math.round(width * scale) + "px", Math.round(height * scale) + "px"];

	canvases.forEach(({ style }) => ([style.width, style.height] = dimensions));
};

const transform = (startX, startY, srcX, srcY, srcScale, dstX, dstY, dstScale) => {
	setScale(dstScale);
	setPosition(
		dstX - dragRegionBounds.x + (startX - (srcX - dragRegionBounds.x)) * (scale / srcScale),
		dstY - dragRegionBounds.y + (startY - (srcY - dragRegionBounds.y)) * (scale / srcScale)
	);
};

const setZoom = (newZoom, clientX, clientY) => transform(x, y, clientX, clientY, scale, clientX, clientY, 2 ** (newZoom * maxPower));

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
	initY = height > dragRegionBounds.height ? 0 : (dragRegionBounds.height - height * initScale) / 2;
};

zoomSlider.addEventListener("change", () => {
	endPan();
	setZoom(zoomSlider.value, dragRegionCenterX, dragRegionCenterY);
	if (mouseTouch != null) {
		touch1 = mouseTouch;
		beginPan();
	}
});

const onWheel = ({ clientX, clientY, deltaY, deltaMode }) => {
	if (!zoomSlider.setValue(zoomSlider.value - deltaY)) {
		return;
	}
	endPan();
	setZoom(zoomSlider.value, clientX, clientY);
	if (mouseTouch != null) {
		touch1 = mouseTouch;
		beginPan();
	}
};

listenForWheel(dragRegion, onWheel);

const distanceBetweenTouches = () => (touch2 == null ? 1 : ((touch1.clientX - touch2.clientX) ** 2 + (touch1.clientY - touch2.clientY) ** 2) ** 0.5);

const averageBetwenTouches = () =>
	touch2 == null
		? { clientX: touch1.clientX, clientY: touch1.clientY }
		: {
				clientX: (touch1.clientX + touch2.clientX) / 2,
				clientY: (touch1.clientY + touch2.clientY) / 2,
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
	const dstScale = (panStartScale * distanceBetweenTouches()) / panStartTouchDistance;
	const average = averageBetwenTouches();
	transform(panStartX, panStartY, panStartTouchAverage.clientX, panStartTouchAverage.clientY, panStartScale, average.clientX, average.clientY, dstScale);
};

const endPan = () => {
	panning = false;
	touch1 = null;
	touch2 = null;
};

const addTouch = (touch) => {
	if (touch1 == null) {
		touch1 = touch;
	} else if (touch2 == null) {
		touch2 = touch;
	}
	beginPan();
};

const removeTouch = (touch) => {
	if (touch == null) {
		return;
	}
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
};

dragRegion.addEventListener("mousedown", ({ clientX, clientY, button }) => {
	if (button !== 0) {
		return;
	}
	mouseTouch = { identifier: "mouse", clientX, clientY };
	addTouch(mouseTouch);
});

dragRegion.addEventListener("mouseup", ({ button }) => {
	if (button !== 0) {
		return;
	}
	removeTouch(mouseTouch);
	mouseTouch = null;
});

dragRegion.addEventListener("mousemove", ({ clientX, clientY }) => {
	if (mouseTouch == null) {
		return;
	}
	mouseTouch.clientX = clientX;
	mouseTouch.clientY = clientY;
	updatePan();
});

dragRegion.addEventListener(
	"touchstart",
	preventTouchDefault(({ changedTouches }) => {
		eachTouch(changedTouches, addTouch);
	})
);

dragRegion.addEventListener(
	"touchmove",
	preventTouchDefault(({ changedTouches }) => {
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
	})
);

dragRegion.addEventListener(
	"touchend",
	preventTouchDefault(({ changedTouches }) => {
		eachTouch(changedTouches, removeTouch);
	})
);

const endGestures = () => {
	endPan();
	mouseTouch = null;
};

document.body.addEventListener("mouseleave", endGestures);
window.addEventListener("blur", endGestures);

window.addEventListener("resize", () => {
	const oldBounds = dragRegionBounds;
	recomputeInitialLayout();
	const diffX = dragRegionBounds.width - oldBounds.width;
	const diffY = dragRegionBounds.height - oldBounds.height;
	setPosition(x + diffX / 2, y + diffY / 2);
});

resetViewButton.addEventListener("click", () => {
	setScale(initScale);
	setPosition(initX, initY);
});

mapKeyToMouseEvent(resetViewButton, "Digit0");

const setPanZoomSize = (_width, _height) => {
	scale = undefined;
	width = _width;
	height = _height;
	recomputeInitialLayout();
	setScale(initScale);
	setPosition(initX, initY);
};

export { setPanZoomSize };
