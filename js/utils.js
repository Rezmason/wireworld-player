const delay = (seconds) => new Promise((resolve) => setTimeout(() => resolve(), seconds * 1000));

const fetchLocalText = (file) =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(`${reader.error.name}: ${reader.error.message}`);
		reader.onload = () => resolve(reader.result);
		reader.readAsText(file);
	});

const fetchRemoteText = async (url) => {
	const file = await fetch(url);
	if (!file.ok) {
		throw new Error(`${file.status}: ${file.statusText}`);
	}
	return await file.text();
};

export { delay, fetchLocalText, fetchRemoteText };
