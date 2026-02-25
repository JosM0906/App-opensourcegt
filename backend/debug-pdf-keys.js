
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdf = require("pdf-parse");
console.log("Keys:", Object.keys(pdf));
console.log("Type:", typeof pdf);
try {
    const defaultExport = pdf.default;
    console.log("Default export type:", typeof defaultExport);
    if (defaultExport && typeof defaultExport === 'object') {
        console.log("Default export keys:", Object.keys(defaultExport));
    }
} catch (e) {}

// Check if there is any function in the exports
for (const key of Object.keys(pdf)) {
    if (typeof pdf[key] === 'function') {
        console.log(`Export '${key}' is a function`);
    }
}
