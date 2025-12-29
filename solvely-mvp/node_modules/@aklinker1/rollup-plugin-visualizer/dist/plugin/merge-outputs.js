"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeJsonOutputs = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const open_1 = __importDefault(require("open"));
const render_template_1 = require("../plugin/render-template");
const warn_1 = require("../plugin/warn");
const version_1 = require("../plugin/version");
async function mergeJsonOutputs(options) {
    const { inputs, filename = "./stats.html", title = "Rollup Visualizer", template = "treemap", open = false, } = options;
    if (inputs.length === 0) {
        throw new Error("Empty file list");
    }
    const fileContents = await Promise.all(inputs.map(async (file) => {
        const textContent = await fs_1.promises.readFile(file, { encoding: "utf-8" });
        const data = JSON.parse(textContent);
        return { file, data };
    }));
    const tree = {
        name: "root",
        children: [],
    };
    const nodeParts = {};
    const nodeMetas = {};
    for (const { file, data } of fileContents) {
        if (data.version !== version_1.version) {
            (0, warn_1.warn)(`Version in ${file} is not supported (${data.version}). Current version ${version_1.version}. Skipping...`);
            continue;
        }
        if (data.tree.name === "root") {
            tree.children = tree.children.concat(data.tree.children);
        }
        else {
            tree.children.push(data.tree);
        }
        Object.assign(nodeParts, data.nodeParts);
        Object.assign(nodeMetas, data.nodeMetas);
    }
    const data = {
        version: version_1.version,
        tree,
        nodeParts,
        nodeMetas,
        env: fileContents[0].data.env,
        options: fileContents[0].data.options,
    };
    const fileContent = await (0, render_template_1.renderTemplate)(template, {
        title,
        data: JSON.stringify(data),
    });
    await fs_1.promises.mkdir(path_1.default.dirname(filename), { recursive: true });
    try {
        await fs_1.promises.unlink(filename);
    }
    catch (err) {
        // ignore
    }
    await fs_1.promises.writeFile(filename, fileContent);
    if (open) {
        await (0, open_1.default)(filename);
    }
}
exports.mergeJsonOutputs = mergeJsonOutputs;
