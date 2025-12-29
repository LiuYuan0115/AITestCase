#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const template_types_1 = __importDefault(require("../plugin/template-types"));
const warn_1 = require("../plugin/warn");
const plugin_1 = require("../plugin");
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .option("filename", {
    describe: "Output file name",
    type: "string",
    default: "./stats.html",
})
    .option("title", {
    describe: "Output file title",
    type: "string",
    default: "Rollup Visualizer",
})
    .option("template", {
    describe: "Template type",
    type: "string",
    choices: template_types_1.default,
    default: "treemap",
})
    .option("sourcemap", {
    describe: "Provided files are sourcemaps",
    type: "boolean",
    default: false,
    deprecated: true, // unused
})
    .option("open", {
    describe: "Open generated tempate in default user agent",
    type: "boolean",
    default: false,
})
    .help()
    .parseSync();
(0, plugin_1.mergeJsonOutputs)({
    inputs: argv._,
    ...argv,
}).catch((err) => {
    (0, warn_1.warn)(err.message);
    process.exit(1);
});
