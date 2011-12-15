var fs = require("fs");
var data = fs.readFileSync(process.argv[2])
var start = Date.now();
JSON.parse(data);
console.log("Done in " + (Date.now() - start));
