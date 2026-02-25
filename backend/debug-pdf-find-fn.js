
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdf = require("pdf-parse");
console.log("Is pdf a function?", typeof pdf === 'function');

if (typeof pdf === 'object') {
    if (pdf.default && typeof pdf.default === 'function') {
        console.log("Found default export function");
    }
    const keys = Object.keys(pdf);
    for (const key of keys) {
        if (typeof pdf[key] === 'function') {
            console.log(`Found named export function: ${key}`);
        }
    }
}
