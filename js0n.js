Array.prototype.fill = function(start, end, value) {
    for (var i = start; i <= end; ++i) {
        this[i] = value;
    }
}

// Types
var jst_null = 0;
var jst_boolean = 1;
var jst_number = 2;
var jst_string = 3;
var jst_array = 4;
var jst_object = 5;

// Our parser identifiers
var l_bad = 0;
var l_continue = 1;
var l_quote_up = 2;
var l_quote_down = 3;
var l_array_up = 4;
var l_array_down = 5;
var l_object_up = 6;
var l_object_down = 7;
var l_bare = 8;
var l_unbare = 9;
var l_escape = 10;
var l_utf8_2 = 11;
var l_utf8_3 = 12;
var l_utf8_4 = 13;
var l_utf_continue = 14;
var l_unescape = 15;

// The primary types and parsing context
var goStruct = new Array(255);
goStruct.fill(0, 255, l_bad); // default to bad bits
// Skip the valid whitespace
goStruct[9] = l_continue; // tab
goStruct[10] = l_continue; // lf
goStruct[13] = l_continue; // cr
goStruct[32] = l_continue; // space
// String or id start
goStruct[34] = l_quote_up; // "
// Separators, skippable in this context
goStruct[58] = l_continue; // ;
goStruct[44] = l_continue; // ,
// Array depth movement
goStruct[91] = l_array_up; // [
goStruct[93] = l_array_down; // ]
// Object depth movement
goStruct[123] = l_object_up; // {
goStruct[125] = l_object_down; // }
// Numbers
goStruct[45] = l_bare; // - negative
goStruct.fill(48, 57, l_bare); // 0-9
// booleans
goStruct[116] = l_bare; // t for true
goStruct[102] = l_bare; // f for false
// null
goStruct[110] = l_bare; // n for null

// Bare types processing context
var goBare = new Array(255);
goBare.fill(0, 31, l_bad); // Invalid bare characters
goBare.fill(32, 126, l_continue); // continue on these and add them
goBare[9] = l_unbare; // tab
goBare[10] = l_unbare; // lf
goBare[13] = l_unbare; // cr
goBare[32] = l_unbare; // space
goBare[44] = l_unbare; // ,
goBare[93] = l_unbare; // ]
goBare[125] = l_unbare; // }
goBare.fill(127, 255, l_bad);

// String processing
var goString = new Array(255);
goString.fill(0, 31, l_bad);
goString[127] = l_bad;
goString.fill(32, 126, l_continue);
goString[92] = l_escape; // \ escape 
goString[34] = l_quote_down; // end string
goString.fill(128, 191, l_bad);
goString.fill(192, 223, l_utf8_2);
goString.fill(224, 239, l_utf8_3);
goString.fill(240, 247, l_utf8_4);
goString.fill(248, 255, l_bad);

var goUtf8 = new Array(255);
goUtf8.fill(0, 127, l_bad);
goUtf8.fill(128, 191, l_utf_continue);
goUtf8.fill(192, 255, l_bad);

var goEscape = new Array(255);
goEscape.fill(0, 255, l_bad);
goEscape[34] = l_unescape; // "
goEscape[92] = l_unescape; // \
goEscape[47] = l_unescape; // /
goEscape[98] = l_unescape; // b
goEscape[102] = l_unescape; // f
goEscape[110] = l_unescape; // n
goEscape[114] = l_unescape; // r
goEscape[116] = l_unescape; // t
goEscape[117] = l_unescape; // u


function js0n(inStr) {
    var results = [];
    var curPos = 0;
    var endPos = inStr.length;
    var goContext = goStruct;
    var curDepth = 0;
    var utfRemaining = 0;
    var curValue = {};
    for (;curPos < endPos; ++curPos) {
        switch(goContext[inStr.charCodeAt(curPos)]) {
        case l_array_up:
            curValue.type = jst_array;
            curValue.start = curPos;
            curValue.depth = curDepth;
            results.push(curValue);
            curValue = {};
            ++curDepth;
            break;
        case l_array_down:
            curValue = {};
            --curDepth;
            break;
        case l_object_up:
            curValue.type = jst_object;
            curValue.start = curPos;
            curValue.depth = curDepth;
            results.push(curValue);
            curValue = {};
            ++curDepth;
            break;
        case l_object_down:
            curValue = {};
            --curDepth;
            break;
        case l_quote_up:
            curValue.type = jst_string;
            curValue.start = curPos + 1;
            curValue.depth = curDepth;
            goContext = goString;
            break;
        case l_quote_down:
            curValue.length = curPos - curValue.start;
            results.push(curValue);
            curValue = {};
            goContext = goStruct;
            break;
        case l_escape:
            goContext = goEscape;
            break;
        case l_unescape:
            goContext = goString;
            break;
        case l_bare:
            switch(inStr[curPos]) {
                case "n":
                    curValue.type = jst_null;
                    break;
                case "t":
                case "f":
                    curValue.type = jst_boolean;
                    break;
                default:
                    curValue.type = jst_number;
            }
            curValue.start = curPos;
            curValue.depth = curDepth;
            goContext = goBare;
            break;
        case l_unbare:
            curValue.length = curPos - curValue.start;
            results.push(curValue);
            curValue = {};
            goContext = goStruct;
            // This has to rewind one step to process this again on the goStruct context
            --curPos;
            break;
        case l_utf8_2:
            goContext = goUtf8;
            utfRemaining = 1;
            break;
        case l_utf8_3:
            goContext = goUtf8;
            utfRemaining = 2;
            break;
        case l_utf8_4:
            goContext = goUtf8;
            utfRemaining = 3;
            break;
        case l_utf_continue:
            if (!--utfRemaining) goContext = goString;
            break;
        case l_bad:
            throw "Invalid JSON";
        };
    }
    return results;
}

if (process && process.argv[2]) {
    var fileData = require("fs").readFileSync(process.argv[2], "utf8");
    var start = Date.now();
    var results = js0n(fileData);
    console.log("Processed in " + (Date.now() - start));
    console.dir(results);
}