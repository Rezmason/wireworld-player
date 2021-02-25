const buttons = Object.fromEntries(Array.from(document.querySelectorAll("button")).map(element => [element.id.replace(/-/g, "_"), element]));
const labels = Object.fromEntries(Array.from(document.querySelectorAll("label")).map(element => [element.id.replace(/-/g, "_"), element]));

labels.generation.querySelector("wwguitext")textContent = "0";
labels.file_name.querySelector("wwguitext").textContent = "";
labels.framerate.querySelector("wwguitext").textContent = "60";
