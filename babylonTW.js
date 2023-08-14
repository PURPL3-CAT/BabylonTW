const CUSTOM_STATE_KEY = Symbol();

const ALIGN_LEFT = 0;
const ALIGN_RIGHT = 1;
const ALIGN_CENTER = 2;

const vm = Scratch.vm;
const renderer = vm.renderer;
const gl = renderer.gl;

const NATIVE_FONTS = [
	'Sans Serif',
	'Serif',
	'Handwriting',
	'Marker',
	'Curly',
	'Pixel',
];

const DEFAULT_COLOR = '#575e75';
const DEFAULT_FONT = 'Handwriting';
const DEFAULT_WIDTH = vm.runtime.stageWidth;
const DEFAULT_ALIGN = ALIGN_CENTER;
const DEFAULT_FONT_SIZE = 90;

const TYPE_DELAY = 1000 / 15;

const RAINBOW_TIME_PER = 1000;
const RAINBOW_DURATION = 2000;

const ZOOM_DURATION = 500;

let globalFrameTime = 0;

/**
 * @typedef TextState
 * @property {BabylonCostumeSkin} skin
 */

// temporary
if (!renderer.exports || !renderer.exports.Skin || !vm.exports) {
	alert('VM is too old for animated text extension');
	throw new Error('VM is too old');
}

const Skin = renderer.exports.Skin;
const CanvasMeasurementProvider = renderer.exports.CanvasMeasurementProvider;
const twgl = renderer.exports.twgl;
const RenderedTarget = vm.exports.RenderedTarget;

/**
 * @param {number} c
 * @returns {string}
 */
const formatComponent = (c) => Math.round(c).toString(16).padStart(2, '0');

/**
 * @param {[number, number, number]} color
 * @returns {string}
 */
const formatColor = (color) => `#${formatComponent(color[0])}${formatComponent(color[1])}${formatComponent(color[2])}`;

/**
 * @param {number} h hue from 0-1
 * @param {number} s saturation from 0-1
 * @param {number} v value from 0-1
 * @returns {[number, number, number]} RGB channels from 0-255
 */
const hsvToRGB = (h, s, v) => {
	// https://en.wikipedia.org/wiki/HSL_and_HSV
	var r, g, b;
	var i = Math.floor(h * 6);
	var f = h * 6 - i;
	var p = v * (1 - s);
	var q = v * (1 - f * s);
	var t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}
	return [r * 255 | 0, g * 255 | 0, b * 255 | 0];
};

/**
 * @param {CanvasGradient} gradient
 * @param {number} offset number of cycles to offset by
 */

class BabylonCostumeSkin extends Skin {
	constructor(id, drawable) {
		super(id, renderer);

		/** @type {RenderWebGL.Drawable} */
		this.drawable = drawable;
		/** @type {number} */
		this._previousDrawableXScale = 100;

		this.canvas = document.createElement('canvas');
		this.canvas.width = 0;
		this.canvas.height = 0;
		this.ctx = this.canvas.getContext('2d');

		this.text = '';
		this.color = DEFAULT_COLOR;
		this.textWidth = DEFAULT_WIDTH;
		this.fontFamily = DEFAULT_FONT;
		this.baseFontSize = DEFAULT_FONT_SIZE;
		this.align = DEFAULT_ALIGN;

		/** @type {Array<{text: string; width: number;}>} */
		this.lines = [];
		/** @type {[number, number]} */
		this._size = [0, 0];
		/** @type {[number, number]} */
		this._rotationCenter = [0, 0];

		// Updated in _updateFontDimensions
		this.calculatedFontSize = 0;
		this.lineHeight = 0;
		this.verticalPadding = 0;
		this.wrapWidth = 0;

		this._textDirty = false;
		this._textureDirty = false;
		this._renderedAtScale = 1;
		this._renderTime = 0;
		this._reflowTime = 0;

		this.typeAnimationInterval = null;

		this.isRainbow = false;
		this.rainbowStartTime = 0;
		this.rainbowTimeout = null;

		this.isZooming = false;
		this.zoomStartTime = 0;
		this.zoomTimeout = null;

		/** @type {(() => void)|null} */
		this.resolveOngoingAnimation = null;
	}

	// Part of Skin API
	dispose() {
		if (this._texture) {
			gl.deleteTexture(this._texture);
			this._texture = null;
		}
		this.canvas = null;
		this.ctx = null;
		super.dispose();
	}

	// Part of Skin API
	get size() {
		if (this._needsReflow()) {
			this._reflowText();
		}
		return this._size;
	}

	// Part of Skin API
	useNearest() {
		return false;
	}

	_needsReflow() {
		return (
			this._textDirty ||
			(this.isZooming && this._reflowTime !== globalFrameTime) ||
			this._previousDrawableXScale !== Math.abs(this.drawable.scale[0])
		);
	}

	_updateFontDimensions() {
		this.calculatedFontSize = this.baseFontSize;
		if (this.isZooming) {
			// TODO: it looks like Scratch's animation always starts at least a little visible
			const time = globalFrameTime - this.zoomStartTime;
			const progress = Math.max(0, Math.min(1, time / ZOOM_DURATION));
			this.calculatedFontSize *= progress;
		}
		this.lineHeight = this.baseFontSize * 8 / 7;
		// Always use the base size for padding. This makes the zoom animation look better.
		this.verticalPadding = this.baseFontSize / 7;
		// Only use horizontal scale for wrap width for compatibility with stretch extension.
		this.wrapWidth = this.textWidth / (Math.abs(this.drawable.scale[0]) / 100);
	}

	_getFontStyle() {
		return `${this.calculatedFontSize}px "${this.fontFamily}", sans-serif`;
	}

	_reflowText() {
		this._textDirty = false;
		this._textureDirty = true;
		this._reflowTime = globalFrameTime;
		this._previousDrawableXScale = Math.abs(this.drawable.scale[0]);

		this._size[0] = vm.runtime.stageWidth;
		this._size[1] = vm.runtime.stageHeight;

		// Centered horizontally
		this._rotationCenter[0] = this._size[0] / 2;
		this._rotationCenter[1] = this._size[1] / 2;
	}

	_renderAtScale(requestedScale) {
		this._renderedAtScale = requestedScale;
		this._textureDirty = false;
		this._renderTime = globalFrameTime;

		const scratchWidth = this._size[0];
		const scratchHeight = this._size[1];

		// Renderer's requested scale is accounted for at this point. Do not touch `requestedScale`
		// ever after this point.
		this.canvas.width = Math.ceil(scratchWidth * requestedScale);
		this.canvas.height = Math.ceil(scratchHeight * requestedScale);
		this.ctx.scale(requestedScale, requestedScale);

		this.ctx.fillStyle = this.color;
		this.ctx.font = this._getFontStyle();
		for (let i = 0; i < this.lines.length; i++) {
			const line = this.lines[i];
			const text = line.text;
			const lineWidth = line.width;

			let xOffset = 0;
			if (this.align === ALIGN_LEFT) {
				// already correct
			} else if (this.align === ALIGN_CENTER) {
				xOffset = (this.wrapWidth - lineWidth) / 2;
			} else {
				xOffset = this.wrapWidth - lineWidth;
			}

			if (this.isRainbow) {
				const gradient = this.ctx.createLinearGradient(xOffset, 0, xOffset + lineWidth, 0);
				this.ctx.fillStyle = gradient;
			}

			// TODO: something here is wrong
			this.ctx.fillText(
				text,
				xOffset,
				this.verticalPadding + i * this.lineHeight + this.baseFontSize
			);
		}

		if (!this._texture) {
			// @ts-expect-error - twgl not typed yet
			this._texture = twgl.createTexture(gl, {
				auto: true,
				wrap: gl.CLAMP_TO_EDGE
			});
		}

		this._setTexture(newCanv);
	}

	_invalidateTexture() {
		this._textureDirty = true;
		this._renderTime = 0;
		this.emitWasAltered();
	}

	_invalidateText() {
		this._textDirty = true;
		this._textureDirty = true;
		this._reflowTime = 0;
		this.emitWasAltered();
	}

	setText(text) {
		if (text !== this.text) {
			this.text = text;
			this._invalidateText();
		}
	}

	setColor(color) {
		if (color !== this.color) {
			this.color = color;
			this._invalidateTexture();
		}
	}

	setAlign(align) {
		if (align !== this.align) {
			this.align = align;
			this._invalidateTexture();
		}
	}

	setWidth(width) {
		if (width !== this.textWidth) {
			this.textWidth = width;
			this._invalidateText();
		}
	}

	setHeight(height) {
		if (height !== this.textHeight) {
			this.textHeight = height;
			this._invalidateText();
		}
	}

	getFontFamily() {
		return this.fontFamily;
	}

	getColor() {
		return this.color;
	}

	getWidth() {
		return this.textWidth;
	}

	getHeight() {
		return this.textHeight;
	}

	_oneAnimationAtATime(newCallback) {
		this.cancelAnimation();
		return new Promise(resolve => {
			this.resolveOngoingAnimation = () => {
				this.resolveOngoingAnimation = null;
				resolve();
			};
			newCallback(this.resolveOngoingAnimation);
		});
	}

	startTypeAnimation() {
		return this._oneAnimationAtATime(resolve => {
			const originalText = this.text;
			let i = 1;
			const update = () => {
				this.setText(originalText.substring(0, i));
			};
			update();

			this.typeAnimationInterval = setInterval(() => {
				i++;
				update();
				if (i >= originalText.length) {
					clearInterval(this.typeAnimationInterval);
					resolve();
				}
			}, TYPE_DELAY);
		});
	}

	startRainbowAnimation() {
		return this._oneAnimationAtATime(resolve => {
			this.isRainbow = true;
			this.rainbowStartTime = Date.now();
			this._invalidateTexture();
			this.rainbowTimeout = setTimeout(() => {
				this.isRainbow = false;
				resolve();
				this._invalidateTexture();
			}, RAINBOW_DURATION);
		});
	}

	startZoomAnimation() {
		return this._oneAnimationAtATime(resolve => {
			this.isZooming = true;
			this.zoomStartTime = Date.now();
			this._invalidateText();
			this.zoomTimeout = setTimeout(() => {
				this.isZooming = false;
				resolve();
				this._invalidateText();
			}, ZOOM_DURATION);
		});
	}

	cancelAnimation() {
		if (this.resolveOngoingAnimation) {
			this.resolveOngoingAnimation();
			this.resolveOngoingAnimation = null;

			clearInterval(this.typeAnimationInterval);

			this.isRainbow = false;
			clearTimeout(this.rainbowTimeout);

			this.isZooming = false;
			clearTimeout(this.zoomTimeout);

			// TODO: sometimes we only need to invalidate the texture at this point
			this._invalidateText();
		}
	}

	// Part of Skin API
	updateSilhouette(scale) {
		this.getTexture(scale);
		this._silhouette.unlazy();
	}

	// Part of Skin API
	getTexture(scale) {
		const MAX_SCALE = 10;
		const upperScale = scale ? Math.max(Math.abs(scale[0]), Math.abs(scale[1])) : 100;
		const calculatedScale = Math.min(MAX_SCALE, upperScale / 100);

		if (this._needsReflow()) {
			this._reflowText();
		}
		if (
			this._textureDirty ||
			(this.isRainbow && this._renderTime !== globalFrameTime) ||
			calculatedScale !== this._renderedAtScale
		) {
			this._renderAtScale(calculatedScale);
		}
		//console.log(this._texture);
		return this._texture;
	}
}

/**
 * Note that the returned skin is only usable by the given target. Things will break if another
 * target tries to use it.
 * @param {VM.Target} target
 * @returns {BabylonCostumeSkin}
 */
const createBabylonCostumeSkin = (target) => {
	const drawable = renderer._allDrawables[target.drawableID];
	const id = renderer._nextSkinId++;
	const skin = new BabylonCostumeSkin(id, drawable);
	renderer._allSkins[id] = skin;
	return skin;
};

vm.runtime.on('BEFORE_EXECUTE', () => {
	globalFrameTime = Date.now();

	for (let i = 0; i < renderer._allSkins.length; i++) {
		const skin = renderer._allSkins[i];
		if (skin instanceof BabylonCostumeSkin && (skin.isRainbow || skin.isZooming)) {
			skin.emitWasAltered();
		}
	}
});


// Create a canvas element
const myCanvas = document.createElement('canvas');
myCanvas.width = Math.max(100, vm.runtime.stageWidth * 10);
myCanvas.height = Math.max(100, vm.runtime.stageHeight * 10);

// Get the existing canvas element from vm.renderer.canvas
const existingCanvas = vm.renderer.canvas;

// Get the parent <div> element from the existing canvas
const parentDiv = existingCanvas.parentNode;
parentDiv.insertBefore(myCanvas, existingCanvas);

// Set the CSS position and z-index properties for myCanvas
myCanvas.style.position = 'absolute';
myCanvas.style.top = '0';
myCanvas.style.left = '0';
myCanvas.style.zIndex = '2'; // Set z-index to 2 for myCanvas

// Set the CSS position property for the existing canvas to absolute
//existingCanvas.style.position = 'absolute';
//existingCanvas.style.zIndex = '5'; // Set z-index to 5 for existingCanvas

// Set the background color of the renderer to transparent
//vm.renderer.setBackgroundColor(0, 0, 0, 0);

//const isPackager = myCanvas.parentElement.parentElement.parentElement.id == 'app';
const isPackager = vm.runtime.isPackaged;
console.log('packaged: ' + isPackager.toString());

//switch between these for alpha-enabled stage or not
const canvas = myCanvas;
//const canvas = existingCanvas;

var objects = [];
var babylonScene = null;
var shadowGenerator = null;
var doRender = true;
var downkeys = [];
var downmouse = [];
var camera;
var files = [];
var fileTypes = [];
var fileNames = [];
var result;
var meshPromises = [];
var meshPromiseNames = [];
var meshRotX = [];
var meshRotY = [];
var meshRotZ = [];

// Initialize the maps to store key and mouse states
const keys = new Map();
const mouseButtons = new Map();

// Add event listeners for keydown, keyup, mousedown, and mouseup
document.addEventListener('keydown', (e) => {
	var lc_key;
	if (e.key == ' ') {
		lc_key = 'space';
	} else {
		lc_key = e.key.toLowerCase();
	}
	if (!keys.has(lc_key)) {
		keys.set(lc_key, true);
	}
});

document.addEventListener('keyup', (e) => {
	var lc_key;
	if (e.key == ' ') {
		lc_key = 'space';
	} else {
		lc_key = e.key.toLowerCase();
	}
	keys.delete(lc_key);
});

// Helper function to check if a key is currently pressed
function isKeyDown(key) {
	return keys.has(key.toLowerCase());
}

// Helper function to check if a mouse button is currently pressed
function isMouseButtonDown(button) {
	return mouseButtons.has(button);
}



const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.style.display = "none";
//fileInput.accept = ".babylon";

function handleFileSelect(event) {
	const file = event.target.files[0];
	const reader = new FileReader();

	reader.onload = function(event) {
		const contents = new Blob([event.target.result], { type: file.type });
		console.log("File contents:", contents);
		files.push(contents);
		var fileName = fileInput.files[0].name;
		// Regular expression for file extension.
		var patternFileExtension = /\.([0-9a-z]+)(?:[\?#]|$)/i;
		var fileExtension = (fileName).match(patternFileExtension);
		fileTypes.push(fileExtension);
	};

	reader.readAsArrayBuffer(file);
}
fileInput.addEventListener("change", handleFileSelect);
document.body.appendChild(fileInput);

function profil_gltf(file, filetype, name) {
	return new Promise((resolve, reject) => {
		BABYLON.SceneLoader.ImportMesh("", "", file, scene, function(newMeshes) {

			var mesh = newMeshes[0];

			var meshchild = mesh._children[0];
			meshchild.parent = null;
			meshchild.name = name;
			BABYLON.Tags.EnableFor(meshchild);

			meshchild.addTags(file);

			console.log("Tag OK:" + meshchild.matchesTagsQuery(file));
			mesh.dispose();
			resolve(meshchild);
		}, null, null, filetype)
	})
}
function profil_gltf_url(path, file, filetype, name) {
	return new Promise((resolve, reject) => {
		BABYLON.SceneLoader.ImportMesh("", path, file, scene, function(newMeshes) {

			var mesh = newMeshes[0];

			var meshchild = mesh._children[0];
			meshchild.parent = null;
			meshchild.name = name;
			BABYLON.Tags.EnableFor(meshchild);

			meshchild.addTags(file);

			console.log("Tag OK:" + meshchild.matchesTagsQuery(file));
			mesh.dispose();
			resolve(meshchild);
		}, null, null, filetype)
	})
}

function getCostumeData(costumeNum) {
	var plainCostumeData = vm.getCostume(costumeNum);
	plainCostumeData = plainCostumeData.toString();
	console.log(plainCostumeData);
	console.log(plainCostumeData.length);
	return plainCostumeData.substr(924, plainCostumeData.length - 29 - 924)
}

function getSoundIndexByName(soundArray, name) {
	for (let i = 0; i < soundArray.length; i++) {
		if (soundArray[i].name === name) {
			return i;
		}
	}
	return -1; // Return -1 if the sound with the given name is not found
}

function stopAndDeleteSoundByName(scene, soundName) {
	const sound = scene.getSoundByName(soundName);
	if (sound) {
		sound.stop(); // Stop the sound
		sound.dispose(); // Delete the sound
		console.log(`Sound '${soundName}' stopped and deleted.`);
	} else {
		console.log(`Sound with name '${soundName}' not found.`);
	}
}

const blocksIcon = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIiA/Pgo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPgo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHZlcnNpb249IjEuMSIgd2lkdGg9IjUxMS44NzYyNDYzMDczODM1IiBoZWlnaHQ9IjUxMS44NzYyNDYzMDczODM1IiB2aWV3Qm94PSIwLjU3ODI5NDY3NDg2ODIwMzYgMC41NzgyOTQ2NzQ4NjgyMDM2IDUxMS44NzYyNDYzMDczODM1IDUxMS44NzYyNDYzMDczODM1IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPGRlc2M+Q3JlYXRlZCB3aXRoIEZhYnJpYy5qcyA1LjMuMDwvZGVzYz4KPGRlZnM+CjwvZGVmcz4KPGcgdHJhbnNmb3JtPSJtYXRyaXgoMS44NDc5Mjg2ODcgMCAwIDEuODQ3OTI4Njg3IDI1Ni41MTY0MTc4Mjg2IDI1Ni41MTY0MTc4Mjg2KSIgaWQ9ImtJTWlFY19uZmtDZVdLNnhKTTdTcyIgID4KPHBhdGggc3R5bGU9InN0cm9rZTogbm9uZTsgc3Ryb2tlLXdpZHRoOiAwOyBzdHJva2UtZGFzaGFycmF5OiBub25lOyBzdHJva2UtbGluZWNhcDogYnV0dDsgc3Ryb2tlLWRhc2hvZmZzZXQ6IDA7IHN0cm9rZS1saW5lam9pbjogbWl0ZXI7IHN0cm9rZS1taXRlcmxpbWl0OiAxMDsgZmlsbDogcmdiKDIxMywyMDksMjAxKTsgZmlsbC1ydWxlOiBub256ZXJvOyBvcGFjaXR5OiAxOyIgdmVjdG9yLWVmZmVjdD0ibm9uLXNjYWxpbmctc3Ryb2tlIiAgdHJhbnNmb3JtPSIgdHJhbnNsYXRlKC0zMjAsIC0xODApIiBkPSJNIDE4MS41IDE4MCBDIDE4MS41IDEwMy41MDg1NiAyNDMuNTA4NTYgNDEuNSAzMjAgNDEuNSBDIDM5Ni40OTE0NCA0MS41IDQ1OC41IDEwMy41MDg1NiA0NTguNSAxODAgQyA0NTguNSAyNTYuNDkxNDQgMzk2LjQ5MTQ0IDMxOC41IDMyMCAzMTguNSBDIDI0My41MDg1NiAzMTguNSAxODEuNSAyNTYuNDkxNDQgMTgxLjUgMTgwIHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0NzkyODY4NyAwIDAgMS44NDc5Mjg2ODcgMTk1LjgzNzgyMjIyMTYgMTIwLjYyOTUxMDA4NzQpIiBpZD0iT05aWUF3S3FpRjFIYVhXVnU1MnRZIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjI0LDEwNCw3Nik7IGZpbGwtcnVsZTogZXZlbm9kZDsgb3BhY2l0eTogMTsiIHZlY3Rvci1lZmZlY3Q9Im5vbi1zY2FsaW5nLXN0cm9rZSIgIHRyYW5zZm9ybT0iIHRyYW5zbGF0ZSgtMjg3LjE2Mzk5NSwgLTEwNi40NjUyODU4NjU4KSIgZD0iTSAzNDguMjg1OCA4Ny40MjM1OSBDIDMxNy4wMjc4OSAxMDUuNjE5OTggMjg1LjcwNzc2IDEyMy43NDE4ODAwMDAwMDAwMSAyNTQuMzI0NzcgMTQxLjc4OSBDIDI1NC4yMjAxMiAxNDEuNzg5IDI1NC4xMTUxNiAxNDEuNzg5IDI1NC4wMTA1MiAxNDEuNzg5IEMgMjQ0LjU0NDY1MDAwMDAwMDAyIDEzNi41NzQ5NSAyMzUuMjIxNzcwMDAwMDAwMDIgMTMxLjEyODA0IDIyNi4wNDIxOSAxMjUuNDQ3OTQ5OTk5OTk5OTkgQyAyNTcuMTMzMjMgMTA3LjM4NzAwOTk5OTk5OTk5IDI4OC4yNDQwNyA4OS4zMTc1Nzk5OTk5OTk5OSAzMTkuMzc0NzEgNzEuMjM5NjY5OTk5OTk5OTkgQyAzMjAuMDQ1NjQgNzEuMDQwMTE5OTk5OTk5OTkgMzIwLjY3NDEzOTk5OTk5OTk3IDcxLjE0NTA4IDMyMS4yNjAyMiA3MS41NTM5MTk5OTk5OTk5OSBDIDMzMC4zNDAxOSA3Ni43NzMgMzM5LjM0ODgyIDgyLjA2Mjc4OTk5OTk5OTk5IDM0OC4yODU4IDg3LjQyMzU4OTk5OTk5OTk5IHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0NzkyODY4NyAwIDAgMS44NDc5Mjg2ODcgMjU2LjUyMjM0OTY3OTYgMTU1LjEyNzM4OTYyODEpIiBpZD0iVEtBSkxvMmVGa19JVEZCTUJQaGNaIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjU0LDI1NCwyNTQpOyBmaWxsLXJ1bGU6IGV2ZW5vZGQ7IG9wYWNpdHk6IDAuOTk5OyIgdmVjdG9yLWVmZmVjdD0ibm9uLXNjYWxpbmctc3Ryb2tlIiAgdHJhbnNmb3JtPSIgdHJhbnNsYXRlKC0zMjAuMDAzMjEsIC0xMjUuMTMzNjkpIiBkPSJNIDM0OC4yODU4IDg3LjQyMzU5IEMgMzYwLjU0MTkgOTQuMjg0IDM3Mi42OTMwNCAxMDEuMzAyNDggMzg0LjczODkxIDEwOC40Nzg0MDAwMDAwMDAwMSBDIDM3NS40MzU4Mjk5OTk5OTk5NSAxMTMuOTY5NjIgMzY2LjExMzI1OTk5OTk5OTk3IDExOS40NjkwMTAwMDAwMDAwMSAzNTYuNzcwNTggMTI0Ljk3NjU3MDAwMDAwMDAxIEMgMzY2LjM3MjIgMTMwLjY1MTk0IDM3Ni4wMDkzNCAxMzYuMjU2MjkgMzg1LjY4MTY1OTk5OTk5OTk3IDE0MS43ODg5OSBDIDM4NS4wODQyNjk5OTk5OTk5NSAxNDIuNTEwNTEgMzg0LjM1MTEyIDE0My4wODY1MyAzODMuNDgxODk5OTk5OTk5OTQgMTQzLjUxNzM3IEMgMzcyLjIwMjgwOTk5OTk5OTk0IDE1MC4wNDY1NiAzNjAuODg5NzY5OTk5OTk5OTQgMTU2LjQ4ODcxIDM0OS41NDI3OTk5OTk5OTk5NCAxNjIuODQzOCBDIDMzOS43MDE3MTk5OTk5OTk5NyAxNTcuMjk0NDM5OTk5OTk5OTggMzI5Ljg1NTI4OTk5OTk5OTk3IDE1MS43NDI1NyAzMjAuMDAzMjA5OTk5OTk5OTcgMTQ2LjE4ODQ5OTk5OTk5OTk4IEMgMzEwLjIxMzM1IDE1MS42NTkyODk5OTk5OTk5NyAzMDAuNDcxNTcgMTU3LjIxMTE2OTk5OTk5OTk4IDI5MC43Nzc4Njk5OTk5OTk5NSAxNjIuODQzOCBDIDI3OC40MTkwMDk5OTk5OTk5NiAxNTYuMTQyMDggMjY2LjI2Nzg2OTk5OTk5OTk2IDE0OS4xMjM1OTk5OTk5OTk5OCAyNTQuMzI0NzU5OTk5OTk5OTQgMTQxLjc4ODk4OTk5OTk5OTk4IEMgMjg1LjcwNzczOTk5OTk5OTk0IDEyMy43NDE4Njk5OTk5OTk5OCAzMTcuMDI3ODc5OTk5OTk5OSAxMDUuNjE5OTY5OTk5OTk5OTggMzQ4LjI4NTc4OTk5OTk5OTkgODcuNDIzNTc5OTk5OTk5OTkgeiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPgo8L2c+CjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuODQ3OTI4Njg3IDAgMCAxLjg0NzkyODY4NyAzNzcuNjAxMDg1NzU5NCAxNTUuMTI3NDA4MTA3NCkiIGlkPSI5STFiZF90d3RDZjlQcjFGRG9HVU4iICA+CjxwYXRoIHN0eWxlPSJzdHJva2U6IG5vbmU7IHN0cm9rZS13aWR0aDogMTsgc3Ryb2tlLWRhc2hhcnJheTogbm9uZTsgc3Ryb2tlLWxpbmVjYXA6IGJ1dHQ7IHN0cm9rZS1kYXNob2Zmc2V0OiAwOyBzdHJva2UtbGluZWpvaW46IG1pdGVyOyBzdHJva2UtbWl0ZXJsaW1pdDogMTA7IGZpbGw6IHJnYigyMjQsMTA0LDc2KTsgZmlsbC1ydWxlOiBldmVub2RkOyBvcGFjaXR5OiAxOyIgdmVjdG9yLWVmZmVjdD0ibm9uLXNjYWxpbmctc3Ryb2tlIiAgdHJhbnNmb3JtPSIgdHJhbnNsYXRlKC0zODUuNTI0NTM1LCAtMTI1LjEzMzcpIiBkPSJNIDM4NC43Mzg5MSAxMDguNDc4NCBDIDM5NC4wOTEzMjk5OTk5OTk5NyAxMTMuNjg4MDQ5OTk5OTk5OTkgNDAzLjQxNDIwOTk5OTk5OTk3IDExOC45Nzc4Mzk5OTk5OTk5OSA0MTIuNzA3MjM5OTk5OTk5OTYgMTI0LjM0ODA2OTk5OTk5OTk5IEMgNDEzLjM5NjA4IDEyNC42ODMzOCA0MTMuOTE5NjE5OTk5OTk5OTUgMTI1LjE1NDc0OTk5OTk5OTk5IDQxNC4yNzg0OSAxMjUuNzYyMTk5OTk5OTk5OTkgQyA0MDQuNzU3NjI5OTk5OTk5OTUgMTMwLjk0MTY4IDM5NS4zMzAwOTk5OTk5OTk5NiAxMzYuMjgzOTUgMzg1Ljk5NTkxIDE0MS43ODkgQyAzODUuODkxMjYgMTQxLjc4OSAzODUuNzg2MyAxNDEuNzg5IDM4NS42ODE2NTk5OTk5OTk5NyAxNDEuNzg5IEMgMzc2LjAwOTMzIDEzNi4yNTYyOTk5OTk5OTk5OCAzNjYuMzcyMTk5OTk5OTk5OTYgMTMwLjY1MTk1IDM1Ni43NzA1OCAxMjQuOTc2NTc5OTk5OTk5OTggQyAzNjYuMTEzMjU5OTk5OTk5OTcgMTE5LjQ2OTAxOTk5OTk5OTk5IDM3NS40MzU4MyAxMTMuOTY5NjI5OTk5OTk5OTggMzg0LjczODkxIDEwOC40Nzg0MDk5OTk5OTk5OCB6IiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+CjwvZz4KPGcgdHJhbnNmb3JtPSJtYXRyaXgoMS44NDc5Mjg2ODcgMCAwIDEuODQ3OTI4Njg3IDI1Ni41MTY0NDI3MjM5IDMwNi42OTM1NzY1NzM5KSIgaWQ9IkZpc3hnM241dXFzM3pUVVhNcm9ybiIgID4KPHBhdGggc3R5bGU9InN0cm9rZTogbm9uZTsgc3Ryb2tlLXdpZHRoOiAxOyBzdHJva2UtZGFzaGFycmF5OiBub25lOyBzdHJva2UtbGluZWNhcDogYnV0dDsgc3Ryb2tlLWRhc2hvZmZzZXQ6IDA7IHN0cm9rZS1saW5lam9pbjogbWl0ZXI7IHN0cm9rZS1taXRlcmxpbWl0OiAxMDsgZmlsbDogcmdiKDE4Nyw3MCw3NSk7IGZpbGwtcnVsZTogZXZlbm9kZDsgb3BhY2l0eTogMTsiIHZlY3Rvci1lZmZlY3Q9Im5vbi1zY2FsaW5nLXN0cm9rZSIgIHRyYW5zZm9ybT0iIHRyYW5zbGF0ZSgtMzIwLjAwMDAxMzQ3MiwgLTIwNy4xNTMxOSkiIGQ9Ik0gMjI2LjA0MjE5IDEyNS40NDc5NSBDIDIzNS4yMjE3NyAxMzEuMTI4MDQgMjQ0LjU0NDY2IDEzNi41NzQ5NSAyNTQuMDEwNTIgMTQxLjc4OTAwMDAwMDAwMDAyIEMgMjUzLjkwNTg3MDAwMDAwMDAyIDE2Ny4yNDQyNzAwMDAwMDAwMyAyNTQuMDEwNTIgMTkyLjY5ODU5MDAwMDAwMDAyIDI1NC4zMjQ3NyAyMTguMTUxOTcgQyAyNzYuMTY0MjcgMjMwLjY5NDk4MDAwMDAwMDAyIDI5Ny45NTIyMyAyNDMuMzE3NSAzMTkuNjg4OTYgMjU2LjAxOTIxIEMgMzE5Ljk4MzQxIDI1Ni4yMzY2NyAzMjAuMTkyNyAyNTYuMTg0MTkgMzIwLjMxNzQ2IDI1NS44NjIwOCBDIDM0Mi4xODc3NSAyNDMuMzcyMTggMzY0LjAyODE5IDIzMC44MDIxMzk5OTk5OTk5OCAzODUuODM4NzggMjE4LjE1MTk3IEMgMzg1Ljk5NTkxIDE5Mi42OTc5NiAzODYuMDQ4MzkgMTY3LjI0MzYzIDM4NS45OTU5MSAxNDEuNzg5IEMgMzk1LjMzMDExIDEzNi4yODM5NDk5OTk5OTk5OCA0MDQuNzU3NjMgMTMwLjk0MTY5IDQxNC4yNzg0OSAxMjUuNzYyMTk5OTk5OTk5OTggQyA0MTQuMjc4NDkgMTYyLjAwNTcgNDE0LjI3ODQ5IDE5OC4yNDk1MTk5OTk5OTk5NiA0MTQuMjc4NDkgMjM0LjQ5MzAxOTk5OTk5OTk3IEMgNDEzLjc5ODYzIDIzNC40NzAwNzk5OTk5OTk5NyA0MTMuNDg0MzggMjM0LjY3OTY4OTk5OTk5OTk3IDQxMy4zMzU3NCAyMzUuMTIxNTE5OTk5OTk5OTggQyAzODIuMzg2NzQgMjUzLjI2ODU2OTk5OTk5OTk4IDM1MS4yNzU5IDI3MS4xODA4Njk5OTk5OTk5NyAzMjAuMDAzMjIgMjg4Ljg1ODQzIEMgMzE5LjcxNTM3IDI4OC44NDQ5MiAzMTkuNTA1NzYgMjg4Ljc0MDI3IDMxOS4zNzQ3MiAyODguNTQ0MTggQyAzMTkuMjI2MDggMjg4LjEwMjMzOTk5OTk5OTk3IDMxOC45MTE4MyAyODcuODkyNzQgMzE4LjQzMTk3MDAwMDAwMDA0IDI4Ny45MTU2OCBDIDMxNS45NDA1OTAwMDAwMDAwNCAyODYuNjc3MjIwMDAwMDAwMDMgMzEzLjUzMTIzMDAwMDAwMDA1IDI4NS4zMTU1NzAwMDAwMDAwNCAzMTEuMjA0MiAyODMuODMwNDIgQyAzMTEuMDU1NTYgMjgzLjM4ODU4IDMxMC43NDEzMSAyODMuMTc4OTggMzEwLjI2MTQ1IDI4My4yMDE5MjAwMDAwMDAwMyBDIDMwOC40ODEyMiAyODIuNDE3MjQwMDAwMDAwMDUgMzA2LjgwNTMyMDAwMDAwMDA1IDI4MS40NzQ0OCAzMDUuMjMzNDQwMDAwMDAwMDMgMjgwLjM3MzY2MDAwMDAwMDAzIEMgMzA1LjA4NDgwMDAwMDAwMDAzIDI3OS45MzE4MiAzMDQuNzcwNTUgMjc5LjcyMjIyMDAwMDAwMDA1IDMwNC4yOTA2OTAwMDAwMDAwNCAyNzkuNzQ1MTYwMDAwMDAwMDYgQyAzMDMuMjY2MjMwMDAwMDAwMDYgMjc5LjM0NDgwMDAwMDAwMDEgMzAyLjMyMzQ4IDI3OC44MjEyNjAwMDAwMDAwNSAzMDEuNDYyNDMwMDAwMDAwMDQgMjc4LjE3MzkxMDAwMDAwMDAzIEMgMzAxLjMxMzc5MDAwMDAwMDA0IDI3Ny43MzIwNyAzMDAuOTk5NTQgMjc3LjUyMjQ3MDAwMDAwMDA2IDMwMC41MTk2ODAwMDAwMDAwNSAyNzcuNTQ1NDEwMDAwMDAwMDYgQyAyOTkuMjEzOTcwMDAwMDAwMSAyNzcuMTU1MTEwMDAwMDAwMDQgMjk4LjA2MTYxMDAwMDAwMDAzIDI3Ni41MjY2MTAwMDAwMDAwNiAyOTcuMDYyOTIwMDAwMDAwMSAyNzUuNjU5OTAwMDAwMDAwMDUgQyAyOTYuOTE0MjgwMDAwMDAwMSAyNzUuMjE4MDYwMDAwMDAwMDQgMjk2LjYwMDAzMDAwMDAwMDA2IDI3NS4wMDg0NjAwMDAwMDAwNyAyOTYuMTIwMTcwMDAwMDAwMSAyNzUuMDMxNDAwMDAwMDAwMSBDIDI5NC4zMzk5NDAwMDAwMDAwNyAyNzQuMjQ2NzIwMDAwMDAwMSAyOTIuNjY0MDQwMDAwMDAwMSAyNzMuMzAzOTYwMDAwMDAwMSAyOTEuMDkyMTYwMDAwMDAwMSAyNzIuMjAzMTQwMDAwMDAwMSBDIDI5MC45NDM1MjAwMDAwMDAxIDI3MS43NjEzMDAwMDAwMDAwNiAyOTAuNjI5MjcwMDAwMDAwMSAyNzEuNTUxNzAwMDAwMDAwMSAyOTAuMTQ5NDEwMDAwMDAwMSAyNzEuNTc0NjQwMDAwMDAwMSBDIDI4Ny42NTgwMzAwMDAwMDAxIDI3MC4zMzYxODAwMDAwMDAxIDI4NS4yNDg2NzAwMDAwMDAxIDI2OC45NzQ1MzAwMDAwMDAxMyAyODIuOTIxNjQwMDAwMDAwMSAyNjcuNDg5MzgwMDAwMDAwMSBDIDI4Mi43NzMwMDAwMDAwMDAxIDI2Ny4wNDc1NDAwMDAwMDAxIDI4Mi40NTg3NTAwMDAwMDAwNyAyNjYuODM3OTQwMDAwMDAwMSAyODEuOTc4ODkwMDAwMDAwMSAyNjYuODYwODgwMDAwMDAwMSBDIDI3Ny40NzQ0MjAwMDAwMDAwNyAyNjQuNTA0NjMwMDAwMDAwMTMgMjczLjA3NDkwMDAwMDAwMDA3IDI2MS45OTA2MjAwMDAwMDAxNSAyNjguNzgwMzUwMDAwMDAwMSAyNTkuMzE4ODYwMDAwMDAwMTQgQyAyNjguNjMxNzEwMDAwMDAwMSAyNTguODc3MDIwMDAwMDAwMTMgMjY4LjMxNzQ2MDAwMDAwMDEgMjU4LjY2NzQyMDAwMDAwMDE2IDI2Ny44Mzc2MDAwMDAwMDAxIDI1OC42OTAzNjAwMDAwMDAxNyBDIDI1My43NDIxOTAwMDAwMDAxNCAyNTAuODMwMzIwMDAwMDAwMTcgMjM5Ljc1ODAyMDAwMDAwMDEzIDI0Mi43NjQ3NTAwMDAwMDAxNiAyMjUuODg1MTAwMDAwMDAwMTQgMjM0LjQ5MzA0MDAwMDAwMDE4IEMgMjI1LjYyMzMzMDAwMDAwMDEyIDE5OC4wOTIxMDAwMDAwMDAyIDIyNS42NzU4MTAwMDAwMDAxMyAxNjEuNzQzNjQwMDAwMDAwMiAyMjYuMDQyMjMwMDAwMDAwMTMgMTI1LjQ0Nzk3MDAwMDAwMDE4IHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0NzkyODY4NyAwIDAgMS44NDc5Mjg2ODcgMTk1LjgwMTU5NDQ0NDcgMjkxLjU3MTI3MTQ5NzgpIiBpZD0iMFdhMXByWHI5WThMVmIzZ3BCcThTIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjEzLDIwOSwyMDEpOyBmaWxsLXJ1bGU6IGV2ZW5vZGQ7IG9wYWNpdHk6IDE7IiB2ZWN0b3ItZWZmZWN0PSJub24tc2NhbGluZy1zdHJva2UiICB0cmFuc2Zvcm09IiB0cmFuc2xhdGUoLTI4Ny4xNDQzOTA0NjgxLCAtMTk4Ljk2OTgwODY5MTkpIiBkPSJNIDI1NC4wMTA1MyAxNDEuNzg5IEMgMjU0LjExNTE3OTk5OTk5OTk4IDE0MS43ODkgMjU0LjIyMDE0IDE0MS43ODkgMjU0LjMyNDc3OTk5OTk5OTk4IDE0MS43ODkgQyAyNjYuMjY3ODg5OTk5OTk5OTcgMTQ5LjEyMzYyIDI3OC40MTkwMjk5OTk5OTk5NiAxNTYuMTQyMSAyOTAuNzc3ODg5OTk5OTk5OTYgMTYyLjg0MzgxIEMgMjkwLjc3Nzg4OTk5OTk5OTk2IDE3NC4xNTY4NCAyOTAuNzc3ODg5OTk5OTk5OTYgMTg1LjQ2OTg4IDI5MC43Nzc4ODk5OTk5OTk5NiAxOTYuNzgyOTEgQyAyOTkuMjk1NjU5OTk5OTk5OTQgMjAxLjkzNDEwOTk5OTk5OTk4IDMwNy44ODUzOTk5OTk5OTk5NSAyMDcuMDE0NjA5OTk5OTk5OTggMzE2LjU0NjQ2OTk5OTk5OTk0IDIxMi4wMjQwOCBDIDMxNy43ODQ5Mjk5OTk5OTk5IDIxMi42OTg0NiAzMTkuMDQxOTM5OTk5OTk5OTUgMjEzLjI3NDQ4IDMyMC4zMTc0Nzk5OTk5OTk5MyAyMTMuNzUyNDU5OTk5OTk5OTkgQyAzMTkuODk5NTI5OTk5OTk5OSAyMjcuODE5NTg5OTk5OTk5OTggMzE5Ljg5OTUyOTk5OTk5OTkgMjQxLjg1NjIyOTk5OTk5OTk4IDMyMC4zMTc0Nzk5OTk5OTk5MyAyNTUuODYyMDggQyAzMjAuMTkyNzE5OTk5OTk5OTUgMjU2LjE4NDE5IDMxOS45ODM0Mjk5OTk5OTk5NCAyNTYuMjM2NjcgMzE5LjY4ODk3OTk5OTk5OTk2IDI1Ni4wMTkyMSBDIDI5Ny45NTIyMzk5OTk5OTk5NiAyNDMuMzE3NSAyNzYuMTY0Mjc5OTk5OTk5OTYgMjMwLjY5NDk5IDI1NC4zMjQ3ODk5OTk5OTk5NSAyMTguMTUxOTY5OTk5OTk5OTggQyAyNTQuMDEwNTM5OTk5OTk5OTYgMTkyLjY5ODU4OTk5OTk5OTk3IDI1My45MDU4ODk5OTk5OTk5NCAxNjcuMjQ0MjU5OTk5OTk5OTcgMjU0LjAxMDUzOTk5OTk5OTk2IDE0MS43ODkgeiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPgo8L2c+CjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuODQ3OTI4Njg3IDAgMCAxLjg0NzkyODY4NyAzMTcuNTE2MTY3MTMgMjkxLjMwNDY3MzI0MzQpIiBpZD0iR3pCRzlsclJqOVhnM0kwYzhQSERyIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjI0LDIyMSwyMTUpOyBmaWxsLXJ1bGU6IGV2ZW5vZGQ7IG9wYWNpdHk6IDE7IiB2ZWN0b3ItZWZmZWN0PSJub24tc2NhbGluZy1zdHJva2UiICB0cmFuc2Zvcm09IiB0cmFuc2xhdGUoLTM1My4wMDk3OTYxNzMyLCAtMTk4LjgyNTU0KSIgZD0iTSAzODUuNjgxNjYgMTQxLjc4OSBDIDM4NS43ODYzMSAxNDEuNzg5IDM4NS44OTEyNyAxNDEuNzg5IDM4NS45OTU5MTAwMDAwMDAwNCAxNDEuNzg5IEMgMzg2LjA0ODM5MDAwMDAwMDA0IDE2Ny4yNDM2NCAzODUuOTk1OTEwMDAwMDAwMDQgMTkyLjY5Nzk2IDM4NS44Mzg3ODAwMDAwMDAwNCAyMTguMTUxOTcgQyAzNjQuMDI4MTkwMDAwMDAwMDUgMjMwLjgwMjE0IDM0Mi4xODc3NiAyNDMuMzcyMTgwMDAwMDAwMDEgMzIwLjMxNzQ2MDAwMDAwMDA0IDI1NS44NjIwOCBDIDMxOS44OTk1MSAyNDEuODU2MjI5OTk5OTk5OTggMzE5Ljg5OTUxIDIyNy44MTk1OCAzMjAuMzE3NDYwMDAwMDAwMDQgMjEzLjc1MjQ1OTk5OTk5OTk5IEMgMzI5Ljk1NDU5MDAwMDAwMDA1IDIwOC4yMDA1ODk5OTk5OTk5OCAzMzkuNTkxNDEwMDAwMDAwMDUgMjAyLjY0OTAyOTk5OTk5OTk4IDM0OS4yMjg1NDAwMDAwMDAwNyAxOTcuMDk3MTU5OTk5OTk5OTcgQyAzNDkuNTQyMTYwMDAwMDAwMSAxODUuNzMyODk5OTk5OTk5OTcgMzQ5LjY0NzEyMDAwMDAwMDEgMTc0LjMxNTIyOTk5OTk5OTk5IDM0OS41NDI3OTAwMDAwMDAxIDE2Mi44NDM4MDk5OTk5OTk5NiBDIDM2MC44ODk3NjAwMDAwMDAxIDE1Ni40ODg3MDk5OTk5OTk5NyAzNzIuMjAyODAwMDAwMDAwMSAxNTAuMDQ2NTY5OTk5OTk5OTcgMzgzLjQ4MTg5MDAwMDAwMDEgMTQzLjUxNzM3OTk5OTk5OTk3IEMgMzg0LjM1MTExMDAwMDAwMDA2IDE0My4wODY1Mzk5OTk5OTk5OSAzODUuMDg0MjYwMDAwMDAwMSAxNDIuNTEwNTE5OTk5OTk5OTkgMzg1LjY4MTY1MDAwMDAwMDEgMTQxLjc4OSB6IiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+CjwvZz4KPGcgdHJhbnNmb3JtPSJtYXRyaXgoMS44NDc5Mjg2ODcgMCAwIDEuODQ3OTI4Njg3IDI1Ni44NDg3ODIzNDcyIDI0MS4wNzI5NzI4ODI4KSIgaWQ9IlZjRmdYalpnNjNNekJUUXBfU3RKUCIgID4KPHBhdGggc3R5bGU9InN0cm9rZTogbm9uZTsgc3Ryb2tlLXdpZHRoOiAxOyBzdHJva2UtZGFzaGFycmF5OiBub25lOyBzdHJva2UtbGluZWNhcDogYnV0dDsgc3Ryb2tlLWRhc2hvZmZzZXQ6IDA7IHN0cm9rZS1saW5lam9pbjogbWl0ZXI7IHN0cm9rZS1taXRlcmxpbWl0OiAxMDsgZmlsbDogcmdiKDE4Nyw3MCw3NSk7IGZpbGwtcnVsZTogZXZlbm9kZDsgb3BhY2l0eTogMTsiIHZlY3Rvci1lZmZlY3Q9Im5vbi1zY2FsaW5nLXN0cm9rZSIgIHRyYW5zZm9ybT0iIHRyYW5zbGF0ZSgtMzIwLjE3OTg1Nzg3MDYsIC0xNzEuNjQyODM1KSIgZD0iTSAzNDkuNTQyODEgMTYyLjg0MzgxIEMgMzQ5LjY0NzE0IDE3NC4zMTUyMjk5OTk5OTk5OSAzNDkuNTQyMTggMTg1LjczMjkgMzQ5LjIyODU1OTk5OTk5OTk2IDE5Ny4wOTcxNTk5OTk5OTk5NyBDIDMzOS41MjYwNiAxOTEuMzI3ODI5OTk5OTk5OTggMzI5LjczMjExOTk5OTk5OTk1IDE4NS42NzEzMDk5OTk5OTk5OCAzMTkuODQ2MSAxODAuMTI3NjA5OTk5OTk5OTggQyAzMTAuMTMyMjg5OTk5OTk5OTUgMTg1LjY1MTIgMzAwLjQ0Mjk4OTk5OTk5OTk1IDE5MS4yMDI3NTk5OTk5OTk5OCAyOTAuNzc3ODg5OTk5OTk5OTYgMTk2Ljc4MjkxIEMgMjkwLjc3Nzg4OTk5OTk5OTk2IDE4NS40Njk4OCAyOTAuNzc3ODg5OTk5OTk5OTYgMTc0LjE1Njg0IDI5MC43Nzc4ODk5OTk5OTk5NiAxNjIuODQzODEgQyAzMDAuNDcxNTg5OTk5OTk5OTQgMTU3LjIxMTE3OTk5OTk5OTk4IDMxMC4yMTMzNjk5OTk5OTk5NCAxNTEuNjU5MzEgMzIwLjAwMzIzIDE0Ni4xODg1MDk5OTk5OTk5OCBDIDMyOS44NTUzMSAxNTEuNzQyNTc5OTk5OTk5OTggMzM5LjcwMTczIDE1Ny4yOTQ0NDk5OTk5OTk5OCAzNDkuNTQyODE5OTk5OTk5OTUgMTYyLjg0MzgxIHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0NzkyODY4NyAwIDAgMS44NDc5Mjg2ODcgMjU2LjUyMjM3NzM5ODYgMjg3LjgyMDM5NDQ2NDQpIiBpZD0iSlZqX254cHRaQjQ4UDhpZTV0d0RyIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjIzLDEwNCw3NSk7IGZpbGwtcnVsZTogZXZlbm9kZDsgb3BhY2l0eTogMTsiIHZlY3Rvci1lZmZlY3Q9Im5vbi1zY2FsaW5nLXN0cm9rZSIgIHRyYW5zZm9ybT0iIHRyYW5zbGF0ZSgtMzIwLjAwMzIyNSwgLTE5Ni45NDAwMzUpIiBkPSJNIDM0OS4yMjg1NiAxOTcuMDk3MTYgQyAzMzkuNTkxNDMgMjAyLjY0OTAzIDMyOS45NTQ2MSAyMDguMjAwNTkgMzIwLjMxNzQ4MDAwMDAwMDA1IDIxMy43NTI0NiBDIDMxOS4wNDE5NDAwMDAwMDAwNyAyMTMuMjc0NDggMzE3Ljc4NDkzMDAwMDAwMDAzIDIxMi42OTg0NiAzMTYuNTQ2NDcwMDAwMDAwMDYgMjEyLjAyNDA4MDAwMDAwMDAzIEMgMzA3Ljg4NTQwMDAwMDAwMDA2IDIwNy4wMTQ2MTAwMDAwMDAwMyAyOTkuMjk1NjcwMDAwMDAwMDMgMjAxLjkzNDExMDAwMDAwMDAzIDI5MC43Nzc4OTAwMDAwMDAwNyAxOTYuNzgyOTEwMDAwMDAwMDIgQyAzMDAuNDQyOTkwMDAwMDAwMDcgMTkxLjIwMjc2IDMxMC4xMzIyOTAwMDAwMDAwNyAxODUuNjUxMjAwMDAwMDAwMDIgMzE5Ljg0NjEwMDAwMDAwMDEgMTgwLjEyNzYxIEMgMzI5LjczMjEyMDAwMDAwMDA3IDE4NS42NzEzMSAzMzkuNTI2MDYwMDAwMDAwMSAxOTEuMzI3ODMgMzQ5LjIyODU2MDAwMDAwMDEgMTk3LjA5NzE2IHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8L3N2Zz4";
class BabylonTW {
	constructor() {

		// targetWasCreated does not work because it runs before the Drawable is set up
		const extension = this;
		const originalMakeClone = RenderedTarget.prototype.makeClone;
		RenderedTarget.prototype.makeClone = function() {
			const newClone = originalMakeClone.call(this);
			if (extension._hasState(this)) {
				// TODO: creates much unneeded state
				const originalSkin = extension._getState(this).skin;
				const newSkin = extension._getState(newClone).skin;
				newSkin.setAlign(originalSkin.align);
				newSkin.setColor(originalSkin.color);
				newSkin.update();
				newSkin.setWidth(originalSkin.textWidth);
				newSkin.setText(originalSkin.text);
				if (renderer._allDrawables[this.drawableID].skin instanceof BabylonCostumeSkin) {
					renderer.updateDrawableSkinId(newClone.drawableID, newSkin.id);
				}
			}
			return newClone;
		};

		vm.runtime.on('targetWasRemoved', (target) => {
			if (this._hasState(target)) {
				const state = this._getState(target);
				renderer.destroySkin(state.skin.id);
			}
		});
	}
	getInfo() {
		return {
			id: 'BabylonTW',
			name: 'BabylonJS',
			blockIconURI: blocksIcon,
			color1: '#e0684b',
			color2: '#cd554b',
			color3: '#bb464b',
			blocks: [
				{
					opcode: 'renderOnOff',
					blockType: Scratch.BlockType.COMMAND,
					text: 'turn rendering [ONOFF]',
					arguments: {
						ONOFF: {
							type: Scratch.ArgumentType.STRING,
							menu: 'ONOFF'
						}
					}
				},
				{
					opcode: 'setText',
					blockType: Scratch.BlockType.COMMAND,
					text: 'show scene',
				},
				{
					opcode: 'clearText',
					blockType: Scratch.BlockType.COMMAND,
					text: 'show sprite'
				},
				{
					opcode: 'update',
					blockType: Scratch.BlockType.COMMAND,
					text: 'update'
				},
				{
					opcode: 'textActive',
					blockType: Scratch.BlockType.BOOLEAN,
					text: 'is showing scene?'
				},
				'---',
				{
					opcode: 'addBlocks',
					blockType: Scratch.BlockType.LABEL,
					text: 'Create Objects'
				},
				{
					opcode: 'newBox',
					blockype: Scratch.BlockType.COMMAND,
					text: 'create new box with size width:[X] height:[Y] depth:[Z] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'box'
						}
					}
				},
				{
					opcode: 'newSphere',
					blockype: Scratch.BlockType.COMMAND,
					text: 'create new sphere with size diameterX:[X] diameterY:[Y] diameterZ:[Z] segments:[SEGMENTS] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						SEGMENTS: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 12
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'sphere'
						}
					}
				},
				{
					opcode: 'hasMesh',
					blockType: Scratch.BlockType.BOOLEAN,
					text: 'object:[NAME] exists?',
					arguments: {
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'removeObject',
					blockType: Scratch.BlockType.COMMAND,
					text: 'remove object:[NAME]',
					arguments: {
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'cloneObject',
					blockType: Scratch.BlockType.COMMAND,
					text: 'clone object:[NAME] clone:[NEWNAME]',
					arguments: {
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						},
						NEWNAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'json_vm_setlist',
					blockType: Scratch.BlockType.COMMAND,
					text: 'list all objects in [list] include hidden:[includeHidden]',
					arguments: {
						list: {
							type: Scratch.ArgumentType.STRING,
							menu: 'get_list'
						},
						includeHidden: {
							type: Scratch.ArgumentType.BOOLEAN
						},
					}
				},
				'---',
				{
					opcode: 'fileMeshes',
					blockType: Scratch.BlockType.LABEL,
					text: 'File Meshes:'
				},
				{
					opcode: 'appendMeshes',
					blockType: Scratch.BlockType.COMMAND,
					text: 'append meshes from URL: [URL]',
					arguments: {
						URL: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'url'
						}
					}
				},
				{
					opcode: 'addFile',
					blockType: Scratch.BlockType.COMMAND,
					text: 'add file named [FILENAME]',
					arguments: {
						FILENAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'mesh'
						}
					}
				},
				{
					opcode: 'addMeshFromFile',
					blockType: Scratch.BlockType.COMMAND,
					text: 'add mesh file name: [FILENAME] object:[NAME]',
					arguments: {
						FILENAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'mesh'
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'addMeshFromURL',
					blockType: Scratch.BlockType.COMMAND,
					text: 'add mesh from URL path: [PATH] file:[URL] object:[NAME]',
					arguments: {
						PATH: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'path'
						},
						URL: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'url'
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'moveFileMeshTo',
					blockType: Scratch.BlockType.COMMAND,
					text: 'move file mesh position to x:[X] y:[Y] z:[Z] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'rotateFileMeshTo',
					blockType: Scratch.BlockType.COMMAND,
					text: 'rotate file mesh to x:[X] y:[Y] z:[Z] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				'---',
				{
					opcode: 'Transform Objects:',
					blockType: Scratch.BlockType.LABEL,
					text: 'Transform Objects:'
				},
				{
					opcode: 'moveObjectTo',
					blockype: Scratch.BlockType.COMMAND,
					text: 'set object position to x:[X] y:[Y] z:[Z] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'moveObjectBy',
					blockype: Scratch.BlockType.COMMAND,
					text: 'change object position by x:[X] y:[Y] z:[Z] [SPACE] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						},
						SPACE: {
							type: Scratch.ArgumentType.STRING,
							menu: 'SPACE_MENU'
						}
					}
				},
				{
					opcode: 'rotateObjectTo',
					blockype: Scratch.BlockType.COMMAND,
					text: 'set object rotation to x:[X] y:[Y] z:[Z] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'rotateObjectBy',
					blockype: Scratch.BlockType.COMMAND,
					text: 'change object rotate by x:[X] y:[Y] z:[Z] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'scaleObjectTo',
					blockType: Scratch.BlockType.COMMAND,
					text: 'scale object to x:[X] y:[Y] z:[Z] object:[NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'getObjectPosition',
					blockType: Scratch.BlockType.REPORTER,
					text: 'get object position object:[NAME] [AXIS]',
					arguments: {
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						},
						AXIS: {
							type: Scratch.ArgumentType.STRING,
							menu: 'XYZ'
						}
					},
				},
				{
					opcode: 'hideShowObject',
					blockType: Scratch.BlockType.COMMAND,
					text: 'object:[NAME] [HIDESHOW]',
					arguments: {
						HIDESHOW: {
							type: Scratch.ArgumentType.STRING,
							menu: 'HIDESHOW'
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'getObjectHitByRay',
					blockType: Scratch.BlockType.REPORTER,
					text: 'get object hit by ray at x:[X] y:[Y]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						}
					}
				},
				{
					opcode: 'projectObject',
					blockType: Scratch.BlockType.REPORTER,
					text: 'project position object:[NAME] axis:[AXIS]',
					arguments: {
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						},
						AXIS: {
							type: Scratch.ArgumentType.STRING,
							menu: 'XY'
						}
					}
				},
				'---',
				{
					opcode: 'addShadow',
					blockType: Scratch.BlockType.COMMAND,
					text: 'addShadows to object:[NAME]',
					arguments: {
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				'---',
				{
					opcode: 'isKeyPressed',
					blockType: Scratch.BlockType.BOOLEAN,
					text: 'is key [KEY] down?',
					arguments: {
						KEY: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'space'
						}
					}
				},
				{
					opcode: 'isMousePressed',
					blockType: Scratch.BlockType.BOOLEAN,
					text: 'is mousebutton [KEY] down?',
					arguments: {
						KEY: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						}
					}
				},
				'---',
				{
					opcode: 'cameraBlocks',
					blockType: Scratch.BlockType.LABEL,
					text: 'Camera'
				},
				{
					opcode: 'setCameraFov',
					blockType: Scratch.BlockType.COMMAND,
					text: 'set camera FOV to [FOV]',
					arguments: {
						FOV: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						}
					}
				},
				{
					opcode: 'moveCameraTo',
					blockType: Scratch.BlockType.COMMAND,
					text: 'set camera position to x:[X] y:[Y] z:[Z]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						}
					}
				},
				{
					opcode: 'moveCameraBy',
					blockType: Scratch.BlockType.COMMAND,
					text: 'change camera position by x:[X] y:[Y] z:[Z]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						}
					}
				},
				{
					opcode: 'moveCameraByLocal',
					blockType: Scratch.BlockType.COMMAND,
					text: 'change camera local position by x:[X] y:[Y] z:[Z]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						}
					}
				},
				{
					opcode: 'rotateCameraTo',
					blockType: Scratch.BlockType.COMMAND,
					text: 'set camera rotation to x:[X] y:[Y] z:[Z]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						}
					}
				},
				{
					opcode: 'rotateCameraBy',
					blockType: Scratch.BlockType.COMMAND,
					text: 'change camera rotation by x:[X] y:[Y] z:[Z]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						}
					}
				},
				{
					opcode: 'rotateCameraByLocal',
					blockType: Scratch.BlockType.COMMAND,
					text: 'change camera local rotation by x:[X] y:[Y] z:[Z]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						}
					}
				},
				{
					opcode: 'getCameraPosition',
					blockType: Scratch.BlockType.REPORTER,
					text: 'camera position [AXIS]',
					arguments: {
						AXIS: {
							type: Scratch.ArgumentType.STRING,
							menu: 'XYZ'
						}
					}
				},
				{
					opcode: 'getCameraRotation',
					blockType: Scratch.BlockType.REPORTER,
					text: 'camera rotation [AXIS]',
					arguments: {
						AXIS: {
							type: Scratch.ArgumentType.STRING,
							menu: 'XYZ'
						}
					}
				},
				'---',
				{
					opcode: 'addSkybox',
					blockType: Scratch.BlockType.COMMAND,
					text: 'add skybox URL path:[PATH]',
					arguments: {
						PATH: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'https://turbowarpgl.shaunreusser.repl.co/hostedmeshes/'
						}
					}
				},
				{
					opcode: 'addSkyboxCostume',
					blockType: Scratch.BlockType.COMMAND,
					text: 'add skybox from costume list'
				},
				'---',
				{
					opcode: 'startSound',
					blockType: Scratch.BlockType.COMMAND,
					text: 'start sound:[SOUND] at x:[X] y:[Y] z:[Z]',
					arguments: {
						SOUND: {
							type: 'sound'
						},
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						}
					}
				},
				{
					opcode: 'stopSound',
					blockType: Scratch.BlockType.COMMAND,
					text: 'stop sound:[SOUND]',
					arguments: {
						SOUND: {
							type: 'sound'
						}
					}
				},
				{
					opcode: 'moveSound',
					blockType: Scratch.BlockType.COMMAND,
					text: 'move sound:[SOUND] to x:[X] y:[Y] z:[Z]',
					arguments: {
						SOUND: {
							type: 'sound'
						},
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 0
						}
					}
				}
			],
			menus: {
				SPACE_MENU: {
					acceptReporters: true,
					items: ['local', 'world']
				},
				ONOFF: {
					acceptReporters: true,
					items: ['on', 'off']
				},
				XYZ: {
					acceptReporters: true,
					items: ['x', 'y', 'z']
				},
				XY: {
					acceptReporters: true,
					items: ['x', 'y']
				},
				CANVAS_MENU: {
					acceptReporters: true,
					items: ['babylonjs canvas', 'stage']
				},
				HIDESHOW: {
					acceptReporters: true,
					items: [
						{
							text: 'hide',
							value: false
						},
						{
							text: 'show',
							value: true
						}
					]
				},
				get_list: {
					acceptReporters: true,
					items: 'getLists'
				},
				animate: {
					acceptReporters: false,
					items: ['type', 'rainbow', 'zoom']
				},
				font: {
					acceptReporters: false,
					items: [
						...NATIVE_FONTS,
						{
							text: 'random font',
							value: 'Random'
						}
					]
				},
				align: {
					acceptReporters: false,
					items: [
						'left',
						'center',
						'right'
					]
				},
				attribute: {
					acceptReporters: false,
					items: [
						'font',
						'color',
						'width'
					]
				}
			}
		};
	}
	getLists() {
		const globalLists = Object.values(vm.runtime.getTargetForStage().variables).filter(x => x.type == 'list');
		const localLists = Object.values(vm.editingTarget.variables).filter(x => x.type == 'list');
		const uniqueLists = [...new Set([...globalLists, ...localLists])];
		if (uniqueLists.length === 0) {
			return [
				{
					text: 'select a list',
					value: 'select a list'
				}
			];
		}
		return uniqueLists.map(i => ({
			text: i.name,
			value: i.id
		}));
	}
	addBabylon() {
		var babylonScript = document.createElement('script');
		babylonScript.type = 'text/javascript';
		babylonScript.src = 'https://cdn.babylonjs.com/babylon.js';
		babylonScript.id = 'babylonScript';

		var glTFLoaderScript = document.createElement('script');
		glTFLoaderScript.type = 'text/javascript';
		glTFLoaderScript.src = 'https://cdn.babylonjs.com/loaders/babylon.glTF2FileLoader.js';
		glTFLoaderScript.id = 'glTFLoaderScript';

		var objLoaderScript = document.createElement('script');
		objLoaderScript.type = 'text/javascript';
		objLoaderScript.src = 'https://cdn.babylonjs.com/loaders/babylon.objFileLoader.js';
		objLoaderScript.id = 'objLoaderScript';

		var stlLoaderScript = document.createElement('script');
		stlLoaderScript.type = 'text/javascript';
		stlLoaderScript.src = 'https://cdn.babylonjs.com/loaders/babylon.stlFileLoader.js';
		stlLoaderScript.id = 'stlLoaderScript';

		// Add event listeners to control the loading sequence
		babylonScript.onload = function() {
			document.head.appendChild(glTFLoaderScript);
		};

		glTFLoaderScript.onload = function() {
			document.head.appendChild(objLoaderScript);
		};

		objLoaderScript.onload = function() {
			document.head.appendChild(stlLoaderScript);
		};

		document.head.appendChild(babylonScript);
		return babylonScript
	}
	hasBabylon() {
		return typeof BABYLON !== 'undefined'
	}
	renderOnOff(args) {
		if (args.ONOFF == 'on') {
			doRender = true;
		} else if (args.ONOFF == 'off') {
			doRender = false;
		}
	}
	simpleScene() {
		objects[0] = scene;
		if (isPackager) {
			engine.runRenderLoop(function() {
				if (doRender) {
					scene.render();
					existingCanvas.style.position = 'absolute';
					existingCanvas.style.zIndex = '5';
					myCanvas.width = existingCanvas.width * (2 / 3);
					myCanvas.height = existingCanvas.height * (2 / 3);
				}
			});
		} else {
			engine.runRenderLoop(function() {
				if (doRender) {
					scene.render();
					existingCanvas.style.position = 'absolute';
					existingCanvas.style.zIndex = '5';
					myCanvas.style.width = existingCanvas.style.width;
					myCanvas.style.height = existingCanvas.style.height;
					myCanvas.width = Math.max(100, vm.runtime.stageWidth * 10);
					myCanvas.height = Math.max(100, vm.runtime.stageHeight * 10);
				}
			});
		}
		engine.resize();
		window.addEventListener("resize", function() {
			engine.resize();
		});
	}
	newBox(args) {
		var newmesh = new BABYLON.MeshBuilder.CreateBox(args.NAME, { width: args.X, height: args.Y, depth: args.Z });
		shadowGenerator.getShadowMap().renderList.push(newmesh);
		newmesh.recieveShadows = true;
	}
	newSphere(args) {
		var newmesh = new BABYLON.MeshBuilder.CreateSphere(args.NAME, { diameterX: args.X, diameterY: args.Y, diameterZ: args.Z, segments: args.SEGMENTS });
		shadowGenerator.getShadowMap().renderList.pushnew(mesh);
		newmesh.recieveShadows = true;
	}
	moveObjectTo(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		mesh.position = new BABYLON.Vector3(args.X, args.Y, args.Z);
	}

	getObjectPosition(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		console.log(mesh);
		console.log(args.AXIS);
		return mesh.position[args.AXIS];
	}

	scaleObjectTo(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		mesh.scaling = new BABYLON.Vector3(args.X, args.Y, args.Z);
	}
	moveObjectBy(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		if (args.SPACE == 'local') {
			var space = BABYLON.Space.LOCAL;
		} else if (args.SPACE == 'world') {
			var space = BABYLON.Space.WORLD;
		};
		mesh.translate(new BABYLON.Vector3(args.X, args.Y, args.Z), BABYLON.Space.WORLD);
	}
	rotateObjectTo(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		mesh.rotation = new BABYLON.Vector3(args.X * Math.PI / 180, args.Y * Math.PI / 180, args.Z * Math.PI / 180);
	}
	rotateObjectBy(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		/*
		var space;
		if (args.SPACE == 'local') {
			var space = BABYLON.Space.LOCAL;
		} else if (args.SPACE == 'world') {
			var space = BABYLON.Space.WORLD;
		};
		mesh.rotate(new BABYLON.Vector3(args.X * Math.PI / 180, args.Y * Math.PI / 180, args.Z * Math.PI / 180), 0);
	*/
		const rotX = BABYLON.Tools.ToRadians(args.X);
		const rotY = BABYLON.Tools.ToRadians(args.Y);
		const rotZ = BABYLON.Tools.ToRadians(args.Z);
		mesh.rotation.x += rotX;
		mesh.rotation.y += rotY;
		mesh.rotation.z += rotZ;
	}
	isKeyPressed(args) {
		return isKeyDown(args.KEY)
	}
	isMousePressed(args) {
		return mouseButtons.get(args.KEY) || false
	}
	moveCameraTo(args) {
		camera.position = new BABYLON.Vector3(args.X, args.Y, args.Z);
	}
	moveCameraBy(args) {
		camera.position = new BABYLON.Vector3(camera.position.x + args.X, camera.position.y + args.Y, camera.position.z + args.Z);
	}
	moveCameraByLocal(args) {
		// Define the translation amount for each axis
		var localTranslation = new BABYLON.Vector3(args.X, args.Y, args.Z);

		// Convert the local translation to world space using the camera's rotation
		var worldTranslation = BABYLON.Vector3.TransformNormal(localTranslation, camera.getWorldMatrix());

		// Apply the translated position to the camera
		camera.position.addInPlace(worldTranslation);
	}
	rotateCameraTo(args) {
		// Convert rotation angles to radians
		const xRad = args.X * Math.PI / 180;
		const yRad = args.Y * Math.PI / 180;
		const zRad = args.Z * Math.PI / 180;

		// Create quaternions for each axis
		const quaternionX = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, xRad);
		const quaternionY = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, yRad);
		const quaternionZ = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, zRad);

		// Combine the quaternions to get the final rotation quaternion
		const rotationQuaternion = quaternionX.multiply(quaternionY).multiply(quaternionZ);

		// Apply the rotation to the camera
		camera.rotationQuaternion = rotationQuaternion;
	}
	rotateCameraByLocal(args) {
		// Convert rotation angles to radians
		const xRad = args.X * Math.PI / 180;
		const yRad = args.Y * Math.PI / 180;
		const zRad = args.Z * Math.PI / 180;

		// Create quaternions for each axis
		const quaternionX = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, xRad);
		const quaternionY = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, yRad);
		const quaternionZ = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, zRad);

		// Get the current rotation quaternion of the camera
		const currentRotation = camera.rotationQuaternion || BABYLON.Quaternion.Identity();

		// Combine the quaternions to get the final rotation quaternion
		const rotationQuaternion = currentRotation.multiply(quaternionX).multiply(quaternionY).multiply(quaternionZ);

		// Apply the rotation to the camera
		camera.rotationQuaternion = rotationQuaternion;
	}
	rotateCameraBy(args) {
		const rotationX = Math.PI / 180 * args.X;
		const rotationY = Math.PI / 180 * args.Y;
		const rotationZ = Math.PI / 180 * args.Z;
		camera.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, rotationX).multiply(camera.rotationQuaternion);
		camera.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, rotationY).multiply(camera.rotationQuaternion);
		camera.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, rotationZ).multiply(camera.rotationQuaternion);
	}
	getCameraRotation(args) {
		return BABYLON.Tools.ToDegrees(camera.rotationQuaternion.toEulerAngles()[args.AXIS]);
	}
	getCameraPosition(args) {
		if (args.AXIS == 'x') {
			return camera.position.x
		} else if (args.AXIS == 'y') {
			return camera.position.y
		} else {
			return camera.position.z
		}
	}
	addFile(args) {
		fileInput.click();
		fileNames.push(args.FILENAME);
	}
	addMeshFromFile(args) {
		var index = fileNames.findIndex((element) => element === args.FILENAME);
		console.log(files[index]);
		/*meshRotX.push(0);
		meshRotY.push(0);
		meshRotZ.push(0);
		*/
		//var filetype = fileTypes[index][0];
		var filetype = '.glb';
		console.log(filetype);
		var dataURL = URL.createObjectURL(files[index]);
		/*result = BABYLON.SceneLoader.ImportMesh("", "", dataURL, scene, function (newMeshes) {
			newMeshes[0].name = args.NAME;
		}, null, null, filetype);
		*/
		var meshPromise = profil_gltf(dataURL, filetype, args.NAME)
		meshPromises.push(meshPromise);
		meshPromiseNames.push(args.NAME);

		meshPromise.then(function(result) {
			shadowGenerator.addShadowCaster(result, true);
			result.recieveShadows = true;
		})
		/*
		var promise = meshPromises[0].then(function(result) {
			result.position.x = -1;
		})
		*/
	}
	moveFileMeshTo(args) {
		var index = meshPromiseNames.findIndex((element) => element === args.NAME);
		console.log(meshPromises[index]);
		meshPromises[0].then(function(result) {
			result.position = new BABYLON.Vector3(args.X, args.Y, args.Z)
		})
	}
	rotateFileMeshTo(args) {
		var index = meshPromiseNames.findIndex((element) => element === args.NAME);
		console.log(index);
		console.log(meshPromises[index]);
		meshPromises[0].then(function(result) {
			result.rotation = new BABYLON.Vector3(args.X * Math.PI / 180, args.Y * Math.PI / 180, args.Z * Math.PI / 18)
		})
	}
	addMeshFromURL(args) {
		var filetype = '.glb';
		console.log(filetype);
		console.log(args.PATH);
		console.log(args.URL);
		console.log(args.NAME);
		/*result = BABYLON.SceneLoader.ImportMesh("", "", dataURL, scene, function (newMeshes) {
			newMeshes[0].name = args.NAME;
		}, null, null, filetype);
		*/
		var meshPromise = profil_gltf_url(args.PATH, args.URL, filetype, args.NAME);
		meshPromises.push(meshPromise);
		meshPromiseNames.push(args.NAME);

		meshPromise.then(function(result) {
			//shadowGenerator.addShadowCaster(result, true);
			//result.recieveShadows = true;
		})
	}
	addSkybox(args) {
		let path = args.PATH;
		let png_array = ['sky/sky_px.jpg', 'sky/sky_py.jpg', 'sky/sky_pz.jpg', 'sky/sky_nx.jpg', 'sky/sky_ny.jpg', 'sky/sky_nz.jpg'];
		let skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 5000.0 }, objects[0]);
		let skyboxMaterial = new BABYLON.StandardMaterial('sky', objects[0]);
		skyboxMaterial.backFaceCulling = false;
		skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(path, objects[0], png_array);
		skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
		skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
		skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
		skybox.material = skyboxMaterial;
	}
	async appendMeshes(args) {
		await BABYLON.SceneLoader.AppendAsync("", args.URL);
	}
	addShadow(args) {
		let meshToShadow = objects[0].getMeshByName(args.NAME);
		console.log(meshToShadow);
		meshToShadow.receiveShadows = true;
		shadowGenerator.addShadowCaster(meshToShadow, true);
	}
	addSkyboxCostume(args) {
		var base64String = vm.getCostume(0);
		var base64Data = base64String.split(",")[1];
		var decodedData = atob(base64Data);
		var arrayBuffer = new Uint8Array(decodedData.length);
		for (var i = 0; i < decodedData.length; ++i) {
			arrayBuffer[i] = decodedData.charCodeAt(i);
		}
		var blob = new Blob([arrayBuffer], { type: 'image/png' });
		var url = URL.createObjectURL(blob);

		const boxMat = new BABYLON.StandardMaterial("sky");
		boxMat.specularColor = new BABYLON.Color3(1, 1, 1);
		boxMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
		boxMat.emissiveTexture = new BABYLON.Texture(url);
		boxMat.diffuseTexture = new BABYLON.Texture(url);
		boxMat.cullBackFaces = false;
		const faceUV = [];
		faceUV[0] = new BABYLON.Vector4(0.75, 0.334, 1.0, 0.6665);
		faceUV[1] = new BABYLON.Vector4(0.25, 0.334, 0.5, 0.6665);
		faceUV[2] = new BABYLON.Vector4(0.5, 0.334, 0.75, 0.6665);
		faceUV[3] = new BABYLON.Vector4(0.0, 0.334, 0.25, 0.6665);
		faceUV[4] = new BABYLON.Vector4(0.25, 0.6665, 0.5, 1.0);
		faceUV[5] = new BABYLON.Vector4(0.25, 0, 0.5, 0.334);
		const box = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 5000, faceUV: faceUV, wrap: true });
		box.material = boxMat;
		box.position.y = 0.5;
	}
	setCameraFov(args) {
		camera.fov = args.FOV;
	}
	removeObject(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		mesh.dispose();
	}
	cloneObject(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		mesh.clone(args.NEWNAME);
	}
	getObjectHitByRay(args) {
		//var canvX = 10 * (args.X + vm.runtime.stageWidth);
		//var canvY = 10 * (-args.Y + vm.runtime.stageHeight);
		var canvX = args.X * 10;
		var canvY = args.Y * -10;
		canvX += vm.runtime.stageWidth * 5;
		canvY += vm.runtime.stageHeight * 5;
		console.log(canvX);
		var ray = objects[0].createPickingRay(canvX, canvY, BABYLON.Matrix.Identity(), camera);
		var hit = objects[0].pickWithRay(ray);
		if (hit.pickedMesh !== null) {
			return hit.pickedMesh.name
		} else {
			return 'null'
		}
	}
	projectObject(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		var pos = BABYLON.Vector3.Project(mesh.position, BABYLON.Matrix.Identity(), objects[0].getTransformMatrix(), { x: vm.runtime.stageWidth / -2, y: vm.runtime.stageHeight / -2, width: vm.runtime.stageWidth, height: vm.runtime.stageHeight });
		var posx = pos.x;
		var posy = pos.y;
		posy *= -1;
		if (args.AXIS == 'x') {
			return posx
		} else {
			return posy
		}
	}
	switchCanvas(args) {
		if (args.CANVAS == 'stage') {
			myCanvas.style.zIndex = '3';
		} else {
			myCanvas.style.zIndex = '6';
		}
	}
	hideShowObject(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		const hideshow = !!args.HIDESHOW;
		console.log(hideshow);
		mesh.setEnabled(hideshow);
	}
	startSound(args, util) {
		console.log(util);
		util.target.onStopAll = function() {
			stopAndDeleteSoundByName(objects[0], name);
			console.log('stopped');
		};
		const name = Scratch.Cast.toString(args.SOUND);
		const index = getSoundIndexByName(util.target.getSounds(), name);
		const sound = new BABYLON.Sound(name, vm.getSoundBuffer(index), objects[0],
			null, { loop: false, autoplay: true, spatialSound: true });
		sound.setPosition(new BABYLON.Vector3(args.X, args.Y, args.Z));
	}
	stopSound(args) {
		const name = Scratch.Cast.toString(args.SOUND);
		stopAndDeleteSoundByName(objects[0], name);
	}
	hasMesh(args) {
		return objects[0].getMeshByName(args.NAME) != null
	}
	moveSound(args) {
		const position = new BABYLON.Vector3(args.X, args.Y, args.Z);
		const name = Scratch.Cast.toString(args.SOUND);
		const sounds = objects[0].mainSoundTrack.soundCollection;
		for (const sound of sounds) {
			if (sound.name === name) {
				sound.setPosition(position);
				break;
			}
		}
	}

	lookupList(list, util) {
		const byId = util.target.lookupVariableById(list);
		if (byId && byId.type === 'list') {
			return byId;
		}
		const byName = util.target.lookupVariableByNameAndType(list, 'list');
		if (byName) {
			return byName;
		}
		return null;
	}
	json_vm_setlist({ list, json, includeHidden }, util) {
		const activeMeshNames = [];
		objects[0].meshes.forEach((mesh) => {
			if ((includeHidden || mesh.isEnabled())) {
				activeMeshNames.push(mesh.name);
			}
		});
		try {
			let listVariable = this.lookupList(list, util);
			if (listVariable) {
				if (Array.isArray(activeMeshNames)) {
					const safeArray = activeMeshNames.map(i => {
						if (typeof i === 'object') return JSON.stringify(i);
						return i;
					});
					listVariable.value = safeArray;
				}
			}
		} catch (e) {
			// ignore
		}
		return '';
	}
	_getState(target) {
		const state = target[CUSTOM_STATE_KEY];
		if (!state) {
			/** @type {TextState} */
			const newState = {
				skin: createBabylonCostumeSkin(target)
			};
			target[CUSTOM_STATE_KEY] = newState;
			return newState;
		}
		return state;
	}

	/**
	 * @param {VM.Target} target
	 * @returns {boolean}
	 */
	_hasState(target) {
		return !!target[CUSTOM_STATE_KEY];
	}

	_hideAllText() {
		for (const target of vm.runtime.targets) {
			if (this._hasState(target)) {
				this._hideText(target, this._getState(target));
			}
		}
	}

	/**
	 * @param {VM.Target} target
	 * @param {TextState} state
	 */
	_renderText(target, state) {
		state.skin.cancelAnimation();
		renderer.updateDrawableSkinId(target.drawableID, state.skin.id);
	}

	/**
	 * @param {VM.Target} target
	 * @param {TextState} state
	 */
	_hideText(target, state) {
		state.skin.cancelAnimation();
		target.setCostume(target.currentCostume);
	}

	setText({ TEXT }, util) {
		const state = this._getState(util.target);
		this._renderText(util.target, state);
		state.skin.setText(Scratch.Cast.toString(TEXT));
		// Scratch forces 1 frame delay by returning promise. I think that's silly.
		util.runtime.requestRedraw();
	}

	clearText(args, util) {
		if (this._hasState(util.target)) {
			const state = this._getState(util.target);
			this._hideText(util.target, state);
		}
		// Scratch forces 1 frame delay by returning promise. I think that's silly.
		util.runtime.requestRedraw();
	}

	update(args, util) {
		const state = this._getState(util.target);
		state.skin._invalidateTexture();
	}

	textActive(args, util) {
		const drawableID = util.target.drawableID;
		const skin = renderer._allDrawables[drawableID].skin;
		return skin instanceof BabylonCostumeSkin;
	}
}



var newCanv = document.createElement('canvas');
//newCanv.width = 300;
//newCanv.height = 300;

/*
newCanv.width = Math.max(300, vm.runtime.stageWidth * 10);
newCanv.height = Math.max(300, vm.runtime.stageHeight * 10);
*/
newCanv.style.height = '0';

var babylonScript = document.createElement('script');
babylonScript.type = 'text/javascript';
babylonScript.src = 'https://cdn.babylonjs.com/babylon.js';
babylonScript.id = 'babylonScript';

var glTFLoaderScript = document.createElement('script');
glTFLoaderScript.type = 'text/javascript';
glTFLoaderScript.src = 'https://cdn.babylonjs.com/loaders/babylon.glTF2FileLoader.js';
glTFLoaderScript.id = 'glTFLoaderScript';

var objLoaderScript = document.createElement('script');
objLoaderScript.type = 'text/javascript';
objLoaderScript.src = 'https://cdn.babylonjs.com/loaders/babylon.objFileLoader.js';
objLoaderScript.id = 'objLoaderScript';

var stlLoaderScript = document.createElement('script');
stlLoaderScript.type = 'text/javascript';
stlLoaderScript.src = 'https://cdn.babylonjs.com/loaders/babylon.stlFileLoader.js';
stlLoaderScript.id = 'stlLoaderScript';

var havokjsLoaderScript = document.createElement('script');
havokjsLoaderScript.type = 'text/javascript';
havokjsLoaderScript.src = 'https://cdn.babylonjs.com/havok/HavokPhysics_umd.js';
havokjsLoaderScript.id = 'havokjs';

// Add event listeners to control the loading sequence
babylonScript.onload = function() {
	document.head.appendChild(glTFLoaderScript);
};

glTFLoaderScript.onload = function() {
	document.head.appendChild(objLoaderScript);
};

objLoaderScript.onload = function() {
	document.head.appendChild(stlLoaderScript);
};

babylonScript.onload = function() {
	document.head.appendChild(havokjsLoaderScript);
};

document.head.appendChild(babylonScript);

havokjsLoaderScript.onload = function() {

	let havokInstance;

	HavokPhysics().then((havok) => {
		havokInstance = havok;
		const interval = setInterval(function() {
			//console.log(vm.runtime.stageWidth);
			//console.log(vm.runtime.stageHeight);
			if (vm) {
				newCanv.width = Math.min(Math.max(vm.runtime.stageWidth * 10, 1000), 10000);
				newCanv.height = Math.min(Math.max(vm.runtime.stageHeight * 10, 1000), 10000);
			}
			//newCanv.width = Math.min(Math.max(vm.runtime.stageWidth * 10, 300), 10000);
			//newCanv.height = Math.min(Math.max(vm.runtime.stageHeight * 10, 300), 10000);
			//newCanv.width = Math.min(Math.max(6400, 1000), 10000);
			//newCanv.height = Math.min(Math.max(3600, 1000), 10000);
		}, 1000);
		const engine = new BABYLON.Engine(newCanv, true); // Generate the BABYLON 3D engine
		const createScene = function() {
			var scene = new BABYLON.Scene(engine);
			objects[0] = scene;

			const hk = new BABYLON.HavokPlugin(true, havokInstance);
			objects.splice(1, 0, hk);
			scene.enablePhysics(new BABYLON.Vector3(0, -9.8, 0), hk);
			camera = new BABYLON.FreeCamera("camera1",
				new BABYLON.Vector3(0, 5, -10), scene);
			objects.push(camera);
			camera.rotationQuaternion = camera.rotationQuaternion || BABYLON.Quaternion.Identity();
			// Targets the camera to scene origin
			camera.setTarget(BABYLON.Vector3.Zero());
			// This attaches the camera to the canvas
			//camera.attachControl(canvas, true);
			// Creates a light, aiming 0,1,0 - to the sky
			var light = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-1, -2, 1), scene);
			light.position = new BABYLON.Vector3(20, 40, -20);

			var defaultPipeline = new BABYLON.DefaultRenderingPipeline("default", true, scene, [camera]);
			defaultPipeline.bloomEnabled = true;
			defaultPipeline.fxaaEnabled = false;
			defaultPipeline.samples = 4;
			defaultPipeline.bloomWeight = 0.3;
			defaultPipeline.imageProcessing.toneMappingEnabled = true;
			defaultPipeline.imageProcessing.vignetteEnabled = true;
			//defaultPipeline.imageProcessing.vignetteColor = true;
			defaultPipeline.imageProcessing.vignetteWeight = 1;
			defaultPipeline.imageProcessing.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
			defaultPipeline.imageProcessing.colorCurvesEnabled = true;
			defaultPipeline.imageProcessing.contrast = 1.1;
			defaultPipeline.imageProcessing.exposure = 1;

			//var motionblur = new BABYLON.MotionBlurPostProcess('mb', scene, 1.0, camera);
			//motionblur.motionStrength = 5;

			var curve = new BABYLON.ColorCurves();

			shadowGenerator = new BABYLON.ShadowGenerator(4096, light);
			shadowGenerator.bias = 0.001;
			shadowGenerator.normalBias = 0.02;
			light.shadowMaxZ = 100;
			light.shadowMinZ = 10;
			shadowGenerator.useContactHardeningShadow = true;
			shadowGenerator.contactHardeningLightSizeUVRatio = 0.05;
			shadowGenerator.setDarkness(0.5);
			// Built-in 'sphere' shape.
			const sphere = BABYLON.MeshBuilder.CreateSphere("sphere",
				{ diameter: 2, segments: 32 }, scene);
			objects.push(sphere);
			shadowGenerator.getShadowMap().renderList.push(sphere);

			sphere.receiveShadows = true;
			// Move the sphere upward 1/2 its height
			sphere.position.y = 1;
			// Built-in 'ground' shape.
			const ground = BABYLON.MeshBuilder.CreateGround("ground",
				{ width: 6, height: 6 }, scene);
			shadowGenerator.getShadowMap().renderList.push(ground);
			ground.receiveShadows = true;
			return scene;
		};
		const scene = createScene();
		if (!isPackager) {
			newCanv.style.height = '0';
		}
		engine.runRenderLoop(function() {
			scene.render();
			document.getElementsByTagName('canvas')[0].style.height = '0';
		});
		window.addEventListener("resize", function() {
			engine.resize();
		});
		Scratch.extensions.register(new BabylonTW());
	});
}
