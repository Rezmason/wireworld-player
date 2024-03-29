const collectUI = (query) =>
	Object.fromEntries(Array.from(document.querySelectorAll(query)).map((element) => [element.classList.item(0).replace(/-/g, "_"), element]));

const makeEventTarget = () => {
	try {
		return new EventTarget();
	} catch {
		return new DocumentFragment();
	}
};

const uiElementTagNames = new Set(["button", "input"]);
const isUIElement = (element) => uiElementTagNames.has(element.tagName.toLowerCase());

const wheelDeltaMagnifiers = {
	[0]: 1,
	[1]: 40,
	[2]: 40, // TODO: find an example
};

const preventTouchDefault = (func) => (event) => {
	event.preventDefault();
	func(event);
};

const listenForWheel = (target, func) => {
	target.addEventListener("wheel", (event) => {
		const magnifier = (wheelDeltaMagnifiers[event.deltaMode] ?? 0) / 10000;
		func({
			target,
			clientX: event.clientX,
			clientY: event.clientY,
			deltaX: event.deltaX * magnifier,
			deltaY: event.deltaY * magnifier,
			deltaZ: event.deltaZ * magnifier,
		});
	});
};

const mapKeyToMouseEvent = (button, keyCode, upDownEvents = false) => {
	document.addEventListener("keydown", ({ code, repeat, metaKey, ctrlKey }) => {
		if (repeat || metaKey || ctrlKey) {
			return;
		}
		if (code === keyCode) {
			if (code === "Space" && document.activeElement != null) {
				if (document.activeElement.form === null) {
					return;
				}
			}
			button.dispatchEvent(new MouseEvent(upDownEvents ? "mousedown" : "click"));
		}
	});

	if (upDownEvents) {
		document.addEventListener("keyup", ({ code }) => {
			if (code === keyCode) {
				button.dispatchEvent(new MouseEvent("mouseup"));
			}
		});
	}
};

const makeSlider = (decreaseButton, increaseButton, rangeInput, speed = 0.01, decreaseKeyMapping = null, increaseKeyMapping = null) => {
	const event = new Event("change");
	const slider = makeEventTarget();
	const dispatch = () => slider.dispatchEvent(event);

	let value = parseFloat(rangeInput.value);
	let animatedDelta = 0;

	const setValue = (_value) => {
		if (_value < 0) {
			_value = 0;
		}
		if (_value > 1) {
			_value = 1;
		}
		if (value === _value) {
			return false;
		}
		value = _value;
		rangeInput.value = _value;
		return true;
	};
	slider.setValue = setValue;

	Object.defineProperty(slider, "value", {
		get: () => value,
		set: (_value) => setValue(_value),
	});

	listenForWheel(rangeInput, ({ deltaY }) => {
		if (setValue(value - deltaY)) {
			dispatch();
		}
	});

	rangeInput.addEventListener("input", (e) => {
		if (setValue(rangeInput.valueAsNumber)) {
			dispatch();
		}
	});

	const animateSlider = () => {
		if (animatedDelta !== 0) {
			if (setValue(value + animatedDelta)) {
				dispatch();
			}
			requestAnimationFrame(animateSlider);
		}
	};

	const beginAnimatedSlider = (amount) => (event) => {
		event.preventDefault();
		if (animatedDelta !== 0) {
			return;
		}
		animatedDelta = amount;
		animateSlider();
	};

	const endAnimatedSlider = (event) => {
		animatedDelta = 0;
	};

	if (typeof speed !== "number") {
		speed = 0.01;
	}

	const sanitizeKey = (func) => (event) => {
		if (event.repeat) {
			return;
		}
		if (event.code === "Space" || event.code === "Enter") {
			func(event);
		}
	};

	decreaseButton.addEventListener("mousedown", beginAnimatedSlider(-speed));
	decreaseButton.addEventListener("touchstart", beginAnimatedSlider(-speed));
	decreaseButton.addEventListener("mouseup", endAnimatedSlider);
	decreaseButton.addEventListener("touchend", endAnimatedSlider);

	decreaseButton.addEventListener("keydown", sanitizeKey(beginAnimatedSlider(-speed)));
	decreaseButton.addEventListener("keyup", sanitizeKey(endAnimatedSlider));

	increaseButton.addEventListener("mousedown", beginAnimatedSlider(speed));
	increaseButton.addEventListener("touchstart", beginAnimatedSlider(speed));
	increaseButton.addEventListener("mouseup", endAnimatedSlider);
	increaseButton.addEventListener("touchend", endAnimatedSlider);

	increaseButton.addEventListener("keydown", sanitizeKey(beginAnimatedSlider(speed)));
	increaseButton.addEventListener("keyup", sanitizeKey(endAnimatedSlider));

	document.body.addEventListener("mouseup", endAnimatedSlider);
	document.body.addEventListener("touchend", endAnimatedSlider);
	document.body.addEventListener("mouseleave", endAnimatedSlider);
	window.addEventListener("blur", endAnimatedSlider);

	if (decreaseKeyMapping != null) {
		mapKeyToMouseEvent(decreaseButton, decreaseKeyMapping, true);
	}

	if (increaseKeyMapping != null) {
		mapKeyToMouseEvent(increaseButton, increaseKeyMapping, true);
	}

	return slider;
};

export { collectUI, makeEventTarget, isUIElement, makeSlider, listenForWheel, preventTouchDefault, mapKeyToMouseEvent };
