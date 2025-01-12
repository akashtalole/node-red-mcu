import Mustache from "mustache";
import { Node } from "nodered";
import {
	buildTheme,
	REDButton,
	REDDropDown,
	REDNumeric,
	REDSlider,
	REDSpacer,
	REDSwitch,
	REDTextRowLeft,
	REDTextRowCenter,
	REDTextRowRight,
	REDTextRowSpread,
	REDTextColumnCenter,
	UNIT
}  from "./ui_templates";


const Templates = {
};

function registerTemplate(name, Template) {
	Templates[name] = Template;
}

const model = {
	selection: 0,
	tabs:[],
};

function checkValue(value, type) {
	if (type == "bool") {
		if (value == "false")
			value = false;
		else if (value == "true")
			value = true;
		else
			value = Boolean(value);
	}
	return value;
}

function insert(items, item) {
	const length = items.length;
	for (let index = 0; index < length; index++) {
		if (items[index].order > item.order) {
			items.splice(index, 0, item);
			return;;
		}
	}
	items.push(item);
}

function registerConstructor(type, constructor) {
	constructor.type = type;
	RED.nodes.registerType(type, constructor);
}

class UINode extends Node {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.order = parseInt(config.order);
	}
}

class UIBaseNode extends Node {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		model.showTitleBar = config.site.hideToolbar == "false";
		buildTheme(config.theme);
	}
}
registerConstructor("ui_base", UIBaseNode);

class UIControlNode extends UINode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		const groupNode = RED.nodes.getNode(config.group);
		insert(groupNode.controls, this);
		this.width = parseInt(config.width);
		this.height = parseInt(config.height);
	}
	lookupTemplate(config, Template) {
		const name = config.className;
		let result;
		if (name)
			result = Templates[name];
		if (!result)
			result = Template;
		return result;
	}
	measure(group) {
		if (this.width == 0)
			this.width = group.width;
		if (this.height == 0)
			this.height = 1;
	}
	position(group) {
		const lines = group.lines;
		function isEmpty(x, y) {
			if (y >= lines.length)
				return true;
			const line = lines[y];
			if (x >= line.length)
				return false;
			return line[x] ? false : true;
		}
		const groupWidth = group.width;
		const groupHeight = lines.length;
		const width = this.width;
		const height = this.height;
		let x, y, left, top, right, bottom;
		let done = false;
		for (y = 0; y <= groupHeight; y++) {
			for (x = 0; x < groupWidth; x++) {
				if (isEmpty(x, y)) {
					done = true;
					bottom = y + height;
					right = x + width;
					for (top = y; top < bottom; top++) {
						for (left = x; left < right; left++) {
							if (!isEmpty(left, top)) {
								done = false;
								break;
							}
						}
					}
				}
				if (done)
					break;
			}
			if (done)
				break;
		}
		this.left = x;
		this.top = y;
		for (top = groupHeight; top < bottom; top++)
			lines.push(new Uint8Array(groupWidth));
		for (top = y; top < bottom; top++)
			lines[top].fill(1, x, right);
	}
}

class UIButtonNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(this.msg);
	}
	onStart(config) {
		super.onStart(config);
		this.bgcolor = config.bgcolor;
		this.color = config.color;
		this.label = config.label;
		this.msg = {
			payload: checkValue(config.payload, config.payloadType),
			topic: config.topic,
		}
		this.passthru = config.passthru;
		this.Template = this.lookupTemplate(config, REDButton);
	}
	onTap() {
		this.send(this.msg);
	}
}
registerConstructor("ui_button", UIButtonNode);

class UIColorPickerNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		const { r, g, b, a } = this.color;
		let payload;
		function toHex(n) {
			return (n < 16) ? "0" + n.toString(16) : n.toString(16);
		}
		if (this.format == "hex") {
			payload = toHex(r) + toHex(g) + toHex(b);
		}
		else if (this.format == "hex8") {
			payload = toHex(r) + toHex(g) + toHex(b) + toHex(a);
		}
		else if (this.outformat == "object") {
			if (this.format == "hsl")
				payload = this.hsl;
			else if (this.format == "hsv")
				payload = this.hsv;
			else
				payload = this.rgb;
		}
		else {
			if (this.format == "hsl") {
				const hsl = this.hsl;
				payload = `hsl(${hsl.h},${hsl.s},${hsl.l})`;
			}
			else if (this.format == "hsv") {
				const hsv = this.hsv;
				payload = `hsv(${hsv.h},${hsv.s},${hsv.v})`;
			}
			else {
				const rgb = this.rgb;
				payload = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
			}
		}
		this.msg.payload = payload;
		this.send(this.msg);
	}
	onMessage(msg) {
		const payload = msg.payload;
		const r = 0, g = 0, b = 0, a = 255;
		if (typeof(payload) == "object") {
			if (payload.hasOwnProperty("r") && payload.hasOwnProperty("g") && payload.hasOwnProperty("b"))
				this.rgb = payload;
			else if (payload.hasOwnProperty("h") && payload.hasOwnProperty("s")) {
				if (payload.hasOwnProperty("l"))
					this.hsl = payload;
				else if (payload.hasOwnProperty("v"))
					this.hsv = payload;
			}
		}
		else if (typeof(payload) == "string") {
			debugger
		}
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(this.msg);
	}
	onStart(config) {
		super.onStart(config);
		this.dynOutput = config.dynOutput;
		this.format = config.format;
		this.label = config.label;
		this.outformat = config.outformat;
		this.msg = { topic: config.topic }
		this.passthru = config.passthru;
		this.color = { r:255, g:255, b:255, a:255 };
		this.Template = this.lookupTemplate(config, REDSpacer);
	}
	onTap() {
		this.send(this.msg);
	}
	get hsl() {
		const color = this.color;
		const r = color.r / 255;
		const g = color.g / 255;
		const b = color.b / 255;
		const a = color.a / 255;
		const l = Math.max(r, g, b);
		const s = l - Math.min(r, g, b);
		const h = s ? l === r ? (g - b) / s : l === g ? 2 + (b - r) / s : 4 + (r - g) / s : 0;
		return {
			h:60 * h < 0 ? 60 * h + 360 : 60 * h,
			s:(s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0),
			l:((2 * l - s)) / 2,
			a
		};
	}
	set hsl(it) {
		let h = Math.mod(it.h, 360);
		if (h < 0)
			h += 360;
		let s = Math.max(0, Math.min(1, it.s));
		let l = Math.max(0, Math.min(1, it.l));
		const k = n => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		const color = this.color;
		color.r = Math.round(255 * f(0));
		color.g = Math.round(255 * f(8));
		color.b = Math.round(255 * f(4));
		if (it.hasOwnProperty("a"))
			color.a = Math.max(0, Math.min(255, Math.round(it.a * 255)));
		else
			color.a = 255;
	}
	get hsv() {
		const color = this.color;
		const r = color.r / 255;
		const g = color.g / 255;
		const b = color.b / 255;
		const a = color.a / 255;
		const v = Math.max(r, g, b), n = v - Math.min(r, g, b);
		const h = n === 0 ? 0 : n && v === r ? (g - b) / n : v === g ? 2 + (b - r) / n : 4 + (r - g) / n;
		return {
			h:60 * (h < 0 ? h + 6 : h),
			s:v && (n / v),
			v,
			a
		};
	}
	set hsv(it) {
		let h = Math.mod(it.h, 360);
		if (h < 0)
			h += 360;
		let s = Math.max(0, Math.min(1, it.s));
		let v = Math.max(0, Math.min(1, it.v));
		const k = (n) => (n + h / 60) % 6;
		const f = (n) => v * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
		const color = this.color;
		color.r = Math.round(255 * f(5));
		color.g = Math.round(255 * f(3));
		color.b = Math.round(255 * f(1));
		if (it.hasOwnProperty("a"))
			color.a = Math.max(0, Math.min(255, Math.round(it.a * 255)));
		else
			color.a = 255;
	}
	get rgb() {
		const color = this.color;
		return {
			r: color.r,
			g: color.g,
			b: color.b,
			a: color.a / 255
		}
	}
	set rgb(it) {
		const color = this.color;
		color.r = Math.max(0, Math.min(255, Math.round(it.r)));
		color.g = Math.max(0, Math.min(255, Math.round(it.g)));
		color.b = Math.max(0, Math.min(255, Math.round(it.b)));
		if (it.hasOwnProperty("a"))
			color.a = Math.max(0, Math.min(255, Math.round(it.a * 255)));
		else
			color.a = 255;
	}
}
registerConstructor("ui_colour_picker", UIColorPickerNode);


class UIDropDownNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.options[this.selection].value;
		this.send(this.msg);
	}
	onMessage(msg) {
		this.selection = this.options.findIndex(option => option.value == msg.payload);
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.options = config.options;
		this.passthru = config.passthru;
		this.placeHolder = config.place;
		this.selection = -1;
		
		this.Template = this.lookupTemplate(config, REDDropDown);
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_dropdown", UIDropDownNode);

class UINumericNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.value;
		this.send(this.msg);
	}
	onMessage(msg) {
		const { min, max, step } = this;
		let value = parseInt(msg.payload);
		if (value < min)
			value = min;
		else if (value > max)
			value = max;
		else
			value = Math.round(value / step) * step;
		this.value = value;
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.min = config.min;
		this.max = config.max;
		this.step = config.step;
		this.passthru = config.passthru;
		this.value = this.min;
		this.wrap = config.wrap;
		
		this.Template =  this.lookupTemplate(config, REDNumeric);
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_numeric", UINumericNode);

class UISliderNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.value;
		this.send(this.msg);
	}
	onMessage(msg) {
		const { min, max, step } = this;
		let value = parseInt(msg.payload);
		if (value < min)
			value = min;
		else if (value > max)
			value = max;
		else
			value = Math.round(value / step) * step;
		this.value = value;
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.continuous = config.outs == "all";
		this.label = config.label;
		this.min = config.min;
		this.max = config.max;
		this.step = config.step;
		this.passthru = config.passthru;
		this.value = this.min;
		
		this.Template =  this.lookupTemplate(config, REDSlider);
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_slider", UISliderNode);

class UISpacerNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.Template = REDSpacer;
	}
}
registerConstructor("ui_spacer", UISpacerNode);

class UITemplateNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		this.payload = msg.payload;
		this.container?.delegate("onUpdate");
	}
	onStart(config) {
		super.onStart(config);
		this.payload = "";
		this.Template = this.lookupTemplate(config, REDSpacer);
	}
}
registerConstructor("ui_template", UITemplateNode);

class UISwitchNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.options[this.selection].value;
		this.send(this.msg);
	}
	onMessage(msg) {
		this.selection = this.options.findIndex(option => option.value === msg.payload);
		if (this.selection < 0)
			this.selection = 0;
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.options = [
			{ value:checkValue(config.offvalue, config.offvalueType), type:config.offvalueType },
			{ value:checkValue(config.onvalue, config.onvalueType), type:config.onvalueType },
		];
		this.passthru = config.passthru;
		this.selection = 0;
		
		this.Template = this.lookupTemplate(config, REDSwitch);
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_switch", UISwitchNode);

class UITextNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		this.value = Mustache.render(this.format, { msg });
		this.container?.delegate("onUpdate");
	}
	onStart(config) {
		super.onStart(config);
		this.format = config.format;
		this.label = config.label;
		this.value = "";
		
		let Template;
		switch (config.layout) {
		case "row-left": Template = REDTextRowLeft; break;
		case "row-center": Template = REDTextRowCenter; break;
		case "row-right": Template = REDTextRowRight; break;
		case "col-center": Template = REDTextColumnCenter; break;
		default: Template = REDTextRowSpread; break;
		}
		this.Template = this.lookupTemplate(config, Template);
	}
}
registerConstructor("ui_text", UITextNode);

class UIGroupNode extends UINode {
	constructor(id, flow, name) {
		super(id, flow, name);
		this.controls = [];
	}
	onStart(config) {
		super.onStart(config);
		this.collapse = config.collapse;
		this.disp = config.disp;
		this.width = parseInt(config.width);
		const tabNode = RED.nodes.getNode(config.tab);
		insert(tabNode.groups, this);
	}
}
registerConstructor("ui_group", UIGroupNode);

class UITabNode extends UINode {
	constructor(id, flow, name) {
		super(id, flow, name);
		this.groups = [];
	}
	onStart(config) {
		super.onStart(config);
		insert(model.tabs, this);
	}
}
registerConstructor("ui_tab", UITabNode);

export default function() {
	model.enableTitleBar = model.tabs.length > 1;
	model.tabs.forEach(tab => {
		let height = model.showTitleBar ? 1 : 0;
		tab.enableTitleBar = model.enableTitleBar;
		tab.showTitleBar = model.showTitleBar;
		tab.groups.forEach(group => {
			group.lines = [];
			group.controls.forEach(control => {
				control.measure(group);
				control.position(group);	
			});
			group.height = group.lines.length;
			if (group.disp)
				group.height++;
			height += group.height;
			delete group.lines;
		});
		tab.height = height;
	});

	model.tabs.forEach(tab => {
		tab.groups.forEach(group => {
			group.width *= UNIT;
			group.height *= UNIT;
			group.controls.forEach(control => {
				control.left *= UNIT;
				control.width *= UNIT;
				control.top *= UNIT;
				control.height *= UNIT;
			});
		});
		tab.height *= UNIT;
	});
	return model;
}

export { UIControlNode, registerConstructor, registerTemplate };