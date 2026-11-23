// coach-engine.js - the Balance Fitness Coach engine (spec version 2), a line-by-line port of the Swift
// engine in ../engine/Sources/CoachEngine. One file, no dependencies, no build step.
//
// Browser: <script src="coach-engine.js"></script> attaches window.CoachEngine.
// Node: const CoachEngine = require("./coach-engine.js").
//
// API: CoachEngine.run(op, state, input) -> {result, state}; one function per operation with the same name
// taking (state, input); parse(text), canonical(value), equalJSON(expected, actual), partialJSON(expected,
// actual). State values are plain JSON values and are never modified.
//
// The engine is pure and deterministic: no clock, no randomness, no network, no disk. Days are "YYYY-MM-DD"
// keys from the caller. All arithmetic is on whole numbers. Text is general fitness guidance only.

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module && typeof module.exports === "object") module.exports = api;
  if (typeof window === "object" && window) window.CoachEngine = api;
  else if (typeof module !== "object" && root && typeof root === "object") root.CoachEngine = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  // ---------------------------------------------------------------------------------------------------
  // JSON values (spec 3). Values are plain: objects, arrays, strings, numbers, booleans, null. A number is
  // an integer when Number.isSafeInteger holds; any other number is the "other number" of 3.1 and has the
  // wrong type everywhere. undefined counts as missing.
  // ---------------------------------------------------------------------------------------------------

  var MAX_SAFE = 9007199254740991;
  var hasOwnProp = Object.prototype.hasOwnProperty;

  function hasOwn(o, k) { return hasOwnProp.call(o, k); }
  function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function isInt(v) { return typeof v === "number" && Number.isSafeInteger(v); }

  /** Thrown by parse for text that is not valid JSON under the strict rules of 3.2. */
  function ParseError(offset, reason) {
    this.offset = offset;
    this.reason = reason;
    this.message = "JSON parse error at " + offset + ": " + reason;
  }

  /** Strict parser (3.2): no byte order mark, depth at most 64, no lone surrogates, last duplicate key wins. */
  function parse(text) {
    if (typeof text !== "string") throw new ParseError(0, "not a string");
    var s = text;
    var n = s.length;
    var pos = 0;
    var depth = 0;

    function fail(reason) { return new ParseError(pos, reason); }
    function ws() {
      while (pos < n) {
        var c = s.charCodeAt(pos);
        if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) pos++;
        else break;
      }
    }
    function isDigitAt(k) {
      if (k >= n) return false;
      var c = s.charCodeAt(k);
      return c >= 0x30 && c <= 0x39;
    }
    function hexValue(c) {
      if (c >= 0x30 && c <= 0x39) return c - 0x30;
      if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
      if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
      return -1;
    }
    function hex4() {
      if (pos + 4 > n) throw fail("short unicode escape");
      var v = 0;
      for (var k = 0; k < 4; k++) {
        var h = hexValue(s.charCodeAt(pos + k));
        if (h < 0) throw fail("bad unicode escape");
        v = v * 16 + h;
      }
      pos += 4;
      return v;
    }
    function word(w) {
      if (pos + w.length > n) throw fail("unexpected end");
      for (var k = 0; k < w.length; k++) {
        if (s.charCodeAt(pos + k) !== w.charCodeAt(k)) throw fail("bad literal");
      }
      pos += w.length;
    }
    function str() {
      pos++;
      var parts = [];
      var run = pos;
      while (true) {
        if (pos >= n) throw fail("unterminated string");
        var c = s.charCodeAt(pos);
        if (c === 0x22) {
          if (pos > run) parts.push(s.slice(run, pos));
          pos++;
          break;
        }
        if (c < 0x20) throw fail("control character in string");
        if (c === 0x5c) {
          if (pos > run) parts.push(s.slice(run, pos));
          pos++;
          if (pos >= n) throw fail("unterminated escape");
          var e = s.charCodeAt(pos);
          pos++;
          switch (e) {
            case 0x22: parts.push("\""); break;
            case 0x5c: parts.push("\\"); break;
            case 0x2f: parts.push("/"); break;
            case 0x62: parts.push("\b"); break;
            case 0x66: parts.push("\f"); break;
            case 0x6e: parts.push("\n"); break;
            case 0x72: parts.push("\r"); break;
            case 0x74: parts.push("\t"); break;
            case 0x75: {
              var u = hex4();
              if (u >= 0xd800 && u <= 0xdbff) {
                if (!(pos + 2 <= n && s.charCodeAt(pos) === 0x5c && s.charCodeAt(pos + 1) === 0x75)) throw fail("lone surrogate");
                pos += 2;
                var low = hex4();
                if (!(low >= 0xdc00 && low <= 0xdfff)) throw fail("lone surrogate");
                parts.push(String.fromCharCode(u, low));
              } else if (u >= 0xdc00 && u <= 0xdfff) {
                throw fail("lone surrogate");
              } else {
                parts.push(String.fromCharCode(u));
              }
              break;
            }
            default:
              throw fail("bad escape");
          }
          run = pos;
          continue;
        }
        if (c >= 0xd800 && c <= 0xdbff) {
          if (!(pos + 1 < n)) throw fail("lone surrogate");
          var c2 = s.charCodeAt(pos + 1);
          if (!(c2 >= 0xdc00 && c2 <= 0xdfff)) throw fail("lone surrogate");
          pos += 2;
          continue;
        }
        if (c >= 0xdc00 && c <= 0xdfff) throw fail("lone surrogate");
        pos++;
      }
      return parts.length === 1 ? parts[0] : parts.join("");
    }
    function num() {
      var start = pos;
      if (s.charCodeAt(pos) === 0x2d) pos++;
      if (pos >= n) throw fail("bad number");
      if (s.charCodeAt(pos) === 0x30) {
        pos++;
      } else if (isDigitAt(pos)) {
        while (isDigitAt(pos)) pos++;
      } else {
        throw fail("bad number");
      }
      if (pos < n && s.charCodeAt(pos) === 0x2e) {
        pos++;
        if (!isDigitAt(pos)) throw fail("bad fraction");
        while (isDigitAt(pos)) pos++;
      }
      if (pos < n && (s.charCodeAt(pos) === 0x65 || s.charCodeAt(pos) === 0x45)) {
        pos++;
        if (pos < n && (s.charCodeAt(pos) === 0x2b || s.charCodeAt(pos) === 0x2d)) pos++;
        if (!isDigitAt(pos)) throw fail("bad exponent");
        while (isDigitAt(pos)) pos++;
      }
      var d = Number(s.slice(start, pos));
      if (Number.isSafeInteger(d)) return d === 0 ? 0 : d;
      return d;
    }
    function enter() {
      depth++;
      if (depth > 64) throw fail("nesting too deep");
    }
    function value() {
      if (pos >= n) throw fail("unexpected end");
      var c = s.charCodeAt(pos);
      if (c === 0x7b) return obj();
      if (c === 0x5b) return arr();
      if (c === 0x22) return str();
      if (c === 0x74) { word("true"); return true; }
      if (c === 0x66) { word("false"); return false; }
      if (c === 0x6e) { word("null"); return null; }
      if (c === 0x2d || (c >= 0x30 && c <= 0x39)) return num();
      throw fail("unexpected character");
    }
    function obj() {
      enter();
      pos++;
      var members = Object.create(null);
      ws();
      if (pos < n && s.charCodeAt(pos) === 0x7d) {
        pos++;
        depth--;
        return members;
      }
      while (true) {
        ws();
        if (!(pos < n && s.charCodeAt(pos) === 0x22)) throw fail("expected a key");
        var key = str();
        ws();
        if (!(pos < n && s.charCodeAt(pos) === 0x3a)) throw fail("expected a colon");
        pos++;
        ws();
        var v = value();
        members[key] = v;
        ws();
        if (pos >= n) throw fail("unexpected end");
        var c = s.charCodeAt(pos);
        if (c === 0x2c) { pos++; continue; }
        if (c === 0x7d) { pos++; break; }
        throw fail("expected a comma or a closing brace");
      }
      depth--;
      return members;
    }
    function arr() {
      enter();
      pos++;
      var elements = [];
      ws();
      if (pos < n && s.charCodeAt(pos) === 0x5d) {
        pos++;
        depth--;
        return elements;
      }
      while (true) {
        ws();
        elements.push(value());
        ws();
        if (pos >= n) throw fail("unexpected end");
        var c = s.charCodeAt(pos);
        if (c === 0x2c) { pos++; continue; }
        if (c === 0x5d) { pos++; break; }
        throw fail("expected a comma or a closing bracket");
      }
      depth--;
      return elements;
    }

    ws();
    var v = value();
    ws();
    if (pos !== n) throw fail("text after the value");
    return v;
  }

  var HEX = "0123456789abcdef";

  function writeString(s, out) {
    var parts = ["\""];
    var run = 0;
    for (var k = 0; k < s.length; k++) {
      var c = s.charCodeAt(k);
      if (c === 0x22 || c === 0x5c || c < 0x20) {
        if (k > run) parts.push(s.slice(run, k));
        if (c === 0x22) parts.push("\\\"");
        else if (c === 0x5c) parts.push("\\\\");
        else parts.push("\\u00" + HEX.charAt(c >> 4) + HEX.charAt(c & 15));
        run = k + 1;
      }
    }
    if (s.length > run) parts.push(run === 0 ? s : s.slice(run));
    parts.push("\"");
    out.push(parts.join(""));
  }

  function writeCanonical(v, out) {
    if (v === null) { out.push("null"); return; }
    if (typeof v === "string") { writeString(v, out); return; }
    if (typeof v === "boolean") { out.push(v ? "true" : "false"); return; }
    if (typeof v === "number") { out.push(Number.isSafeInteger(v) ? String(v === 0 ? 0 : v) : "1.5"); return; }
    if (Array.isArray(v)) {
      out.push("[");
      for (var i = 0; i < v.length; i++) {
        if (i > 0) out.push(",");
        writeCanonical(v[i], out);
      }
      out.push("]");
      return;
    }
    if (typeof v === "object") {
      var keys = Object.keys(v).sort();
      out.push("{");
      var first = true;
      for (var j = 0; j < keys.length; j++) {
        var val = v[keys[j]];
        if (val === undefined) continue;
        if (!first) out.push(",");
        first = false;
        writeString(keys[j], out);
        out.push(":");
        writeCanonical(val, out);
      }
      out.push("}");
      return;
    }
    out.push("null");
  }

  /** Canonical text (3.5): keys sorted by UTF-16 code units, no whitespace, minimal escaping. */
  function canonical(v) {
    var out = [];
    writeCanonical(v, out);
    return out.join("");
  }

  function containsNull(v) {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) if (containsNull(v[i])) return true;
      return false;
    }
    if (typeof v === "object") {
      var keys = Object.keys(v);
      for (var j = 0; j < keys.length; j++) if (containsNull(v[keys[j]])) return true;
    }
    return false;
  }

  function jsonKind(v) {
    if (v === null || v === undefined) return "null";
    if (Array.isArray(v)) return "array";
    var t = typeof v;
    if (t === "number") return Number.isSafeInteger(v) ? "int" : "other";
    if (t === "string" || t === "boolean") return t;
    if (t === "object") return "object";
    return "other";
  }

  function presentKeys(o) {
    var out = [];
    var keys = Object.keys(o);
    for (var i = 0; i < keys.length; i++) {
      var v = o[keys[i]];
      if (v !== null && v !== undefined) out.push(keys[i]);
    }
    return out;
  }

  function compareJSON(e, a, partial) {
    var ke = jsonKind(e);
    var ka = jsonKind(a);
    if (ke !== ka) return false;
    switch (ke) {
      case "object": {
        var ekeys = presentKeys(e);
        if (!partial && ekeys.length !== Object.keys(a).length) return false;
        for (var i = 0; i < ekeys.length; i++) {
          var k = ekeys[i];
          if (!hasOwn(a, k)) return false;
          if (!compareJSON(e[k], a[k], partial)) return false;
        }
        return true;
      }
      case "array":
        if (e.length !== a.length) return false;
        for (var j = 0; j < e.length; j++) if (!compareJSON(e[j], a[j], partial)) return false;
        return true;
      case "int":
      case "string":
      case "boolean":
        return e === a;
      default:
        return false;
    }
  }

  /** equalJSON (3.6): nulls are stripped from expected only; a null anywhere in actual fails. */
  function equalJSON(expected, actual) {
    if (containsNull(actual)) return false;
    return compareJSON(expected, actual, false);
  }

  /** partialJSON (3.6): like equalJSON, but objects in expected only need their own members. */
  function partialJSON(expected, actual) {
    if (containsNull(actual)) return false;
    return compareJSON(expected, actual, true);
  }

  // Member reads (3.7 rules 3 to 5): a member counts only when it is an own member that is not null.
  function mValue(o, k) {
    if (!hasOwn(o, k)) return undefined;
    var v = o[k];
    return v === null ? undefined : v;
  }
  function mInt(o, k, lo, hi) {
    var v = mValue(o, k);
    if (!isInt(v)) return undefined;
    if (v === 0) v = 0;
    if (lo !== undefined && v < lo) return undefined;
    if (hi !== undefined && v > hi) return undefined;
    return v;
  }
  function mClamped(o, k, lo, hi) {
    var v = mInt(o, k);
    return v === undefined ? undefined : clampInt(v, lo, hi);
  }
  function mBool(o, k) {
    var v = mValue(o, k);
    return typeof v === "boolean" ? v : undefined;
  }
  function mStr(o, k) {
    var v = mValue(o, k);
    return typeof v === "string" ? v : undefined;
  }
  function mString(o, k, max) {
    var v = mValue(o, k);
    if (typeof v !== "string" || !isPrintableASCII(v, max === undefined ? 60 : max)) return undefined;
    return v;
  }
  function mDay(o, k) {
    var v = mValue(o, k);
    if (typeof v !== "string") return undefined;
    var n = dayNumber(v);
    if (n === undefined || !isStoredRange(n)) return undefined;
    return v;
  }
  function mEnum(o, k, list) {
    return enumFrom(mValue(o, k), list);
  }
  function enumFrom(v, list) {
    if (typeof v !== "string" || !isASCII(v)) return undefined;
    return list.indexOf(v) >= 0 ? v : undefined;
  }
  function mArray(o, k) {
    var v = mValue(o, k);
    return Array.isArray(v) ? v : undefined;
  }
  function mObject(o, k) {
    var v = mValue(o, k);
    return isObject(v) ? v : undefined;
  }

  // ---------------------------------------------------------------------------------------------------
  // Enums (spec 4), integer math (2.1), day keys (2.4), text helpers (2.5) and errors (15).
  // ---------------------------------------------------------------------------------------------------

  var GOALS = ["buildMuscle", "getStronger", "loseFat", "stayFit", "buildEndurance"];
  var EXPERIENCES = ["new", "some", "experienced"];
  var EQUIPMENTS = ["fullGym", "dumbbells", "bodyweight"];
  var DAY_KINDS = ["training", "cardio", "recovery", "rest"];
  var FOCI = ["push", "pull", "legs", "upper", "fullBody", "coreCardio", "cardio", "recovery", "rest", "free"];
  var ROLES = ["main", "secondary", "accessory", "finisher", "cardio", "recovery"];
  var LOG_TYPES = ["weightReps", "reps", "seconds", "cardio"];
  var FEELS = ["easy", "justRight", "hard"];
  var RECORD_KINDS = ["training", "cardio", "recovery", "free"];
  var CHOICES = ["rest", "training", "cardio"];
  var CHANGES = ["up", "same", "down", "skipped", "fixed"];

  function expIndex(e) { return e === "new" ? 0 : (e === "some" ? 1 : 2); }

  /** Whole-number division, truncating toward zero (the engine uses it for a >= 0, b > 0). */
  function div(a, b) { return Math.trunc(a / b); }
  /** The largest q with q * b <= a, for any a and b > 0. */
  function floorDiv(a, b) {
    var q = Math.trunc(a / b);
    return (a % b !== 0 && a < 0) ? q - 1 : q;
  }
  function floorMod(a, b) { return ((a % b) + b) % b; }
  function clampInt(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  /** div(2 * num + den, 2 * den) for num >= 0, den > 0. */
  function roundHalfUp(num, den) { return div(2 * num + den, 2 * den); }
  /** Estimated one-rep max (Epley, 2.3); undefined when reps is above 12 or below 1. */
  function estimatedMax(w, r) {
    if (r === 1) return w;
    if (r >= 2 && r <= 12) return roundHalfUp(w * (30 + r), 30);
    return undefined;
  }

  function monthLength(y, m) {
    switch (m) {
      case 1: case 3: case 5: case 7: case 8: case 10: case 12: return 31;
      case 4: case 6: case 9: case 11: return 30;
      default: {
        var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        return leap ? 29 : 28;
      }
    }
  }

  function dayNumberYMD(year, m, d) {
    var y = year;
    if (m <= 2) y -= 1;
    var era = div(y, 400);
    var yoe = y - era * 400;
    var mp = m > 2 ? m - 3 : m + 9;
    var doy = div(153 * mp + 2, 5) + d - 1;
    var doe = yoe * 365 + div(yoe, 4) - div(yoe, 100) + doy;
    return era * 146097 + doe - 719468;
  }

  var MIN_STORED = -25567;
  var MAX_STORED = 376199;
  var MIN_TODAY = dayNumberYMD(1900, 3, 1);
  var MAX_TODAY = dayNumberYMD(2999, 12, 24);

  /** The day number of a well-formed key (2.4), or undefined when the key is malformed. */
  function dayNumber(s) {
    if (typeof s !== "string" || s.length !== 10) return undefined;
    if (s.charCodeAt(4) !== 0x2d || s.charCodeAt(7) !== 0x2d) return undefined;
    var digits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var at = [0, 1, 2, 3, 5, 6, 8, 9];
    for (var i = 0; i < at.length; i++) {
      var c = s.charCodeAt(at[i]);
      if (c < 0x30 || c > 0x39) return undefined;
      digits[at[i]] = c - 0x30;
    }
    var y = digits[0] * 1000 + digits[1] * 100 + digits[2] * 10 + digits[3];
    var m = digits[5] * 10 + digits[6];
    var d = digits[8] * 10 + digits[9];
    if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1 || d > monthLength(y, m)) return undefined;
    return dayNumberYMD(y, m, d);
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }

  /** The key of a day number (2.4). */
  function dayKey(n) {
    var z = n + 719468;
    var era = div(z, 146097);
    var doe = z - era * 146097;
    var yoe = div(doe - div(doe, 1460) + div(doe, 36524) - div(doe, 146096), 365);
    var y = yoe + era * 400;
    var doy = doe - (365 * yoe + div(yoe, 4) - div(yoe, 100));
    var mp = div(5 * doy + 2, 153);
    var d = doy - div(153 * mp + 2, 5) + 1;
    var m = mp < 10 ? mp + 3 : mp - 9;
    if (m <= 2) y += 1;
    return pad(y, 4) + "-" + pad(m, 2) + "-" + pad(d, 2);
  }

  function weekdayIndex(n) { return floorMod(n + 3, 7); }
  function mondayOf(n) { return n - weekdayIndex(n); }
  var WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function isStoredRange(n) { return n >= MIN_STORED && n <= MAX_STORED; }
  function isTodayRange(n) { return n >= MIN_TODAY && n <= MAX_TODAY; }

  /** Decimal digits with a comma every three digits from the right (2.5). */
  function fmt(n) {
    if (n < 0) return "-" + fmt(-n);
    var s = String(n);
    if (s.length <= 3) return s;
    var out = "";
    for (var k = 0; k < s.length; k++) {
      if (k > 0 && (s.length - k) % 3 === 0) out += ",";
      out += s.charAt(k);
    }
    return out;
  }

  function plural(n, one, many) { return n === 1 ? one : many; }
  function setWord(n) { return plural(n, "set", "sets"); }
  function repWord(n) { return plural(n, "rep", "reps"); }
  function secWord(n) { return plural(n, "second", "seconds"); }
  function minWord(n) { return plural(n, "minute", "minutes"); }
  function exWord(n) { return plural(n, "exercise", "exercises"); }

  /** True when the string is 1 to maxLength printable ASCII code units (32 to 126). */
  function isPrintableASCII(s, maxLength) {
    if (s.length < 1 || s.length > maxLength) return false;
    for (var k = 0; k < s.length; k++) {
      var c = s.charCodeAt(k);
      if (c < 32 || c > 126) return false;
    }
    return true;
  }

  function isASCII(s) {
    for (var k = 0; k < s.length; k++) if (s.charCodeAt(k) >= 128) return false;
    return true;
  }

  var ERROR_CODES = [
    ["unknownOperation", "Unknown operation."],
    ["invalidInput", "Something in that request is not valid."],
    ["invalidDay", "That date is not valid."],
    ["invalidProfile", "Please check your answers and try again."],
    ["corruptData", "Your coach data could not be read."],
    ["newerVersion", "This data was saved by a newer version of the app."],
    ["alreadySetUp", "Your coach is already set up. Use Edit my plan instead."],
    ["notSetUp", "Set up your coach first."],
    ["noPlan", "Set up your coach first."],
    ["sessionActive", "Finish or cancel the workout in progress first."],
    ["alreadyDone", "Today's workout is already done."],
    ["notAllowedToday", "That is not available today."],
    ["notPlannedToday", "That is not today's workout."],
    ["backToBack", "That would work the same muscles two days in a row."],
    ["needRest", "That would mean 7 training days in a row. Take today off."],
    ["unknownWorkout", "That workout is not in your plan."],
    ["unknownSlot", "That exercise is not in this workout."],
    ["unknownExercise", "That exercise is not in the library."],
    ["notAnAlternative", "That move cannot replace this one."],
    ["itemMismatch", "That exercise does not match today's plan."],
    ["duplicateSlot", "An exercise was logged twice."],
    ["nothingLogged", "Log at least one exercise to finish."],
    ["outOfOrder", "That date is before your last workout."],
    ["logFull", "Your workout history is full."],
    ["cannotUndo", "That workout can no longer be undone."],
    ["unknownRecord", "That workout was not found."],
  ];
  var ERROR_MESSAGES = new Map(ERROR_CODES);

  /** An operation error (15); recordId is set for alreadyDone. */
  function OpError(code, recordId) {
    this.code = code;
    this.recordId = recordId;
  }
  function fail(code, recordId) { return new OpError(code, recordId); }

  // ---------------------------------------------------------------------------------------------------
  // The exercise library (spec 5), goal tables (6), templates and layouts (7) and fixed strings (14).
  // ---------------------------------------------------------------------------------------------------

  function ceilingFor(equipment) {
    switch (equipment) {
      case "barbell": return 1000;
      case "machine": return 1500;
      case "cable": return 500;
      case "dumbbell": return 250;
      default: return 0;
    }
  }

  function fitsList(s) {
    var r = [];
    if (s.indexOf("F") >= 0) r.push("fullGym");
    if (s.indexOf("D") >= 0) r.push("dumbbells");
    if (s.indexOf("B") >= 0) r.push("bodyweight");
    return r;
  }

  function ex(id, name, pattern, muscle, equipment, cls, logType, fits, o) {
    var step = o.step || 0;
    var minW = o.min || 0;
    var maxW = 0;
    if (logType === "weightReps") {
      var c = ceilingFor(equipment);
      maxW = c <= minW ? minW : minW + div(c - minW, step) * step;
    }
    return {
      id: id, name: name, pattern: pattern, muscle: muscle, equipment: equipment, cls: cls, logType: logType,
      fits: fitsList(fits), perHand: o.hand === true, perSide: o.side === true, step: step, minWeight: minW,
      maxWeight: maxW, start: o.start || [], harder: o.harder, easier: o.easier,
      hint: hasOwn(HINTS, id) ? HINTS[id] : undefined,
    };
  }

  function tmpl(id, focus, slots, minutes) { return { id: id, focus: focus, slots: slots, minutes: minutes }; }
  function ts(role, f, d, b) { return { role: role, fullGym: f, dumbbells: d, bodyweight: b }; }

  var HINTS = {
    "benchPress": "Weight includes the 45 lb bar. Set the rack safety bars, or ask someone to spot you.",
    "dumbbellFloorPress": "Lie on the floor and press the dumbbells up.",
    "inclinePushUp": "Hands on a bench, counter or sturdy table.",
    "dumbbellFly": "Lie on the floor or a bench, elbows slightly bent.",
    "overheadPress": "Weight includes the 45 lb bar.",
    "inclinePikePushUp": "Hands on a sturdy bench or chair, hips high, then lower your head toward your hands.",
    "overheadTricepsExtension": "Hold one dumbbell with both hands.",
    "chairDip": "Use a sturdy chair that will not slide. Keep your shoulders down and only go as low as feels comfortable.",
    "closeGripInclinePushUp": "Hands close together on a bench or counter, elbows in.",
    "barbellRow": "Weight includes the 45 lb bar.",
    "doorwayRow": "Hold both sides of a sturdy door frame, lean back, then pull your chest to the frame. Start with your feet close to the frame and lean back only a little.",
    "dumbbellPullover": "Hold one dumbbell with both hands.",
    "rearDeltFly": "Lean forward with a flat back.",
    "reverseSnowAngel": "Lie face down and sweep your arms from your hips to overhead.",
    "floorYRaise": "Lie face down and lift your arms in a Y shape, thumbs up.",
    "backSquat": "Weight includes the 45 lb bar. Squat inside a rack with the safety bars set.",
    "legPress": "Count only the plates you add.",
    "gobletSquat": "Hold one dumbbell at your chest.",
    "wallSit": "Back flat on a wall, knees bent, only as low as feels comfortable.",
    "deadlift": "Weight includes the 45 lb bar. With small plates, raise the bar on blocks so it starts at mid-shin.",
    "romanianDeadlift": "Weight includes the 45 lb bar.",
    "bodyweightGoodMorning": "Hands on your hips, soft knees, hinge forward with a flat back.",
    "splitSquat": "One foot forward, one back, lower straight down. Hold something sturdy for balance if needed.",
    "singleLegCalfRaise": "Hold a wall or counter for balance.",
    "birdDog": "On hands and knees, reach one arm and the opposite leg out, then switch.",
    "cardioCircuit": "Step jacks, marching in place and high knees at an easy, steady pace.",
    "mobilityFlow": "Gentle stretches for your hips, back and shoulders.",
  };
  var EXERCISES = [
    ex("benchPress", "Bench Press", "horizontalPush", "chest", "barbell", "compound", "weightReps", "F", {step: 5, min: 45, start: [45, 65, 95], easier: "dumbbellBenchPress"}),
    ex("inclineDumbbellPress", "Incline Dumbbell Press", "horizontalPush", "chest", "dumbbell", "compound", "weightReps", "F", {hand: true, step: 5, min: 5, start: [10, 20, 30]}),
    ex("dumbbellBenchPress", "Dumbbell Bench Press", "horizontalPush", "chest", "dumbbell", "compound", "weightReps", "F", {hand: true, step: 5, min: 5, start: [15, 25, 35]}),
    ex("dumbbellFloorPress", "Dumbbell Floor Press", "horizontalPush", "chest", "dumbbell", "compound", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [15, 25, 35]}),
    ex("machineChestPress", "Machine Chest Press", "horizontalPush", "chest", "machine", "compound", "weightReps", "F", {step: 5, min: 5, start: [40, 60, 90]}),
    ex("pushUp", "Push-Up", "horizontalPush", "chest", "bodyweight", "compound", "reps", "FDB", {start: [5, 10, 15], easier: "kneePushUp"}),
    ex("inclinePushUp", "Incline Push-Up", "horizontalPush", "chest", "bodyweight", "compound", "reps", "FDB", {start: [8, 12, 15], harder: "pushUp"}),
    ex("kneePushUp", "Knee Push-Up", "horizontalPush", "chest", "bodyweight", "compound", "reps", "FDB", {start: [6, 10, 15], harder: "pushUp", easier: "inclinePushUp"}),
    ex("dumbbellFly", "Dumbbell Fly", "chestFly", "chest", "dumbbell", "isolation", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [5, 10, 15]}),
    ex("overheadPress", "Overhead Press", "verticalPush", "shoulders", "barbell", "compound", "weightReps", "F", {step: 5, min: 45, start: [45, 55, 75], easier: "dumbbellShoulderPress"}),
    ex("dumbbellShoulderPress", "Dumbbell Shoulder Press", "verticalPush", "shoulders", "dumbbell", "compound", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [10, 15, 25]}),
    ex("pikePushUp", "Pike Push-Up", "verticalPush", "shoulders", "bodyweight", "compound", "reps", "FDB", {start: [4, 8, 12], easier: "inclinePikePushUp"}),
    ex("inclinePikePushUp", "Incline Pike Push-Up", "verticalPush", "shoulders", "bodyweight", "compound", "reps", "FDB", {start: [5, 8, 10], harder: "pikePushUp"}),
    ex("lateralRaise", "Dumbbell Lateral Raise", "lateralRaise", "shoulders", "dumbbell", "isolation", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [5, 10, 15]}),
    ex("tricepsPushdown", "Triceps Pushdown", "triceps", "triceps", "cable", "isolation", "weightReps", "F", {step: 5, min: 5, start: [20, 30, 45]}),
    ex("overheadTricepsExtension", "Overhead Triceps Extension", "triceps", "triceps", "dumbbell", "isolation", "weightReps", "FD", {step: 5, min: 5, start: [10, 15, 25]}),
    ex("chairDip", "Chair Dip", "triceps", "triceps", "bodyweight", "isolation", "reps", "FDB", {start: [6, 10, 15], easier: "closeGripInclinePushUp"}),
    ex("closeGripInclinePushUp", "Close-Grip Incline Push-Up", "triceps", "triceps", "bodyweight", "isolation", "reps", "FDB", {start: [6, 10, 12]}),
    ex("barbellRow", "Barbell Row", "horizontalPull", "back", "barbell", "compound", "weightReps", "F", {step: 5, min: 45, start: [45, 65, 95], easier: "dumbbellRow"}),
    ex("seatedCableRow", "Seated Cable Row", "horizontalPull", "back", "cable", "compound", "weightReps", "F", {step: 5, min: 5, start: [40, 60, 90]}),
    ex("dumbbellRow", "One-Arm Dumbbell Row", "horizontalPull", "back", "dumbbell", "compound", "weightReps", "FD", {side: true, step: 5, min: 5, start: [15, 25, 40]}),
    ex("doorwayRow", "Doorway Row", "horizontalPull", "back", "bodyweight", "compound", "reps", "FDB", {start: [8, 12, 15]}),
    ex("latPulldown", "Lat Pulldown", "verticalPull", "back", "cable", "compound", "weightReps", "F", {step: 5, min: 5, start: [40, 60, 90]}),
    ex("pullUp", "Pull-Up", "verticalPull", "back", "bodyweight", "compound", "reps", "F", {start: [1, 3, 6]}),
    ex("dumbbellPullover", "Dumbbell Pullover", "verticalPull", "back", "dumbbell", "isolation", "weightReps", "FD", {step: 5, min: 5, start: [10, 20, 30]}),
    ex("facePull", "Face Pull", "upperBack", "back", "cable", "isolation", "weightReps", "F", {step: 5, min: 5, start: [20, 30, 40]}),
    ex("rearDeltFly", "Rear Delt Fly", "upperBack", "back", "dumbbell", "isolation", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [5, 10, 15]}),
    ex("reverseSnowAngel", "Reverse Snow Angel", "upperBack", "back", "bodyweight", "isolation", "reps", "FDB", {start: [8, 10, 12]}),
    ex("floorYRaise", "Floor Y Raise", "upperBack", "back", "bodyweight", "isolation", "reps", "FDB", {start: [8, 10, 12]}),
    ex("supermanHold", "Superman Hold", "backExtension", "back", "bodyweight", "isolation", "seconds", "FDB", {start: [15, 20, 30]}),
    ex("dumbbellCurl", "Dumbbell Curl", "biceps", "biceps", "dumbbell", "isolation", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [10, 15, 20]}),
    ex("hammerCurl", "Hammer Curl", "biceps", "biceps", "dumbbell", "isolation", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [10, 15, 20]}),
    ex("backSquat", "Back Squat", "squat", "quads", "barbell", "compound", "weightReps", "F", {step: 10, min: 45, start: [45, 65, 95], easier: "gobletSquat"}),
    ex("legPress", "Leg Press", "squat", "quads", "machine", "compound", "weightReps", "F", {step: 10, min: 10, start: [50, 90, 140]}),
    ex("gobletSquat", "Goblet Squat", "squat", "quads", "dumbbell", "compound", "weightReps", "FD", {step: 5, min: 5, start: [15, 25, 40]}),
    ex("bodyweightSquat", "Bodyweight Squat", "squat", "quads", "bodyweight", "compound", "reps", "FDB", {start: [10, 15, 20], harder: "splitSquat"}),
    ex("wallSit", "Wall Sit", "squat", "quads", "bodyweight", "isolation", "seconds", "FDB", {start: [20, 30, 40]}),
    ex("deadlift", "Deadlift", "hinge", "back", "barbell", "compound", "weightReps", "F", {step: 10, min: 45, start: [65, 95, 135], easier: "dumbbellRomanianDeadlift"}),
    ex("romanianDeadlift", "Romanian Deadlift", "hinge", "hamstrings", "barbell", "compound", "weightReps", "F", {step: 10, min: 45, start: [45, 65, 95], easier: "dumbbellRomanianDeadlift"}),
    ex("dumbbellRomanianDeadlift", "Dumbbell Romanian Deadlift", "hinge", "hamstrings", "dumbbell", "compound", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [15, 25, 35]}),
    ex("bodyweightGoodMorning", "Bodyweight Good Morning", "hinge", "hamstrings", "bodyweight", "compound", "reps", "FDB", {start: [10, 12, 15]}),
    ex("gluteBridge", "Glute Bridge", "glute", "glutes", "bodyweight", "isolation", "reps", "FDB", {start: [10, 15, 20], harder: "singleLegGluteBridge"}),
    ex("singleLegGluteBridge", "Single-Leg Glute Bridge", "glute", "glutes", "bodyweight", "isolation", "reps", "FDB", {side: true, start: [6, 10, 12], easier: "gluteBridge"}),
    ex("dumbbellReverseLunge", "Dumbbell Reverse Lunge", "singleLeg", "quads", "dumbbell", "compound", "weightReps", "FD", {hand: true, side: true, step: 5, min: 5, start: [10, 15, 25]}),
    ex("reverseLunge", "Reverse Lunge", "singleLeg", "quads", "bodyweight", "compound", "reps", "FDB", {side: true, start: [6, 10, 12], easier: "splitSquat"}),
    ex("splitSquat", "Split Squat", "singleLeg", "quads", "bodyweight", "compound", "reps", "FDB", {side: true, start: [6, 8, 10], harder: "reverseLunge", easier: "bodyweightSquat"}),
    ex("legExtension", "Leg Extension", "quadIsolation", "quads", "machine", "isolation", "weightReps", "F", {step: 10, min: 10, start: [30, 50, 70]}),
    ex("legCurl", "Leg Curl", "hamstringCurl", "hamstrings", "machine", "isolation", "weightReps", "F", {step: 10, min: 10, start: [30, 50, 70]}),
    ex("dumbbellCalfRaise", "Dumbbell Calf Raise", "calves", "calves", "dumbbell", "isolation", "weightReps", "FD", {hand: true, step: 5, min: 5, start: [10, 20, 30]}),
    ex("calfRaise", "Calf Raise", "calves", "calves", "bodyweight", "isolation", "reps", "FDB", {start: [12, 15, 20], harder: "singleLegCalfRaise"}),
    ex("singleLegCalfRaise", "Single-Leg Calf Raise", "calves", "calves", "bodyweight", "isolation", "reps", "FDB", {side: true, start: [8, 10, 12], easier: "calfRaise"}),
    ex("plank", "Plank", "coreBrace", "core", "bodyweight", "isolation", "seconds", "FDB", {start: [20, 30, 45]}),
    ex("sidePlank", "Side Plank", "coreBrace", "core", "bodyweight", "isolation", "seconds", "FDB", {side: true, start: [15, 20, 30]}),
    ex("deadBug", "Dead Bug", "coreBrace", "core", "bodyweight", "isolation", "reps", "FDB", {side: true, start: [6, 8, 10]}),
    ex("birdDog", "Bird Dog", "coreBrace", "core", "bodyweight", "isolation", "reps", "FDB", {side: true, start: [6, 8, 10]}),
    ex("crunch", "Crunch", "coreFlexion", "core", "bodyweight", "isolation", "reps", "FDB", {start: [10, 15, 20]}),
    ex("bike", "Bike", "cardio", "cardio", "cardioMachine", "cardio", "cardio", "F", {}),
    ex("inclineWalk", "Incline Treadmill Walk", "cardio", "cardio", "cardioMachine", "cardio", "cardio", "F", {}),
    ex("rower", "Rowing Machine", "cardio", "cardio", "cardioMachine", "cardio", "cardio", "F", {}),
    ex("briskWalk", "Brisk Walk", "cardio", "cardio", "none", "cardio", "cardio", "FDB", {}),
    ex("easyRun", "Easy Run", "cardio", "cardio", "none", "cardio", "cardio", "FDB", {}),
    ex("cardioCircuit", "Cardio Circuit", "cardio", "cardio", "none", "cardio", "cardio", "FDB", {}),
    ex("easyWalk", "Easy Walk", "cardio", "cardio", "none", "cardio", "cardio", "FDB", {}),
    ex("mobilityFlow", "Stretch and Mobility", "mobility", "mobility", "none", "cardio", "cardio", "FDB", {}),
  ];
  var TEMPLATES = [
    tmpl("push", "push", [
      ts("main", "benchPress", "dumbbellFloorPress", "pushUp"),
      ts("secondary", "overheadPress", "dumbbellShoulderPress", "pikePushUp"),
      ts("accessory", "inclineDumbbellPress", "dumbbellFly", "inclinePushUp"),
      ts("accessory", "tricepsPushdown", "overheadTricepsExtension", "chairDip"),
      ts("accessory", "lateralRaise", "lateralRaise", "plank"),
      ts("accessory", "dumbbellFly", "pushUp", "sidePlank"),
    ], null),
    tmpl("pushB", "push", [
      ts("main", "overheadPress", "dumbbellShoulderPress", "pikePushUp"),
      ts("secondary", "dumbbellBenchPress", "dumbbellFloorPress", "pushUp"),
      ts("accessory", "machineChestPress", "dumbbellFly", "chairDip"),
      ts("accessory", "lateralRaise", "lateralRaise", "inclinePushUp"),
      ts("accessory", "overheadTricepsExtension", "overheadTricepsExtension", "plank"),
      ts("accessory", "pushUp", "pushUp", "sidePlank"),
    ], null),
    tmpl("pull", "pull", [
      ts("main", "barbellRow", "dumbbellRow", "doorwayRow"),
      ts("secondary", "latPulldown", "dumbbellPullover", "reverseSnowAngel"),
      ts("accessory", "seatedCableRow", "rearDeltFly", "supermanHold"),
      ts("accessory", "dumbbellCurl", "dumbbellCurl", "deadBug"),
      ts("accessory", "facePull", "hammerCurl", "sidePlank"),
      ts("accessory", "hammerCurl", "supermanHold", "crunch"),
    ], null),
    tmpl("pullB", "pull", [
      ts("main", "latPulldown", "dumbbellRow", "doorwayRow"),
      ts("secondary", "dumbbellRow", "dumbbellPullover", "reverseSnowAngel"),
      ts("accessory", "facePull", "rearDeltFly", "supermanHold"),
      ts("accessory", "hammerCurl", "hammerCurl", "deadBug"),
      ts("accessory", "seatedCableRow", "dumbbellCurl", "sidePlank"),
      ts("accessory", "dumbbellCurl", "supermanHold", "crunch"),
    ], null),
    tmpl("legs", "legs", [
      ts("main", "backSquat", "gobletSquat", "bodyweightSquat"),
      ts("secondary", "romanianDeadlift", "dumbbellRomanianDeadlift", "reverseLunge"),
      ts("accessory", "legPress", "dumbbellReverseLunge", "gluteBridge"),
      ts("accessory", "legCurl", "gluteBridge", "calfRaise"),
      ts("accessory", "legExtension", "dumbbellCalfRaise", "singleLegGluteBridge"),
      ts("accessory", "dumbbellCalfRaise", "plank", "plank"),
    ], null),
    tmpl("legsB", "legs", [
      ts("main", "deadlift", "dumbbellRomanianDeadlift", "reverseLunge"),
      ts("secondary", "legPress", "gobletSquat", "bodyweightSquat"),
      ts("accessory", "dumbbellReverseLunge", "dumbbellReverseLunge", "singleLegGluteBridge"),
      ts("accessory", "legCurl", "gluteBridge", "gluteBridge"),
      ts("accessory", "legExtension", "dumbbellCalfRaise", "calfRaise"),
      ts("accessory", "dumbbellCalfRaise", "plank", "plank"),
    ], null),
    tmpl("upper", "upper", [
      ts("main", "inclineDumbbellPress", "dumbbellFloorPress", "pushUp"),
      ts("secondary", "seatedCableRow", "dumbbellRow", "doorwayRow"),
      ts("accessory", "dumbbellShoulderPress", "dumbbellShoulderPress", "pikePushUp"),
      ts("accessory", "latPulldown", "rearDeltFly", "reverseSnowAngel"),
      ts("accessory", "lateralRaise", "dumbbellCurl", "chairDip"),
      ts("accessory", "dumbbellCurl", "overheadTricepsExtension", "plank"),
    ], null),
    tmpl("fullBodyA", "fullBody", [
      ts("main", "backSquat", "gobletSquat", "bodyweightSquat"),
      ts("main", "benchPress", "dumbbellFloorPress", "pushUp"),
      ts("secondary", "barbellRow", "dumbbellRow", "doorwayRow"),
      ts("accessory", "dumbbellShoulderPress", "lateralRaise", "pikePushUp"),
      ts("accessory", "legCurl", "dumbbellRomanianDeadlift", "gluteBridge"),
      ts("accessory", "plank", "plank", "plank"),
    ], null),
    tmpl("fullBodyB", "fullBody", [
      ts("main", "deadlift", "dumbbellRomanianDeadlift", "reverseLunge"),
      ts("main", "overheadPress", "dumbbellShoulderPress", "pikePushUp"),
      ts("secondary", "latPulldown", "dumbbellRow", "doorwayRow"),
      ts("accessory", "legPress", "dumbbellReverseLunge", "bodyweightSquat"),
      ts("accessory", "dumbbellBenchPress", "pushUp", "inclinePushUp"),
      ts("accessory", "deadBug", "deadBug", "deadBug"),
    ], null),
    tmpl("coreCardio", "coreCardio", [
      ts("accessory", "plank", "plank", "plank"),
      ts("accessory", "deadBug", "deadBug", "deadBug"),
      ts("accessory", "crunch", "crunch", "crunch"),
      ts("accessory", "sidePlank", "sidePlank", "sidePlank"),
      ts("cardio", "bike", "briskWalk", "briskWalk"),
    ], null),
    tmpl("cardio", "cardio", [
      ts("cardio", "inclineWalk", "briskWalk", "briskWalk"),
    ], null),
    tmpl("recovery", "recovery", [
      ts("recovery", "easyWalk", "easyWalk", "easyWalk"),
      ts("recovery", "mobilityFlow", "mobilityFlow", "mobilityFlow"),
    ], [15, 5]),
  ];
  var TEXTS = [
    ["disclaimer", "This is general fitness guidance, not medical advice. Check with a doctor before starting a new program."],
    ["startLight", "Start light - your coach finds your level in the first week."],
    ["anchorPerHand", "Enter the weight of one dumbbell."],
    ["anchorReps", "The most reps you can do with good form."],
    ["planNote", "New to lifting? 3 or 4 days a week is plenty to start."],
    ["calibrationNote", "First time: start light. If a set feels easy, add weight on the next set. End each set while you could still do 1 or 2 more good reps."],
    ["comebackNote", "Welcome back - a little lighter after a break."],
    ["skippedTwiceNote", "You skipped this the last two times. Want to swap it for another move?"],
    ["tipTraining", "Warm up with 5 easy minutes first. End each set while you could still do 1 or 2 more good reps."],
    ["tipStop", "If a move hurts (not just hard work), stop and skip it or swap it."],
    ["tipCardio", "Go at a pace where you can still talk."],
    ["tipRecovery", "Keep it easy - this day helps you recover."],
    ["restOptional", "Easy walk - 10 min"],
    ["restChosen", "You chose to rest today."],
    ["trainNote", "That would work the same muscles two days in a row. Try cardio or a walk today."],
    ["restNote", "That would mean 7 training days in a row. Take today off - a walk still earns time."],
  ];
  var REASON_TEMPLATES = [
    ["SKIPPED", "Skipped today - same target next time."],
    ["UP", "You hit {hi} on every set - adding {inc} lb{hand}."],
    ["UP_EASY", "That felt easy - adding {inc} lb{hand}."],
    ["CAL_UP", "That felt easy - adding {inc} lb{hand} while we find your level."],
    ["UP_NEW_BASE", "Good work at {base} lb{hand} - next time {newW} lb{hand} for {newR} {repWord(newR)}{side}."],
    ["HARD_HOLD", "You hit {hi} on every set but it felt hard - same weight next time."],
    ["ADD_SET", "You hit {hi} on every set - adding a set before more weight."],
    ["FINISH_SETS", "Finish all {P} {setWord(P)} at {hi} {repWord(hi)}{side} to move up."],
    ["FINISH_AT", "Do all {P} {setWord(P)} at {Lw} lb{hand} to move up."],
    ["REPS_UP", "Same weight, aim for {newR} {repWord(newR)}{side} on every set next time."],
    ["REPS_HARD", "It felt hard - same weight and {newR} {repWord(newR)}{side} next time."],
    ["REPS_HOLD", "Same weight, aim for {newR} {repWord(newR)}{side} on every set again."],
    ["NEW_BASE", "Good work - next time {newW} lb{hand} for {newR} {repWord(newR)}{side} on every set."],
    ["NEW_BASE.lighter", "Lighter is fine - next time {newW} lb{hand} for {newR} {repWord(newR)}{side} on every set, then build up from there."],
    ["GRACE", "New weight - stay at {newW} lb{hand} next time and aim for {lo} {repWord(lo)}{side}."],
    ["MISS_ONCE", "Tough day - same weight next time, aim for {lo} {repWord(lo)}{side}."],
    ["MISS_LIGHTER", "Tough day - next time {newW} lb{hand}, aim for {lo} {repWord(lo)}{side}."],
    ["DELOAD", "Two tough sessions in a row - dropping to {newW} lb{hand} to build back up."],
    ["STALL", "You have been at this weight a while - dropping to {newW} lb{hand} to build back up."],
    ["STALL_REPS", "You have been at this weight a while - same weight, aim for {lo} {repWord(lo)}{side} to build back up."],
    ["MISS_BIG", "That was much harder than planned - dropping to {newW} lb{hand} to build back up."],
    ["REBUILD", "Building back up - adding {inc} lb{hand}."],
    ["CAPPED", "Nice work - we will build up to that step by step: {newW} lb{hand} next time."],
    ["AT_MIN", "This is the lightest weight - aim for {newR} {repWord(newR)}{side} on every set next time.{easier}"],
    ["CAL_DOWN", "That was heavy for a first try - starting lighter at {newW} lb{hand}."],
    ["CAL_DOWN.later", "That was heavy - next time {newW} lb{hand} while we find your level."],
    ["C_UP", "You hit {T} {u(T)} on every set - aim for {newT} {u(newT)} next time."],
    ["C_UP_EASY", "That felt easy - aim for {newT} {u(newT)} next time."],
    ["C_ADD_SET", "You hit {cap} {u(cap)} on every set - adding a set."],
    ["C_MAXED.harder", "You have maxed out this move. Ready for a harder move: try {harder name}."],
    ["C_MAXED.none", "You have maxed out this move - keep it steady or swap it for another move."],
    ["C_HARD", "It felt hard - same target next time."],
    ["C_FINISH_SETS", "Finish all {P} {setWord(P)} to move up."],
    ["C_HOLD", "Aim for {T} {u(T)} on every set again."],
    ["C_TIME", "That fills the time you set for this session - same target next time."],
    ["C_MISS_ONCE", "Tough day - same target next time."],
    ["C_DOWN", "Two tough sessions in a row - next time aim for {newT} {u(newT)}.{easierLow}"],
    ["C_CAL_DOWN", "Starting a little easier - next time aim for {newT} {u(newT)}.{easierLow}"],
    ["C_STALL", "You have been at this target a while - next time aim for {newT} {u(newT)} to build back up."],
    ["CA_UP", "Good session - next time {newT} {minWord(newT)}."],
    ["CA_HARD", "It felt hard - same time next time."],
    ["CA_CAP", "You are at the top goal of {cap} {minWord(cap)} - keep it up."],
    ["CA_WEEK_HOLD", "Nice work - more time comes next week."],
    ["CA_TIME", "That fills the time you set for this session - same time next time."],
    ["CA_HOLD", "Same goal next time: {T} {minWord(T)}."],
    ["CA_MISS_ONCE", "A shorter day is fine - same goal next time: {T} {minWord(T)}."],
    ["CA_DOWN", "Two short sessions in a row - next goal {newT} {minWord(newT)}."],
    ["FIXED", "Nice work - same plan next time."],
    ["easier.move", " Or try an easier move: {name}."],
    ["easier.none", " You can swap it for another move."],
  ];
  var RECORD_TEMPLATES = [
    ["new.heaviest", "New heaviest {name}: {w} lb{hand} for {r} {repWord(r)}{side}"],
    ["new.estimatedMax", "New best estimated one-rep max for {name}: {v} lb{hand}"],
    ["new.mostReps", "New best for {name}: {r} {repWord(r)}{side} in one set"],
    ["new.longestHold", "New longest {name}: {s} {secWord(s)}{side}"],
    ["lift.heaviest", "Heaviest: {w} lb{hand} for {r} {repWord(r)}{side}"],
    ["lift.bestEstimatedMax", "Estimated one-rep max: {v} lb{hand}"],
    ["lift.mostReps", "Most in one set: {r} {repWord(r)}{side}"],
    ["lift.longestHold", "Longest hold: {s} {secWord(s)}{side}"],
  ];
  // The separator of every 14.3 summary: a middle dot (U+00B7) with a space on each side. It is the only
  // character outside printable ASCII the engine ever writes (1.4). Reasons (14.4) keep " - ".
  var SUMMARY_SEP = " \u00B7 ";
  var SUMMARY_TEMPLATES = [
    ["done", "Done" + SUMMARY_SEP + "{d} min"],
    ["doneLifted", "Done" + SUMMARY_SEP + "{d} min" + SUMMARY_SEP + "{p} lb lifted"],
    ["active", "In progress" + SUMMARY_SEP + "{n} {exWord(n)}"],
    ["training", "{n} {exWord(n)}" + SUMMARY_SEP + "about {aboutMinutes} min"],
    ["cardio", "{exercise name}" + SUMMARY_SEP + "{M} min"],
    ["recovery", "Easy walk and stretching" + SUMMARY_SEP + "{sum of slot minutes} min"],
    ["restMoved", "{title} moves to your next training day"],
    ["rest", "Optional: a 10-minute easy walk"],
  ];

  var EX_BY_ID = new Map();
  for (var exi = 0; exi < EXERCISES.length; exi++) EX_BY_ID.set(EXERCISES[exi].id, EXERCISES[exi]);

  /** Library lookup; only ASCII strings can be library ids. */
  function exercise(id) {
    if (typeof id !== "string" || !isASCII(id)) return undefined;
    return EX_BY_ID.get(id);
  }

  function loadFactor(e) { return (e.perHand ? 2 : 1) * (e.perSide ? 2 : 1); }
  function isCardioEx(e) { return e.logType === "cardio"; }
  function isWeightedEx(e) { return e.logType === "weightReps"; }
  function isCountEx(e) { return e.logType === "reps" || e.logType === "seconds"; }
  function fitsEq(e, eq) { return e.fits.indexOf(eq) >= 0; }

  // Weight helpers on an exercise's grid (2.2).
  function snapDown(e, x) { return x <= e.minWeight ? e.minWeight : e.minWeight + div(x - e.minWeight, e.step) * e.step; }
  function tenthSteps(e, b) { return div(b, 10 * e.step) * e.step; }
  function fifthSteps(e, b) { return div(b, 5 * e.step) * e.step; }
  function easyInc(e, b) { return Math.min(2 * e.step, Math.max(e.step, tenthSteps(e, b))); }
  function calInc(e, b) { return Math.min(4 * e.step, Math.max(e.step, fifthSteps(e, b))); }
  function deload(e, b) { return Math.max(e.minWeight, Math.min(snapDown(e, div(b * 9, 10)), snapDown(e, b - e.step))); }
  function calDown(e, b) { return Math.max(e.minWeight, Math.min(snapDown(e, div(b * 8, 10)), snapDown(e, b - e.step))); }
  function bigStep(e, b) { return 10 * e.step > b; }

  var MUSCLE_ORDER = [
    "chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core", "cardio",
    "mobility",
  ];
  var MUSCLE_LABELS = new Map([
    ["chest", "Chest"], ["back", "Back"], ["shoulders", "Shoulders"], ["biceps", "Biceps"], ["triceps", "Triceps"],
    ["quads", "Thighs"], ["hamstrings", "Back of thighs"], ["glutes", "Glutes"], ["calves", "Calves"], ["core", "Core"],
    ["cardio", "Heart and lungs"], ["mobility", "Whole body"],
  ]);

  // Swap families (5.3).
  var PATTERN_FALLBACKS = [
    ["horizontalPush", ["chestFly"]],
    ["chestFly", ["horizontalPush"]],
    ["verticalPush", ["lateralRaise"]],
    ["lateralRaise", ["verticalPush"]],
    ["triceps", []],
    ["horizontalPull", ["verticalPull", "upperBack"]],
    ["verticalPull", ["horizontalPull"]],
    ["upperBack", ["horizontalPull"]],
    ["backExtension", ["upperBack"]],
    ["biceps", ["horizontalPull"]],
    ["squat", ["singleLeg"]],
    ["singleLeg", ["squat"]],
    ["hinge", ["glute"]],
    ["glute", ["hinge"]],
    ["quadIsolation", ["squat"]],
    ["hamstringCurl", ["hinge"]],
    ["calves", []],
    ["coreBrace", ["coreFlexion"]],
    ["coreFlexion", ["coreBrace"]],
    ["cardio", []],
    ["mobility", []],
  ];
  var FALLBACK_BY_PATTERN = new Map(PATTERN_FALLBACKS);

  var FAMILY_BY_ID = new Map();
  (function () {
    for (var i = 0; i < EXERCISES.length; i++) {
      var x = EXERCISES[i];
      var out = [];
      var seen = new Set();
      for (var j = 0; j < EXERCISES.length; j++) {
        var m = EXERCISES[j];
        if (m.pattern === x.pattern && m.id !== x.id && !seen.has(m.id)) { seen.add(m.id); out.push(m.id); }
      }
      var fb = FALLBACK_BY_PATTERN.get(x.pattern) || [];
      for (var f = 0; f < fb.length; f++) {
        for (var k = 0; k < EXERCISES.length; k++) {
          var m2 = EXERCISES[k];
          if (m2.pattern === fb[f] && m2.id !== x.id && m2.equipment !== "barbell" && !seen.has(m2.id)) {
            seen.add(m2.id);
            out.push(m2.id);
          }
        }
      }
      FAMILY_BY_ID.set(x.id, out);
    }
  })();

  function family(id) { return (typeof id === "string" && FAMILY_BY_ID.get(id)) || []; }

  function libraryAlternatives(id, eq, exclude) {
    var out = [];
    var fam = family(id);
    for (var i = 0; i < fam.length; i++) {
      var m = fam[i];
      var e = exercise(m);
      if (!e || !fitsEq(e, eq)) continue;
      if (exclude.indexOf(m) >= 0) continue;
      out.push(m);
      if (out.length === 6) break;
    }
    return out;
  }

  // Anchors (5.4).
  function anchorIds(eq) {
    switch (eq) {
      case "fullGym": return ["benchPress", "backSquat", "deadlift", "overheadPress"];
      case "dumbbells": return ["dumbbellFloorPress", "gobletSquat", "dumbbellRomanianDeadlift", "dumbbellShoulderPress"];
      default: return ["pushUp", "bodyweightSquat"];
    }
  }

  var ANCHOR_SEEDS = [
    ["benchPress", [["benchPress", 100]]],
    ["backSquat", [["backSquat", 100]]],
    ["deadlift", [["deadlift", 100], ["romanianDeadlift", 70]]],
    ["overheadPress", [["overheadPress", 100]]],
    ["dumbbellFloorPress", [["dumbbellFloorPress", 100], ["dumbbellBenchPress", 100]]],
    ["gobletSquat", [["gobletSquat", 100]]],
    ["dumbbellRomanianDeadlift", [["dumbbellRomanianDeadlift", 100]]],
    ["dumbbellShoulderPress", [["dumbbellShoulderPress", 100]]],
    ["pushUp", [["pushUp", 100]]],
    ["bodyweightSquat", [["bodyweightSquat", 100]]],
  ];

  function seedsOfAnchor(a) {
    for (var i = 0; i < ANCHOR_SEEDS.length; i++) if (ANCHOR_SEEDS[i][0] === a) return ANCHOR_SEEDS[i][1];
    return [];
  }

  // Goal tables (6).
  /** `barbell` matters only for getStronger: heavy barbell compounds use the low reps, every other move 8 to 10. */
  function libRepRange(goal, experience, cls, barbell) {
    var compound = cls === "compound";
    switch (goal) {
      case "getStronger":
        return compound && barbell ? (experience === "new" ? { lo: 6, hi: 8 } : { lo: 4, hi: 6 }) : { lo: 8, hi: 10 };
      case "buildMuscle": return compound ? { lo: 8, hi: 12 } : { lo: 10, hi: 15 };
      case "loseFat": return compound ? { lo: 8, hi: 12 } : { lo: 12, hi: 15 };
      case "stayFit": return compound ? { lo: 6, hi: 10 } : { lo: 10, hi: 15 };
      default: return compound ? { lo: 12, hi: 15 } : { lo: 15, hi: 20 };
    }
  }

  function repsCap(g) {
    switch (g) {
      case "getStronger": return 12;
      case "buildMuscle": return 15;
      case "loseFat": return 20;
      case "stayFit": return 15;
      default: return 25;
    }
  }

  function secondsCap(g) {
    switch (g) {
      case "getStronger": return 45;
      case "buildEndurance": return 90;
      default: return 60;
    }
  }

  var REPS_CONSTANTS = { unit: 1, easyUnit: 2, missMargin: 2, minValue: 1, resetDrop: 4, stallSessions: 4, comebackFloor: 3 };
  var SECONDS_CONSTANTS = {
    unit: 5, easyUnit: 10, missMargin: 10, minValue: 10, resetDrop: 15, stallSessions: 4, comebackFloor: 10,
  };

  /** `percent` of t rounded down to whole units, at least one unit (6.2). */
  function countCut(c, t, percent) { return Math.max(c.unit, div(div(t * percent, 100), c.unit) * c.unit); }
  /** The target after two misses or a stall: about 20 percent lower, at least one unit, never below minValue. */
  function countDropped(c, t) { return Math.max(c.minValue, t - countCut(c, t, 20)); }

  function restTable(g) {
    switch (g) {
      case "getStronger": return { main: 180, secondary: 150, accessory: 90 };
      case "buildMuscle": return { main: 120, secondary: 90, accessory: 60 };
      case "loseFat": return { main: 75, secondary: 60, accessory: 45 };
      case "stayFit": return { main: 90, secondary: 75, accessory: 60 };
      default: return { main: 60, secondary: 45, accessory: 30 };
    }
  }

  function baseSets(role, minutes) {
    switch (role) {
      case "main": return minutes === 60 ? 4 : 3;
      case "secondary": return 3;
      case "accessory": return minutes === 30 ? 2 : 3;
      case "finisher": return 2;
      default: return 1;
    }
  }

  function maxExtraFor(minutes) { return minutes === 60 ? 2 : 1; }
  function strengthSlots(minutes) { return minutes === 30 ? 4 : (minutes === 45 ? 5 : 6); }
  function coreSlots(minutes) { return minutes === 60 ? 4 : 3; }
  function finisherMinutes(minutes) { return minutes === 30 ? 5 : (minutes === 45 ? 8 : 10); }

  function cardioGoalCap(g) {
    switch (g) {
      case "getStronger": case "buildMuscle": return 30;
      case "stayFit": return 40;
      case "loseFat": return 45;
      default: return 60;
    }
  }

  function cardioStart(e) { return e === "new" ? 15 : (e === "some" ? 20 : 25); }
  function cardioStep(t) { return Math.max(1, div(t + 5, 10)); }

  // Heavy groups (6.8), as bit masks.
  var GROUP_BITS = new Map([
    ["chest", 1], ["back", 2], ["shoulders", 4], ["triceps", 8], ["biceps", 16], ["quads", 32], ["hamstrings", 64],
    ["glutes", 128],
  ]);
  function heavyGroups(f) {
    switch (f) {
      case "push": return ["chest", "shoulders", "triceps"];
      case "pull": return ["back", "biceps"];
      case "legs": return ["quads", "hamstrings", "glutes"];
      case "upper": return ["chest", "back", "shoulders"];
      case "fullBody": return ["chest", "back", "shoulders", "quads", "hamstrings", "glutes"];
      default: return [];
    }
  }
  function heavyMask(f) {
    var g = heavyGroups(f);
    var m = 0;
    for (var i = 0; i < g.length; i++) m |= GROUP_BITS.get(g[i]);
    return m;
  }

  function template(id) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i];
    return undefined;
  }
  function pick(slot, eq) { return eq === "fullGym" ? slot.fullGym : (eq === "dumbbells" ? slot.dumbbells : slot.bodyweight); }

  // Layouts (7.4).
  var LAYOUTS = [
    { daysPerWeek: 2, cycle: ["training", "rest", "x", "training", "rest", "rest", "rest"],
      rotation: [["fullBodyA", "Full body A"], ["fullBodyB", "Full body B"]] },
    { daysPerWeek: 3, cycle: ["training", "rest", "training", "x", "training", "rest", "rest"],
      rotation: [["push", "Push"], ["pull", "Pull"], ["legs", "Legs"]] },
    { daysPerWeek: 4, cycle: ["training", "training", "x", "training", "training", "rest", "rest"],
      rotation: [["push", "Push"], ["pull", "Pull"], ["legs", "Legs"], ["coreCardio", "Core + cardio"]] },
    { daysPerWeek: 5, cycle: ["training", "training", "training", "x", "training", "training", "rest"],
      rotation: [["push", "Push"], ["pull", "Pull"], ["legs", "Legs"], ["upper", "Upper body"],
        ["coreCardio", "Core + cardio"]] },
    { daysPerWeek: 6, cycle: ["training", "training", "training", "training", "training", "training", "rest"],
      rotation: [["push", "Push A"], ["pull", "Pull A"], ["legs", "Legs A"], ["pushB", "Push B"],
        ["pullB", "Pull B"], ["legsB", "Legs B"]] },
  ];

  function layout(days) { return LAYOUTS[clampInt(days, 2, 6) - 2]; }

  function cycleX(g) { return (g === "loseFat" || g === "buildEndurance" || g === "stayFit") ? "cardio" : "recovery"; }

  // Finishers (7.3) and new-lifter swaps (8.1).
  function cardioFinishers(e) { return e === "fullGym" ? ["rower", "bike"] : ["cardioCircuit", "briskWalk"]; }
  var CORE_PUSH_FINISHERS = ["plank", "sidePlank", "deadBug", "crunch"];
  var CORE_PULL_FINISHERS = ["deadBug", "crunch", "plank", "sidePlank"];

  var NEW_LIFTER_SWAPS = [
    ["deadlift", ["dumbbellRomanianDeadlift"]],
    ["romanianDeadlift", ["dumbbellRomanianDeadlift"]],
    ["barbellRow", ["seatedCableRow", "dumbbellRow"]],
    ["pushUp", ["inclinePushUp", "kneePushUp"]],
    ["pikePushUp", ["inclinePikePushUp"]],
    ["overheadPress", ["dumbbellShoulderPress"]],
    ["chairDip", ["closeGripInclinePushUp"]],
  ];

  // Descriptions (7.5).
  function describeFocus(f) {
    switch (f) {
      case "push": return "Chest, shoulders and triceps";
      case "pull": return "Back and biceps";
      case "legs": return "Legs and glutes";
      case "upper": return "Chest, back and shoulders";
      case "fullBody": return "Your whole body in one workout";
      case "coreCardio": return "Core work and steady cardio";
      case "cardio": return "Steady cardio at a pace where you can still talk";
      case "recovery": return "An easy walk and gentle stretching";
      default: return "Rest and recharge";
    }
  }
  var DESCRIPTION_FOCI = ["push", "pull", "legs", "upper", "fullBody", "coreCardio", "cardio", "recovery", "rest"];

  var TEXT_BY_KEY = new Map(TEXTS);
  function text(key) { return TEXT_BY_KEY.get(key); }

  function sideText(e) { return (e && e.perSide) ? " each side" : ""; }
  function handText(e) { return (e && e.perHand) ? " each hand" : ""; }

  /** Target text (14.2). */
  function targetText(t, logType, e) {
    var s = t.sets;
    switch (logType) {
      case "weightReps": {
        var r = t.reps === undefined ? 0 : t.reps;
        var w = t.weight === undefined ? 0 : t.weight;
        return fmt(s) + " " + setWord(s) + " of " + fmt(r) + sideText(e) + " at " + fmt(w) + " lb" + handText(e);
      }
      case "reps": {
        var r2 = t.reps === undefined ? 0 : t.reps;
        return fmt(s) + " " + setWord(s) + " of " + fmt(r2) + sideText(e);
      }
      case "seconds": {
        var sec = t.seconds === undefined ? 0 : t.seconds;
        return fmt(s) + " " + setWord(s) + " of " + fmt(sec) + " " + secWord(sec) + sideText(e);
      }
      default:
        return fmt(t.minutes === undefined ? 0 : t.minutes) + " min";
    }
  }

  // ---------------------------------------------------------------------------------------------------
  // Saved state models (spec 4): plain objects with the member names of the spec. Optional members are
  // undefined when absent. lifts, cardio and the exercise swap preferences are Maps keyed by id.
  // ---------------------------------------------------------------------------------------------------

  function newModel() {
    return {
      profile: undefined, plan: undefined, lifts: new Map(), cardio: new Map(), swaps: new Map(), log: [],
      counters: { nextRecordNumber: 1, coachStartDay: undefined }, undo: undefined,
    };
  }

  function newLift() {
    return {
      weight: undefined, reps: undefined, seconds: undefined, extraSets: 0, missStreak: 0, calibrationLeft: 0,
      sessions: 0, sessionsAtTarget: 0, graceLeft: undefined, rebuildTo: undefined, lastDay: undefined,
    };
  }

  function copyObj(o) {
    var r = {};
    var keys = Object.keys(o);
    for (var i = 0; i < keys.length; i++) r[keys[i]] = o[keys[i]];
    return r;
  }

  function copyWorkout(w) {
    return { id: w.id, title: w.title, focus: w.focus, slots: w.slots.map(copyObj) };
  }

  function copyActive(a) {
    return {
      day: a.day, workoutId: a.workoutId, kind: a.kind, title: a.title, focus: a.focus,
      items: a.items.map(function (it) {
        return { slot: it.slot, exerciseId: it.exerciseId, role: it.role, logType: it.logType, target: copyObj(it.target) };
      }),
    };
  }

  function copyPlan(p) {
    return {
      startDay: p.startDay, builtDay: p.builtDay, cycle: p.cycle.slice(), workouts: p.workouts.map(copyWorkout),
      rotation: p.rotation.slice(), queue: p.queue.slice(),
      todayChoice: p.todayChoice ? copyObj(p.todayChoice) : undefined,
      todaySwaps: p.todaySwaps ? { day: p.todaySwaps.day, swaps: p.todaySwaps.swaps.map(copyObj) } : undefined,
      active: p.active ? copyActive(p.active) : undefined,
    };
  }

  /** A copy that can be changed without touching the original (records and lift objects are never changed in place). */
  function copyModel(s) {
    return {
      profile: s.profile, plan: s.plan ? copyPlan(s.plan) : undefined, lifts: new Map(s.lifts),
      cardio: new Map(s.cardio), swaps: new Map(s.swaps), log: s.log.slice(),
      counters: { nextRecordNumber: s.counters.nextRecordNumber, coachStartDay: s.counters.coachStartDay },
      undo: s.undo,
    };
  }

  function sortedKeys(m) {
    var keys = [];
    m.forEach(function (_, k) { keys.push(k); });
    return keys.sort();
  }

  /** The record number of "r12" is 12; parses ^r[1-9][0-9]{0,8}$. */
  function recordNumber(id) {
    if (typeof id !== "string" || id.length < 2 || id.length > 10) return undefined;
    if (id.charCodeAt(0) !== 0x72) return undefined;
    var c1 = id.charCodeAt(1);
    if (c1 < 0x31 || c1 > 0x39) return undefined;
    var n = 0;
    for (var k = 1; k < id.length; k++) {
      var c = id.charCodeAt(k);
      if (c < 0x30 || c > 0x39) return undefined;
      n = n * 10 + (c - 0x30);
    }
    return n;
  }
  function recNumber(r) { var n = recordNumber(r.id); return n === undefined ? 0 : n; }

  function itemPounds(item) {
    if (item.logType !== "weightReps" || item.skipped) return 0;
    var f = item.loadFactor === undefined ? 1 : item.loadFactor;
    var total = 0;
    for (var i = 0; i < item.sets.length; i++) {
      var s = item.sets[i];
      total += (s.weight === undefined ? 0 : s.weight) * (s.reps === undefined ? 0 : s.reps) * f;
    }
    return total;
  }

  function earlierPounds(e) {
    if (e.logType !== "weightReps") return 0;
    var f = e.loadFactor === undefined ? 1 : e.loadFactor;
    var total = 0;
    for (var i = 0; i < e.sets.length; i++) {
      var s = e.sets[i];
      total += (s.weight === undefined ? 0 : s.weight) * (s.reps === undefined ? 0 : s.reps) * f;
    }
    return total;
  }

  /** Record pounds (13.1): item pounds plus the pounds of every earlier part. */
  function recordPounds(items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].pounds + (items[i].earlier ? items[i].earlier.pounds : 0);
    return total;
  }

  /**
   * The record's history items (13): for each item in order, its earlier part (B3) as a non-skipped item of
   * the earlier move, then the item itself. Without earlier parts this is just the items.
   */
  function historyItems(r) {
    var out = [];
    for (var i = 0; i < r.items.length; i++) {
      var it = r.items[i];
      var e = it.earlier;
      if (e) {
        out.push({
          slot: it.slot, exerciseId: e.exerciseId, name: e.name, logType: e.logType, role: it.role, target: it.target,
          sets: e.sets, warmupSets: e.warmupSets, loadFactor: e.loadFactor, minutes: undefined, distanceHundredths: undefined,
          feel: undefined, skipped: false, pounds: e.pounds, earlier: undefined,
        });
      }
      out.push(it);
    }
    return out;
  }

  /** Slots with something logged: the item is not skipped or it has an earlier part (B3). */
  function doneSlots(r) {
    var n = 0;
    for (var i = 0; i < r.items.length; i++) if (!r.items[i].skipped || r.items[i].earlier) n += 1;
    return n;
  }

  function cardioContext(key) {
    if (typeof key !== "string" || !isASCII(key)) return undefined;
    var i = key.indexOf(":");
    if (i < 0) return undefined;
    var ctx = key.slice(0, i);
    var x = key.slice(i + 1);
    if (ctx !== "cardioDay" && ctx !== "coreCardio") return undefined;
    var e = exercise(x);
    if (!e || e.pattern !== "cardio") return undefined;
    return { context: ctx, exerciseId: x };
  }

  function cardioCap(context, p) {
    if (!p) return 600;
    var g = cardioGoalCap(p.goal);
    return context === "coreCardio" ? Math.min(g, p.sessionMinutes - 15) : Math.min(g, p.sessionMinutes);
  }

  /** Rep range of a weighted move for a profile (6.1); without a profile [1, 30]. */
  function repRange(e, p) {
    if (!p) return { lo: 1, hi: 30 };
    return libRepRange(p.goal, p.experience, e.cls, e.equipment === "barbell");
  }

  /** The profile-dependent clamps of 4.4. */
  function clampLift(l, e, p) {
    var s = copyObj(l);
    var maxExtra = p ? maxExtraFor(p.sessionMinutes) : 2;
    s.extraSets = clampInt(s.extraSets, 0, maxExtra);
    switch (e.logType) {
      case "weightReps": {
        var r = repRange(e, p);
        s.weight = clampInt(s.weight === undefined ? e.minWeight : s.weight, e.minWeight, e.maxWeight);
        // At the lightest weight the reps target may sit below lo while the person builds up to it (12.1).
        s.reps = clampInt(s.reps === undefined ? r.lo : s.reps, s.weight === e.minWeight ? 1 : r.lo, r.hi);
        s.seconds = undefined;
        if (s.graceLeft === undefined) s.graceLeft = 0;
        if (s.rebuildTo !== undefined && s.rebuildTo <= s.weight) s.rebuildTo = undefined;
        break;
      }
      case "reps": {
        var cap = p ? repsCap(p.goal) : 200;
        s.reps = clampInt(s.reps === undefined ? 1 : s.reps, 1, cap);
        s.weight = undefined;
        s.seconds = undefined;
        s.graceLeft = undefined;
        s.rebuildTo = undefined;
        break;
      }
      case "seconds": {
        var cap2 = p ? secondsCap(p.goal) : 3600;
        s.seconds = clampInt(s.seconds === undefined ? 10 : s.seconds, 10, cap2);
        s.weight = undefined;
        s.reps = undefined;
        s.graceLeft = undefined;
        s.rebuildTo = undefined;
        break;
      }
      default:
        break;
    }
    return s;
  }

  function clampCardio(c, context, p) {
    var s = copyObj(c);
    s.minutes = clampInt(s.minutes, 10, cardioCap(context, p));
    return s;
  }

  // ---- Encoder (spec 4 member lists) ----

  function put(o, k, v) { if (v !== undefined) o[k] = v; }

  function encState(s) {
    var lifts = {};
    s.lifts.forEach(function (l, k) { lifts[k] = encLift(l); });
    var cardio = {};
    s.cardio.forEach(function (c, k) { cardio[k] = encCardio(c); });
    var swaps = {};
    s.swaps.forEach(function (v, k) { swaps[k] = v; });
    var o = {
      schemaVersion: 1, lifts: lifts, cardio: cardio, preferences: { exerciseSwaps: swaps },
      log: s.log.map(encRecord), counters: encCounters(s.counters),
    };
    if (s.profile) o.profile = encProfile(s.profile);
    if (s.plan) o.plan = encPlan(s.plan);
    if (s.undo) o.undo = encUndo(s.undo);
    return o;
  }

  function encProfile(p) {
    var o = {
      goal: p.goal, experience: p.experience, daysPerWeek: p.daysPerWeek, equipment: p.equipment,
      sessionMinutes: p.sessionMinutes,
      anchors: p.anchors.map(function (a) { return { exerciseId: a.exerciseId, weight: a.weight, reps: a.reps }; }),
    };
    put(o, "bodyWeight", p.bodyWeight);
    return o;
  }

  function encSlot(s) {
    var o = { role: s.role, exerciseId: s.exerciseId, baseExerciseId: s.baseExerciseId };
    put(o, "minutes", s.minutes);
    return o;
  }

  function encWorkout(w) { return { id: w.id, title: w.title, focus: w.focus, slots: w.slots.map(encSlot) }; }

  function encTarget(t) {
    var o = { sets: t.sets };
    put(o, "weight", t.weight);
    put(o, "reps", t.reps);
    put(o, "seconds", t.seconds);
    put(o, "minutes", t.minutes);
    return o;
  }

  function encActive(a) {
    return {
      day: a.day, workoutId: a.workoutId, kind: a.kind, title: a.title, focus: a.focus,
      items: a.items.map(function (it) {
        return { slot: it.slot, exerciseId: it.exerciseId, role: it.role, logType: it.logType, target: encTarget(it.target) };
      }),
    };
  }

  function encPlan(p) {
    var o = {
      startDay: p.startDay, builtDay: p.builtDay, cycle: p.cycle.slice(), workouts: p.workouts.map(encWorkout),
      rotation: p.rotation.slice(), queue: p.queue.slice(),
    };
    if (p.todayChoice) o.todayChoice = { day: p.todayChoice.day, choice: p.todayChoice.choice };
    if (p.todaySwaps) {
      o.todaySwaps = {
        day: p.todaySwaps.day,
        swaps: p.todaySwaps.swaps.map(function (w) { return { workoutId: w.workoutId, slot: w.slot, exerciseId: w.exerciseId }; }),
      };
    }
    if (p.active) o.active = encActive(p.active);
    return o;
  }

  function encLift(l) {
    var o = {
      extraSets: l.extraSets, missStreak: l.missStreak, calibrationLeft: l.calibrationLeft, sessions: l.sessions,
      sessionsAtTarget: l.sessionsAtTarget,
    };
    put(o, "weight", l.weight);
    put(o, "reps", l.reps);
    put(o, "seconds", l.seconds);
    put(o, "graceLeft", l.graceLeft);
    put(o, "rebuildTo", l.rebuildTo);
    put(o, "lastDay", l.lastDay);
    return o;
  }

  function encCardio(c) {
    var o = { minutes: c.minutes, missStreak: c.missStreak };
    put(o, "lastIncreaseWeek", c.lastIncreaseWeek);
    put(o, "lastDay", c.lastDay);
    return o;
  }

  function encSet(s) {
    var o = {};
    put(o, "weight", s.weight);
    put(o, "reps", s.reps);
    put(o, "seconds", s.seconds);
    return o;
  }

  function encItem(i) {
    var o = {
      slot: i.slot, exerciseId: i.exerciseId, name: i.name, logType: i.logType, role: i.role, target: encTarget(i.target),
      sets: i.sets.map(encSet), skipped: i.skipped, pounds: i.pounds,
    };
    put(o, "warmupSets", i.warmupSets);
    put(o, "loadFactor", i.loadFactor);
    put(o, "minutes", i.minutes);
    put(o, "distanceHundredths", i.distanceHundredths);
    put(o, "feel", i.feel);
    if (i.earlier) o.earlier = encEarlier(i.earlier);
    return o;
  }

  function encEarlier(e) {
    var o = { exerciseId: e.exerciseId, name: e.name, logType: e.logType, sets: e.sets.map(encSet), pounds: e.pounds };
    put(o, "warmupSets", e.warmupSets);
    put(o, "loadFactor", e.loadFactor);
    return o;
  }

  function encPR(r) {
    var o = { exerciseId: r.exerciseId, name: r.name, type: r.type, value: r.value, text: r.text };
    put(o, "weight", r.weight);
    put(o, "reps", r.reps);
    put(o, "seconds", r.seconds);
    put(o, "label", r.label);
    return o;
  }

  function encNextStep(n) {
    return { slot: n.slot, exerciseId: n.exerciseId, change: n.change, reasonCode: n.reasonCode, reason: n.reason, text: n.text };
  }

  function encRecord(r) {
    var o = {
      id: r.id, day: r.day, kind: r.kind, title: r.title, focus: r.focus, durationMinutes: r.durationMinutes,
      pounds: r.pounds, items: r.items.map(encItem), records: r.records.map(encPR), next: r.next.map(encNextStep),
    };
    put(o, "workoutId", r.workoutId);
    put(o, "distanceHundredths", r.distanceHundredths);
    return o;
  }

  function encCounters(c) {
    var o = { nextRecordNumber: c.nextRecordNumber };
    put(o, "coachStartDay", c.coachStartDay);
    return o;
  }

  function encUndo(u) {
    var o = {
      recordId: u.recordId,
      lifts: u.lifts.map(function (e) {
        var m = { id: e.id };
        if (e.state) m.state = encLift(e.state);
        return m;
      }),
      cardio: u.cardio.map(function (e) {
        var m = { key: e.key };
        if (e.state) m.state = encCardio(e.state);
        return m;
      }),
    };
    if (u.queue) o.queue = u.queue.slice();
    if (u.day !== undefined) o.day = u.day;
    return o;
  }

  // ---- Decoder (3.7) and repairs (4.11) ----

  /** Returns {state} or {error: "corruptData" | "newerVersion"}. */
  function decodeState(value) {
    if (!isObject(value)) return { error: "corruptData" };
    var v = mInt(value, "schemaVersion");
    if (v !== undefined && v > 1) return { error: "newerVersion" };
    var s = newModel();
    var po = mObject(value, "profile");
    s.profile = po ? decProfile(po) : undefined;
    var plo = mObject(value, "plan");
    if (s.profile && plo) s.plan = decPlan(plo, s.profile);
    s.swaps = decExerciseSwaps(mObject(value, "preferences"));
    s.log = decLog(mArray(value, "log"));
    var counters = { nextRecordNumber: 1, coachStartDay: undefined };
    var co = mObject(value, "counters");
    if (co) {
      var nrn = mInt(co, "nextRecordNumber", 1, 1000000000);
      counters.nextRecordNumber = nrn === undefined ? 1 : nrn;
      counters.coachStartDay = mDay(co, "coachStartDay");
    }
    s.counters = counters;
    // Repair 6: lifts.
    var lo = mObject(value, "lifts");
    if (lo) {
      var lkeys = Object.keys(lo).sort();
      for (var i = 0; i < lkeys.length; i++) {
        var key = lkeys[i];
        var e = exercise(key);
        if (!e || isCardioEx(e)) continue;
        var st = decLiftState(lo[key], e, s.profile);
        if (!st) continue;
        s.lifts.set(key, st);
      }
    }
    // Repair 7: cardio.
    var cdo = mObject(value, "cardio");
    if (cdo) {
      var ckeys = Object.keys(cdo).sort();
      for (var j = 0; j < ckeys.length; j++) {
        var ck = ckeys[j];
        var ctx = cardioContext(ck);
        if (!ctx) continue;
        var cs = decCardioState(cdo[ck], ctx.context, s.profile);
        if (!cs) continue;
        s.cardio.set(ck, cs);
      }
    }
    // Repair 9.
    var largest = 0;
    for (var k = 0; k < s.log.length; k++) largest = Math.max(largest, recNumber(s.log[k]));
    s.counters.nextRecordNumber = Math.min(1000000000, Math.max(s.counters.nextRecordNumber, largest + 1));
    // Repair 10.
    if (s.counters.coachStartDay === undefined && s.plan) s.counters.coachStartDay = s.plan.startDay;
    // Repair 12.
    var uo = mObject(value, "undo");
    s.undo = uo ? decUndo(uo, s) : undefined;
    return { state: s };
  }

  function decProfile(m) {
    var goal = mEnum(m, "goal", GOALS);
    var exp = mEnum(m, "experience", EXPERIENCES);
    var days = mInt(m, "daysPerWeek", 2, 6);
    var eq = mEnum(m, "equipment", EQUIPMENTS);
    var minutes = mInt(m, "sessionMinutes");
    if (goal === undefined || exp === undefined || days === undefined || eq === undefined || minutes === undefined) return undefined;
    if (minutes !== 30 && minutes !== 45 && minutes !== 60) return undefined;
    var p = { goal: goal, experience: exp, daysPerWeek: days, equipment: eq, sessionMinutes: minutes, bodyWeight: undefined, anchors: [] };
    p.bodyWeight = mInt(m, "bodyWeight", 50, 700);
    var allowed = anchorIds(eq);
    var anchors = [];
    var raw = mArray(m, "anchors") || [];
    for (var i = 0; i < raw.length; i++) {
      var am = raw[i];
      if (!isObject(am)) continue;
      var id = mString(am, "exerciseId");
      if (id === undefined || allowed.indexOf(id) < 0) continue;
      var e = exercise(id);
      if (!e) continue;
      var dup = false;
      for (var k = 0; k < anchors.length; k++) if (anchors[k].exerciseId === id) dup = true;
      if (dup) continue;
      if (isWeightedEx(e)) {
        var w = mInt(am, "weight", e.minWeight, e.maxWeight);
        var r = mInt(am, "reps", 1, 30);
        if (w === undefined || r === undefined) continue;
        anchors.push({ exerciseId: id, weight: w, reps: r });
      } else {
        var r2 = mInt(am, "reps", 1, 200);
        if (r2 === undefined) continue;
        anchors.push({ exerciseId: id, weight: 0, reps: r2 });
      }
      if (anchors.length === 4) break;
    }
    p.anchors = anchors;
    return p;
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function decPlan(m, p) {
    var startDay = mDay(m, "startDay");
    if (startDay === undefined) return undefined;
    var builtDay = mDay(m, "builtDay");
    if (builtDay === undefined) builtDay = startDay;
    var cycleRaw = mArray(m, "cycle");
    if (!cycleRaw || cycleRaw.length !== 7) return undefined;
    var cycle = [];
    for (var i = 0; i < cycleRaw.length; i++) {
      var k = enumFrom(cycleRaw[i], DAY_KINDS);
      if (k === undefined) return undefined;
      cycle.push(k);
    }
    var workoutsRaw = mArray(m, "workouts");
    var rotationRaw = mArray(m, "rotation");
    var queueRaw = mArray(m, "queue");
    if (!workoutsRaw || !rotationRaw || !queueRaw) return undefined;
    var rotation = [];
    for (var r = 0; r < rotationRaw.length; r++) {
      var sv = rotationRaw[r];
      if (typeof sv !== "string" || !isPrintableASCII(sv, 60)) return undefined;
      rotation.push(sv);
    }
    if (rotation.length < 2 || rotation.length > 6 || new Set(rotation).size !== rotation.length) return undefined;

    var b = buildWorkouts(p, new Map());
    // Repair 2: structure must match the plan 8.1 would build with empty preferences.
    if (!arraysEqual(cycle, b.cycle) || !arraysEqual(rotation, b.rotation)) return undefined;
    var stored = [];
    for (var wi = 0; wi < workoutsRaw.length; wi++) {
      var w0 = decWorkout(workoutsRaw[wi]);
      if (w0) stored.push(w0);
    }
    var workouts = [];
    for (var bi = 0; bi < b.workouts.length; bi++) {
      var bw = b.workouts[bi];
      var matches = stored.filter(function (x) { return x.id === bw.id; });
      if (matches.length !== 1) return undefined;
      var w = matches[0];
      if (w.slots.length !== bw.slots.length) return undefined;
      for (var j = 0; j < bw.slots.length; j++) if (w.slots[j].role !== bw.slots[j].role) return undefined;
      for (var sj = 0; sj < w.slots.length; sj++) {
        var s = w.slots[sj];
        // 2a.
        var ce = exercise(s.exerciseId);
        var fitsNow = ce ? fitsEq(ce, p.equipment) : false;
        var be0 = exercise(s.baseExerciseId);
        if (!fitsNow && be0 && fitsEq(be0, p.equipment)) s.exerciseId = s.baseExerciseId;
        // A move outside the slot's family (a hand-edited file) falls back to the base instead of dropping
        // the whole plan (SPEC_GAPS 10).
        if (s.exerciseId !== s.baseExerciseId && family(s.baseExerciseId).indexOf(s.exerciseId) < 0) {
          s.exerciseId = s.baseExerciseId;
        }
        // 2b.
        var e = exercise(s.exerciseId);
        var be = exercise(s.baseExerciseId);
        if (!e || !fitsEq(e, p.equipment) || !be || !fitsEq(be, p.equipment)) return undefined;
        var wantCardio = undefined;
        switch (s.role) {
          case "cardio": case "recovery": wantCardio = true; break;
          case "finisher": {
            var fe = exercise(bw.slots[sj].exerciseId);
            wantCardio = fe ? isCardioEx(fe) : false;
            break;
          }
          default: wantCardio = false;
        }
        if (isCardioEx(e) !== wantCardio) return undefined;
        // 2c.
        s.minutes = bw.slots[sj].minutes;
      }
      var ids = w.slots.map(function (x) { return x.exerciseId; });
      if (new Set(ids).size !== ids.length) return undefined;
      w.title = bw.title;
      w.focus = bw.focus;
      workouts.push(w);
    }
    // Repair 3: queue.
    var queue = [];
    var queueOK = true;
    for (var q = 0; q < queueRaw.length; q++) {
      if (typeof queueRaw[q] !== "string") { queueOK = false; break; }
      queue.push(queueRaw[q]);
    }
    if (!queueOK || !isPermutation(queue, rotation)) queue = rotation.slice();

    var plan = {
      startDay: startDay, builtDay: builtDay, cycle: cycle, workouts: workouts, rotation: rotation, queue: queue,
      todayChoice: undefined, todaySwaps: undefined, active: undefined,
    };
    var c = mObject(m, "todayChoice");
    if (c) {
      var d = mDay(c, "day");
      var ch = mEnum(c, "choice", CHOICES);
      if (d !== undefined && ch !== undefined) plan.todayChoice = { day: d, choice: ch };
    }
    var t = mObject(m, "todaySwaps");
    if (t) plan.todaySwaps = decTodaySwaps(t, plan, p);
    var a = mObject(m, "active");
    if (a) plan.active = decActive(a, plan, p);
    return plan;
  }

  function decWorkout(v) {
    if (!isObject(v)) return undefined;
    var id = mString(v, "id");
    var title = mString(v, "title");
    var focus = mEnum(v, "focus", FOCI);
    var slotsRaw = mArray(v, "slots");
    if (id === undefined || title === undefined || focus === undefined || !slotsRaw) return undefined;
    var slots = [];
    for (var i = 0; i < slotsRaw.length; i++) {
      var sm = slotsRaw[i];
      if (!isObject(sm)) continue;
      var role = mEnum(sm, "role", ROLES);
      var x = mString(sm, "exerciseId");
      if (role === undefined || x === undefined) continue;
      var base = mString(sm, "baseExerciseId");
      slots.push({ role: role, exerciseId: x, baseExerciseId: base === undefined ? x : base, minutes: undefined });
    }
    if (slots.length === 0) return undefined;
    return { id: id, title: title, focus: focus, slots: slots };
  }

  function isPermutation(a, b) {
    if (a.length !== b.length) return false;
    var x = a.slice().sort();
    var y = b.slice().sort();
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  function findWorkout(plan, id) {
    for (var i = 0; i < plan.workouts.length; i++) if (plan.workouts[i].id === id) return plan.workouts[i];
    return undefined;
  }

  function decTodaySwaps(m, plan, p) {
    var day = mDay(m, "day");
    var raw = mArray(m, "swaps");
    if (day === undefined || !raw) return undefined;
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var sm = raw[i];
      if (!isObject(sm)) continue;
      var wid = mString(sm, "workoutId");
      var slot = mInt(sm, "slot");
      var x = mString(sm, "exerciseId");
      if (wid === undefined || slot === undefined || x === undefined) continue;
      var w = findWorkout(plan, wid);
      if (!w || slot < 0 || slot >= w.slots.length) continue;
      var s = w.slots[slot];
      var e = exercise(x);
      var pe = exercise(s.exerciseId);
      if (!e || !fitsEq(e, p.equipment) || !pe || isCardioEx(e) !== isCardioEx(pe) || x === s.exerciseId) continue;
      if (!(x === s.baseExerciseId || family(s.baseExerciseId).indexOf(x) >= 0)) continue;
      var dup = false;
      for (var k = 0; k < out.length; k++) if (out[k].workoutId === wid && out[k].slot === slot) dup = true;
      if (dup) continue;
      out.push({ workoutId: wid, slot: slot, exerciseId: x });
    }
    if (out.length === 0) return undefined;
    return { day: day, swaps: sortSwaps(out) };
  }

  function sortSwaps(a) {
    return a.slice().sort(function (x, y) {
      if (x.workoutId !== y.workoutId) return x.workoutId < y.workoutId ? -1 : 1;
      return x.slot - y.slot;
    });
  }

  function decTarget(v, logType, strict, e) {
    if (!isObject(v)) return undefined;
    var sets = mInt(v, "sets", 0, 5);
    if (sets === undefined) return undefined;
    var t = { sets: sets, weight: undefined, reps: undefined, seconds: undefined, minutes: undefined };
    if (strict) {
      switch (logType) {
        case "weightReps": {
          if (sets < 1 || !e) return undefined;
          var w = mInt(v, "weight", e.minWeight, e.maxWeight);
          var r = mInt(v, "reps", 1, 200);
          if (w === undefined || r === undefined) return undefined;
          t.weight = w;
          t.reps = r;
          break;
        }
        case "reps": {
          var r2 = mInt(v, "reps", 1, 200);
          if (sets < 1 || r2 === undefined) return undefined;
          t.reps = r2;
          break;
        }
        case "seconds": {
          var s = mInt(v, "seconds", 1, 3600);
          if (sets < 1 || s === undefined) return undefined;
          t.seconds = s;
          break;
        }
        default: {
          var mi = mInt(v, "minutes", 1, 600);
          if (sets !== 1 || mi === undefined) return undefined;
          t.minutes = mi;
        }
      }
      return t;
    }
    switch (logType) {
      case "weightReps":
        t.weight = mInt(v, "weight", 0, 100000);
        t.reps = mInt(v, "reps", 0, 100000);
        break;
      case "reps":
        t.reps = mInt(v, "reps", 0, 100000);
        break;
      case "seconds":
        t.seconds = mInt(v, "seconds", 0, 100000);
        break;
      default:
        t.minutes = mInt(v, "minutes", 0, 100000);
    }
    return t;
  }

  function decActive(m, plan, p) {
    var day = mDay(m, "day");
    var wid = mString(m, "workoutId");
    var kind = mEnum(m, "kind", DAY_KINDS);
    var itemsRaw = mArray(m, "items");
    if (day === undefined || wid === undefined || kind === undefined || kind === "rest") return undefined;
    if (mString(m, "title") === undefined || mEnum(m, "focus", FOCI) === undefined || !itemsRaw) return undefined;
    var w = findWorkout(plan, wid);
    if (!w) return undefined;
    if (kind === "training") {
      if (plan.rotation.indexOf(wid) < 0 || plan.queue[0] !== wid) return undefined;
    } else if (kind === "cardio") {
      if (wid !== "cardio") return undefined;
    } else if (kind === "recovery") {
      if (wid !== "recovery") return undefined;
    }
    if (itemsRaw.length !== w.slots.length) return undefined;
    var items = [];
    for (var j = 0; j < itemsRaw.length; j++) {
      var slot = w.slots[j];
      var im = itemsRaw[j];
      if (!isObject(im)) return undefined;
      var sl = mInt(im, "slot");
      var x = mString(im, "exerciseId");
      var role = mEnum(im, "role", ROLES);
      var lt = mEnum(im, "logType", LOG_TYPES);
      if (sl === undefined || sl !== j || x === undefined || role === undefined || role !== slot.role || lt === undefined) return undefined;
      var e = exercise(x);
      if (!e || e.logType !== lt || !fitsEq(e, p.equipment)) return undefined;
      var pe = exercise(slot.exerciseId);
      if (!pe || isCardioEx(e) !== isCardioEx(pe)) return undefined;
      if (!(x === slot.baseExerciseId || family(slot.baseExerciseId).indexOf(x) >= 0)) return undefined;
      var t = decTarget(mValue(im, "target"), lt, true, e);
      if (!t) return undefined;
      items.push({ slot: j, exerciseId: x, role: role, logType: lt, target: t });
    }
    var ids = items.map(function (it) { return it.exerciseId; });
    if (new Set(ids).size !== ids.length) return undefined;
    return { day: day, workoutId: wid, kind: kind, title: w.title, focus: w.focus, items: items };
  }

  function decLiftState(v, e, p) {
    if (!isObject(v)) return undefined;
    var s = newLift();
    switch (e.logType) {
      case "weightReps": {
        var w = mInt(v, "weight");
        var r = mInt(v, "reps");
        if (w === undefined || r === undefined) return undefined;
        s.weight = w;
        s.reps = r;
        var g = mInt(v, "graceLeft", 0, 1);
        s.graceLeft = g === undefined ? 0 : g;
        s.rebuildTo = mInt(v, "rebuildTo", e.minWeight, e.maxWeight);
        break;
      }
      case "reps": {
        var r2 = mInt(v, "reps");
        if (r2 === undefined) return undefined;
        s.reps = r2;
        break;
      }
      case "seconds": {
        var sec = mInt(v, "seconds");
        if (sec === undefined) return undefined;
        s.seconds = sec;
        break;
      }
      default:
        return undefined;
    }
    var x = mInt(v, "extraSets");
    s.extraSets = x === undefined ? 0 : x;
    var ms = mInt(v, "missStreak", 0, 1);
    s.missStreak = ms === undefined ? 0 : ms;
    var cl = mInt(v, "calibrationLeft", 0, 2);
    s.calibrationLeft = cl === undefined ? 0 : cl;
    var se = mInt(v, "sessions", 0, 1000000000);
    s.sessions = se === undefined ? 0 : se;
    var at = mClamped(v, "sessionsAtTarget", 0, 30);
    s.sessionsAtTarget = at === undefined ? 0 : at;
    s.lastDay = mDay(v, "lastDay");
    return clampLift(s, e, p);
  }

  function decCardioState(v, context, p) {
    if (!isObject(v)) return undefined;
    var minutes = mInt(v, "minutes");
    if (minutes === undefined) return undefined;
    var c = { minutes: minutes, missStreak: 0, lastIncreaseWeek: undefined, lastDay: undefined };
    var ms = mInt(v, "missStreak", 0, 1);
    c.missStreak = ms === undefined ? 0 : ms;
    var w = mDay(v, "lastIncreaseWeek");
    if (w !== undefined) c.lastIncreaseWeek = dayKey(mondayOf(dayNumber(w)));
    c.lastDay = mDay(v, "lastDay");
    return clampCardio(c, context, p);
  }

  function decExerciseSwaps(o) {
    var out = new Map();
    if (!o) return out;
    var sw = mObject(o, "exerciseSwaps");
    if (!sw) return out;
    var keys = Object.keys(sw).sort();
    for (var i = 0; i < keys.length; i++) {
      var base = keys[i];
      var to = sw[base];
      if (typeof to !== "string" || !exercise(base) || !exercise(to) || base === to) continue;
      if (family(base).indexOf(to) < 0) continue;
      out.set(base, to);
    }
    return out;
  }

  function decLog(raw) {
    var out = [];
    var ids = new Set();
    if (!raw) return out;
    for (var i = 0; i < raw.length; i++) {
      var r = decRecord(raw[i]);
      if (!r) continue;
      if (ids.has(r.id)) continue;
      ids.add(r.id);
      out.push(r);
      if (out.length === 1000000) break;
    }
    return out;
  }

  function defaultFocus(k) {
    switch (k) {
      case "training": return "fullBody";
      case "cardio": return "cardio";
      case "recovery": return "recovery";
      default: return "free";
    }
  }

  function focusFits(f, k) {
    switch (k) {
      case "training": return ["push", "pull", "legs", "upper", "fullBody", "coreCardio"].indexOf(f) >= 0;
      case "cardio": return f === "cardio";
      case "recovery": return f === "recovery";
      default: return f === "free";
    }
  }

  function decRecord(v) {
    if (!isObject(v)) return undefined;
    var id = mStr(v, "id");
    if (id === undefined || recordNumber(id) === undefined) return undefined;
    var day = mDay(v, "day");
    var kind = mEnum(v, "kind", RECORD_KINDS);
    if (day === undefined || kind === undefined) return undefined;
    var workoutId = undefined;
    if (kind !== "free") {
      workoutId = mString(v, "workoutId");
      if (workoutId === undefined) return undefined;
    }
    var focus = mEnum(v, "focus", FOCI);
    if (focus === undefined) focus = defaultFocus(kind);
    if (!focusFits(focus, kind)) focus = defaultFocus(kind);
    var title = mString(v, "title");
    var dur = mClamped(v, "durationMinutes", 0, 600);
    var r = {
      id: id, day: day, kind: kind, workoutId: workoutId, title: title === undefined ? "Workout" : title, focus: focus,
      durationMinutes: dur === undefined ? 0 : dur, distanceHundredths: mInt(v, "distanceHundredths", 0, 100000),
      pounds: 0, items: [], records: [], next: [],
    };
    if (kind !== "free") {
      var items = [];
      var itemsRaw = mArray(v, "items") || [];
      for (var i = 0; i < itemsRaw.length; i++) {
        var it = decItem(itemsRaw[i]);
        if (!it) continue;
        var dup = false;
        for (var k = 0; k < items.length; k++) if (items[k].slot === it.slot) dup = true;
        if (dup) continue;
        items.push(it);
        if (items.length === 7) break;
      }
      r.items = items;
      var next = [];
      var nextRaw = mArray(v, "next") || [];
      for (var j = 0; j < nextRaw.length; j++) {
        var n = decNextStep(nextRaw[j]);
        if (n) next.push(n);
      }
      r.next = next;
    }
    var prs = [];
    var prRaw = mArray(v, "records") || [];
    for (var q = 0; q < prRaw.length; q++) {
      var pr = decPR(prRaw[q]);
      if (pr) prs.push(pr);
    }
    r.records = prs;
    r.pounds = recordPounds(r.items);
    return r;
  }

  function decItem(v) {
    if (!isObject(v)) return undefined;
    var slot = mInt(v, "slot", 0, 15);
    var x = mString(v, "exerciseId");
    if (slot === undefined || x === undefined) return undefined;
    var lib = exercise(x);
    var lt = mEnum(v, "logType", LOG_TYPES);
    if (lt === undefined) lt = lib ? lib.logType : undefined;
    if (lt === undefined) return undefined;
    var name = mString(v, "name");
    if (name === undefined) name = lib ? lib.name : "Exercise";
    var role = mEnum(v, "role", ROLES);
    if (role === undefined) role = "accessory";
    var target = decTarget(mValue(v, "target"), lt, false, lib) || { sets: 0, weight: undefined, reps: undefined, seconds: undefined, minutes: undefined };
    var sets = decSetLogs(mArray(v, "sets") || [], lt);
    var it = {
      slot: slot, exerciseId: x, name: name, logType: lt, role: role, target: target, sets: sets,
      warmupSets: undefined, loadFactor: undefined, minutes: undefined, distanceHundredths: undefined, feel: undefined,
      skipped: false, pounds: 0, earlier: undefined,
    };
    if (lt === "cardio") {
      it.minutes = mInt(v, "minutes", 0, 600);
      it.distanceHundredths = mInt(v, "distanceHundredths", 0, 100000);
    }
    it.feel = mEnum(v, "feel", FEELS);
    var nothing = lt === "cardio" ? (it.minutes === undefined ? 0 : it.minutes) === 0 : sets.length === 0;
    var sk = mBool(v, "skipped");
    it.skipped = (sk === undefined ? false : sk) || nothing;
    if (it.skipped) {
      it.sets = [];
      it.minutes = undefined;
      it.distanceHundredths = undefined;
      it.feel = undefined;
    }
    if (lt === "weightReps") {
      var lf = mInt(v, "loadFactor");
      it.loadFactor = (lf === 1 || lf === 2 || lf === 4) ? lf : (lib ? loadFactor(lib) : 1);
      var wu = mInt(v, "warmupSets");
      it.warmupSets = clampInt(wu === undefined ? 0 : wu, 0, Math.max(0, it.sets.length - 1));
    }
    it.pounds = itemPounds(it);
    var ev = mValue(v, "earlier");
    if (ev !== undefined) it.earlier = decEarlier(ev);
    return it;
  }

  /** The stored sets of one item (4.7): only the members of its logType, in range; at most 10. */
  function decSetLogs(setsRaw, lt) {
    var sets = [];
    if (lt === "cardio") return sets;
    for (var i = 0; i < setsRaw.length; i++) {
      var sm = setsRaw[i];
      if (!isObject(sm)) continue;
      var s = { weight: undefined, reps: undefined, seconds: undefined };
      if (lt === "weightReps") {
        var w = mInt(sm, "weight", 1, 1500);
        var r = mInt(sm, "reps", 1, 100);
        if (w === undefined || r === undefined) continue;
        s.weight = w;
        s.reps = r;
      } else if (lt === "reps") {
        var r2 = mInt(sm, "reps", 1, 200);
        if (r2 === undefined) continue;
        s.reps = r2;
      } else {
        var sec = mInt(sm, "seconds", 1, 3600);
        if (sec === undefined) continue;
        s.seconds = sec;
      }
      sets.push(s);
      if (sets.length === 10) break;
    }
    return sets;
  }

  /** An earlier part (B3, 4.7): dropped when it has no exerciseId, its logType is cardio or unknown, or no set is left. */
  function decEarlier(v) {
    if (!isObject(v)) return undefined;
    var x = mString(v, "exerciseId");
    if (x === undefined) return undefined;
    var lib = exercise(x);
    var lt = mEnum(v, "logType", LOG_TYPES);
    if (lt === undefined) lt = lib ? lib.logType : undefined;
    if (lt === undefined || lt === "cardio") return undefined;
    var sets = decSetLogs(mArray(v, "sets") || [], lt);
    if (sets.length === 0) return undefined;
    var name = mString(v, "name");
    var e = {
      exerciseId: x, name: name === undefined ? (lib ? lib.name : "Exercise") : name, logType: lt, sets: sets,
      warmupSets: undefined, loadFactor: undefined, pounds: 0,
    };
    if (lt === "weightReps") {
      var lf = mInt(v, "loadFactor");
      e.loadFactor = (lf === 1 || lf === 2 || lf === 4) ? lf : (lib ? loadFactor(lib) : 1);
      var wu = mInt(v, "warmupSets");
      e.warmupSets = clampInt(wu === undefined ? 0 : wu, 0, Math.max(0, sets.length - 1));
    }
    e.pounds = earlierPounds(e);
    return e;
  }

  function decPR(v) {
    if (!isObject(v)) return undefined;
    var x = mString(v, "exerciseId");
    var name = mString(v, "name");
    var type = mString(v, "type");
    var value = mInt(v, "value", 1, 100000);
    var txt = mString(v, "text", 200);
    if (x === undefined || name === undefined || type === undefined || value === undefined || txt === undefined) return undefined;
    var r = { exerciseId: x, name: name, type: type, value: value, weight: undefined, reps: undefined, seconds: undefined, label: undefined, text: txt };
    switch (type) {
      case "heaviest": {
        var w = mInt(v, "weight", 1, 1500);
        var rp = mInt(v, "reps", 1, 100);
        if (w === undefined || rp === undefined) return undefined;
        r.weight = w;
        r.reps = rp;
        break;
      }
      case "estimatedMax": {
        var w2 = mInt(v, "weight", 1, 1500);
        var rp2 = mInt(v, "reps", 1, 100);
        if (w2 === undefined || rp2 === undefined || mString(v, "label") !== "Estimated") return undefined;
        r.weight = w2;
        r.reps = rp2;
        r.label = "Estimated";
        break;
      }
      case "mostReps": {
        var rp3 = mInt(v, "reps", 1, 200);
        if (rp3 === undefined) return undefined;
        r.reps = rp3;
        break;
      }
      case "longestHold": {
        var s = mInt(v, "seconds", 1, 3600);
        if (s === undefined) return undefined;
        r.seconds = s;
        break;
      }
      default:
        return undefined;
    }
    return r;
  }

  function decNextStep(v) {
    if (!isObject(v)) return undefined;
    var slot = mInt(v, "slot", 0, 15);
    var x = mString(v, "exerciseId");
    var change = mEnum(v, "change", CHANGES);
    var code = mString(v, "reasonCode");
    var reason = mString(v, "reason", 200);
    var txt = mString(v, "text", 200);
    if (slot === undefined || x === undefined || change === undefined || code === undefined || reason === undefined || txt === undefined) return undefined;
    return { slot: slot, exerciseId: x, change: change, reasonCode: code, reason: reason, text: txt };
  }

  function newestRecord(log) {
    var best = undefined;
    for (var i = 0; i < log.length; i++) {
      if (best === undefined || recNumber(best) < recNumber(log[i])) best = log[i];
    }
    return best;
  }

  function decUndo(m, s) {
    var rid = mStr(m, "recordId");
    var liftsRaw = mArray(m, "lifts");
    var cardioRaw = mArray(m, "cardio");
    if (rid === undefined || !liftsRaw || !cardioRaw) return undefined;
    var newest = newestRecord(s.log);
    if (!newest || newest.id !== rid) return undefined;
    var lifts = [];
    for (var i = 0; i < liftsRaw.length; i++) {
      var em = liftsRaw[i];
      if (!isObject(em)) return undefined;
      var id = mStr(em, "id");
      var e = exercise(id);
      if (id === undefined || !e || isCardioEx(e)) return undefined;
      for (var k = 0; k < lifts.length; k++) if (lifts[k].id === id) return undefined;
      var entry = { id: id, state: undefined };
      var sv = mValue(em, "state");
      if (sv !== undefined) {
        var st = decLiftState(sv, e, s.profile);
        if (!st) return undefined;
        entry.state = st;
      }
      lifts.push(entry);
    }
    var cardio = [];
    for (var j = 0; j < cardioRaw.length; j++) {
      var cm = cardioRaw[j];
      if (!isObject(cm)) return undefined;
      var key = mStr(cm, "key");
      var ctx = key === undefined ? undefined : cardioContext(key);
      if (!ctx) return undefined;
      for (var q = 0; q < cardio.length; q++) if (cardio[q].key === key) return undefined;
      var centry = { key: key, state: undefined };
      var csv = mValue(cm, "state");
      if (csv !== undefined) {
        var cst = decCardioState(csv, ctx.context, s.profile);
        if (!cst) return undefined;
        centry.state = cst;
      }
      cardio.push(centry);
    }
    var queue = undefined;
    var qv = mValue(m, "queue");
    if (qv !== undefined) {
      if (!s.plan || !Array.isArray(qv)) return undefined;
      var qq = [];
      for (var z = 0; z < qv.length; z++) {
        if (typeof qv[z] !== "string") return undefined;
        qq.push(qv[z]);
      }
      if (!isPermutation(qq, s.plan.rotation)) return undefined;
      queue = qq;
    }
    lifts.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
    cardio.sort(function (a, b) { return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0); });
    // The day the session was finished (11.4). A day before the record's own day cannot be right; it is
    // dropped (the record day is used).
    var uday = mDay(m, "day");
    if (uday !== undefined && dayNumber(uday) < dayNumber(newest.day)) uday = undefined;
    return { recordId: rid, lifts: lifts, cardio: cardio, queue: queue, day: uday };
  }

  // ---------------------------------------------------------------------------------------------------
  // Plans (spec 8), the seven-day projection, cards and sessions (9.1 to 9.4), safety (9.5),
  // today's actions (9.6) and the week view (16.3).
  // ---------------------------------------------------------------------------------------------------

  /** Record indices by day, built once per operation. */
  function LogIndex(log) {
    this.byDay = new Map();
    this.dayNumbers = [];
    this.numbers = [];
    this.newestDay = undefined;
    for (var k = 0; k < log.length; k++) {
      var d = dayNumber(log[k].day);
      if (d === undefined) d = 0;
      this.dayNumbers.push(d);
      this.numbers.push(recNumber(log[k]));
      var list = this.byDay.get(d);
      if (!list) { list = []; this.byDay.set(d, list); }
      list.push(k);
      this.newestDay = this.newestDay === undefined ? d : Math.max(this.newestDay, d);
    }
    var dn = this.dayNumbers;
    var nums = this.numbers;
    var order = [];
    for (var i = 0; i < log.length; i++) order.push(i);
    order.sort(function (a, b) {
      if (dn[a] !== dn[b]) return dn[b] - dn[a];
      return nums[b] - nums[a];
    });
    this.newestFirst = order;
  }
  LogIndex.prototype.countedOldestFirst = function (today) {
    var out = [];
    for (var i = this.newestFirst.length - 1; i >= 0; i--) {
      var k = this.newestFirst[i];
      if (this.dayNumbers[k] <= today) out.push(k);
    }
    return out;
  };
  LogIndex.prototype.recordsOn = function (d) { return this.byDay.get(d) || []; };

  /** The context of one operation: its own copy of the state, today and the log index. */
  function makeCtx(s, today) {
    var st = copyModel(s);
    return { state: st, today: today, index: new LogIndex(st.log), profile: st.profile, plan: st.plan, log: st.log };
  }

  function newCard(i, dn, kind, workoutId, title, focus) {
    return {
      i: i, dn: dn, kind: kind, workoutId: workoutId, title: title, focus: focus, done: false, planDone: false,
      active: false, recordIndex: undefined, fromRecord: false, restByChoice: false, restMovedWorkout: undefined,
      choice: undefined,
    };
  }

  // ---- Workouts (8.1) ----

  function buildWorkouts(p, prefs) {
    var lay = layout(p.daysPerWeek);
    var cycle = lay.cycle.map(function (c) { return c === "training" ? "training" : (c === "rest" ? "rest" : cycleX(p.goal)); });
    var rotation = lay.rotation.map(function (r) { return r[0]; });
    var workouts = [];
    var strengthNumber = 0;
    for (var ri = 0; ri < lay.rotation.length; ri++) {
      var wid = lay.rotation[ri][0];
      var title = lay.rotation[ri][1];
      var tp = template(wid);
      var used = undefined;
      if (wid === "coreCardio") {
        used = tp.slots.slice(0, Math.min(4, coreSlots(p.sessionMinutes)));
        used.push(tp.slots[4]);
      } else {
        used = tp.slots.slice(0, strengthSlots(p.sessionMinutes));
      }
      var bases = used.map(function (sl) { return pick(sl, p.equipment); });
      var roles = used.map(function (sl) { return sl.role; });
      if (wid === "legs" && p.equipment === "fullGym" && p.daysPerWeek >= 3 && p.daysPerWeek <= 5 &&
        p.anchors.some(function (a) { return a.exerciseId === "deadlift"; })) {
        bases[1] = "deadlift";
      }
      for (var j = 0; j < bases.length; j++) {
        var x = bases[j];
        var row = undefined;
        for (var q = 0; q < NEW_LIFTER_SWAPS.length; q++) if (NEW_LIFTER_SWAPS[q][0] === x) { row = NEW_LIFTER_SWAPS[q]; break; }
        if (!row) continue;
        var seeded = p.anchors.some(function (a) {
          return seedsOfAnchor(a.exerciseId).some(function (sd) { return sd[0] === x; });
        });
        var weakPushUp = x === "pushUp" && p.anchors.some(function (a) { return a.exerciseId === "pushUp" && a.reps < 5; });
        if (!((p.experience === "new" && !seeded) || weakPushUp)) continue;
        var subs = row[1];
        for (var si = 0; si < subs.length; si++) {
          var taken = false;
          for (var k = 0; k < bases.length; k++) if (k !== j && bases[k] === subs[si]) taken = true;
          if (!taken) { bases[j] = subs[si]; break; }
        }
      }
      var slotRoles = roles.slice();
      var minutes = bases.map(function () { return undefined; });
      if (wid !== "coreCardio") {
        var kind = undefined;
        if (p.goal === "loseFat" || p.goal === "buildEndurance") {
          if (strengthNumber % 2 === 0) kind = "cardio";
        } else if (p.daysPerWeek === 6) {
          kind = (wid === "legs" || wid === "legsB") ? "cardio" : "core";
        }
        if (kind !== undefined) {
          var cands = kind === "cardio" ? cardioFinishers(p.equipment)
            : ((wid === "push" || wid === "pushB") ? CORE_PUSH_FINISHERS : CORE_PULL_FINISHERS);
          var f = undefined;
          for (var ci = 0; ci < cands.length; ci++) if (bases.indexOf(cands[ci]) < 0) { f = cands[ci]; break; }
          if (f !== undefined) {
            bases.push(f);
            slotRoles.push("finisher");
            minutes.push(kind === "cardio" ? finisherMinutes(p.sessionMinutes) : undefined);
          }
        }
        strengthNumber += 1;
      }
      workouts.push({ id: wid, title: title, focus: tp.focus, slots: applyPreferences(bases, slotRoles, minutes, p, prefs) });
    }
    var cardioPick = pick(template("cardio").slots[0], p.equipment);
    workouts.push({
      id: "cardio", title: "Cardio", focus: "cardio",
      slots: applyPreferences([cardioPick], ["cardio"], [undefined], p, prefs),
    });
    var rec = template("recovery");
    workouts.push({
      id: "recovery", title: "Active recovery", focus: "recovery",
      slots: applyPreferences(rec.slots.map(function (sl) { return pick(sl, p.equipment); }), ["recovery", "recovery"], [15, 5], p, prefs),
    });
    return { cycle: cycle, rotation: rotation, workouts: workouts };
  }

  function applyPreferences(bases, roles, minutes, p, prefs) {
    // Pass 1: every slot takes its preference when the move fits. Pass 2: a swapped slot that now holds
    // the same move as another slot goes back to its base when the other slot is at its base or comes
    // earlier; repeat until nothing changes. Chained swaps (A to B while B's slot goes to C) survive.
    var ids = bases.slice();
    var j = 0;
    for (j = 0; j < bases.length; j++) {
      var pref = prefs.get(bases[j]);
      if (pref === undefined) continue;
      var e = exercise(pref);
      if (e && fitsEq(e, p.equipment)) ids[j] = pref;
    }
    var changed = true;
    while (changed) {
      changed = false;
      for (j = 0; j < ids.length; j++) {
        if (ids[j] === bases[j]) continue;
        var clash = false;
        for (var k = 0; k < ids.length; k++) {
          if (k !== j && ids[k] === ids[j] && (ids[k] === bases[k] || k < j)) clash = true;
        }
        if (clash) {
          ids[j] = bases[j];
          changed = true;
        }
      }
    }
    var out = [];
    for (var i = 0; i < bases.length; i++) out.push({ role: roles[i], exerciseId: ids[i], baseExerciseId: bases[i], minutes: minutes[i] });
    return out;
  }

  // ---- Starting points (6.7) ----

  function calCount(x, workouts, rotation) {
    var n = 0;
    for (var i = 0; i < workouts.length; i++) {
      var w = workouts[i];
      if (rotation.indexOf(w.id) < 0) continue;
      if (w.slots.some(function (s) { return s.exerciseId === x; })) n += 1;
    }
    return clampInt(n, 1, 2);
  }

  function seedFor(x, p) {
    for (var i = 0; i < p.anchors.length; i++) {
      var a = p.anchors[i];
      var seeds = seedsOfAnchor(a.exerciseId);
      for (var j = 0; j < seeds.length; j++) if (seeds[j][0] === x) return { anchor: a, percent: seeds[j][1] };
    }
    return undefined;
  }

  function scaledWeight(e, wp, r, lo) {
    var r1 = Math.min(r, 12);
    var f = r1 === 1 ? 30 : 30 + r1;
    var raw = div(wp * f * 9, 10 * (30 + lo));
    return Math.max(e.minWeight, snapDown(e, Math.min(raw, wp)));
  }

  function freshLiftFor(e, goal, experience, seed, cal) {
    var l = newLift();
    var start = e.start.length === 0 ? 0 : e.start[expIndex(experience)];
    switch (e.logType) {
      case "weightReps": {
        var lo = libRepRange(goal, experience, e.cls, e.equipment === "barbell").lo;
        l.graceLeft = 0;
        l.reps = lo;
        if (seed) {
          var raw = div(seed.weight * seed.percent, 100);
          // A typed anchor above 4 times the experienced start (a bench over 380 lb) is treated as a likely
          // typo: it starts from that cap and calibrates instead.
          var plausible = 4 * (e.start.length === 3 ? e.start[2] : e.maxWeight);
          var wp = Math.min(raw, plausible);
          if (wp < e.minWeight) {
            l.weight = e.minWeight;
            l.calibrationLeft = cal;
          } else {
            l.weight = scaledWeight(e, wp, seed.reps, lo);
            l.calibrationLeft = raw > plausible ? cal : 0;
          }
        } else {
          l.weight = start;
          l.calibrationLeft = cal;
        }
        break;
      }
      case "reps": {
        var cap = repsCap(goal);
        if (seed) {
          l.reps = clampInt(div(seed.reps * 7, 10), 1, cap);
          l.calibrationLeft = 0;
        } else {
          l.reps = Math.min(start, cap);
          l.calibrationLeft = cal;
        }
        break;
      }
      case "seconds":
        l.seconds = Math.min(start, secondsCap(goal));
        l.calibrationLeft = cal;
        break;
      default:
        break;
    }
    return l;
  }

  function freshLift(x, p, workouts, rotation) {
    var e = exercise(x);
    var sd = seedFor(x, p);
    var seed = sd ? { weight: sd.anchor.weight, reps: sd.anchor.reps, percent: sd.percent } : undefined;
    return freshLiftFor(e, p.goal, p.experience, seed, calCount(x, workouts, rotation));
  }

  function freshCardio(context, p) {
    return { minutes: Math.min(cardioStart(p.experience), cardioCap(context, p)), missStreak: 0, lastIncreaseWeek: undefined, lastDay: undefined };
  }

  function contextOf(wid) { return wid === "cardio" ? "cardioDay" : (wid === "coreCardio" ? "coreCardio" : undefined); }

  // ---- Ensure (8.2); s is an operation's own copy ----

  function ensureLift(s, x) {
    var e = exercise(x);
    if (!e || isCardioEx(e) || !s.profile || !s.plan) return;
    var l = s.lifts.get(x);
    if (l && l.sessions > 0) return;
    s.lifts.set(x, freshLift(x, s.profile, s.plan.workouts, s.plan.rotation));
  }

  function ensureCardio(s, context, x) {
    if (!s.profile) return;
    var key = context + ":" + x;
    if (!s.cardio.has(key)) s.cardio.set(key, freshCardio(context, s.profile));
  }

  // ---- Effective states (12.5) ----

  /** 1 for a break of 21 to 34 days, 2 for 35 days or more, undefined for a shorter gap. Missing one
   * session of a once-a-week workout (a 14-day gap) is not a break. */
  function breakLevel(gap) { return gap < 21 ? undefined : (gap < 35 ? 1 : 2); }

  /** A count target after a break: about 10 percent lower (level 1) or 20 percent (level 2), at least one
   * unit, never below the smaller of the old target and the comeback floor. */
  function comebackCount(t, c, n) {
    return Math.max(Math.max(c.minValue, Math.min(t, c.comebackFloor)), t - countCut(c, t, n === 1 ? 10 : 20));
  }

  function effLift(ctx, x, d, role) {
    var p = ctx.profile;
    var plan = ctx.plan;
    var e = exercise(x);
    var stored = ctx.state.lifts.get(x) || freshLift(x, p, plan.workouts, plan.rotation);
    var ldn = stored.lastDay === undefined ? undefined : dayNumber(stored.lastDay);
    if (!(stored.sessions > 0) || ldn === undefined) return { lift: stored, changed: false };
    var gap = d - ldn;
    var n = breakLevel(gap);
    if (n === undefined) return { lift: stored, changed: false };
    var l = copyObj(stored);
    switch (e.logType) {
      case "weightReps": {
        var w = stored.weight;
        // On a light weight where one step is more than 10 percent, a shorter break keeps the weight and
        // resets the reps; a longer one goes down one step (deload). Otherwise about 10 or 20 percent.
        var nw = bigStep(e, w) ? (n === 1 ? w : deload(e, w)) : (n === 1 ? deload(e, w) : calDown(e, w));
        l.weight = nw;
        l.reps = Math.min(repRange(e, p).lo, stored.reps);
        var rb = Math.max(stored.rebuildTo === undefined ? 0 : stored.rebuildTo, w);
        l.rebuildTo = rb > nw ? rb : undefined;
        l.graceLeft = 0;
        break;
      }
      case "reps":
        l.reps = comebackCount(stored.reps, REPS_CONSTANTS, n);
        break;
      case "seconds":
        l.seconds = comebackCount(stored.seconds, SECONDS_CONSTANTS, n);
        break;
      default:
        break;
    }
    l.extraSets = 0;
    l.missStreak = 0;
    l.sessionsAtTarget = 0;
    var changed = undefined;
    switch (e.logType) {
      case "weightReps": changed = l.weight !== stored.weight || l.reps !== stored.reps; break;
      case "reps": changed = l.reps !== stored.reps || targetSets(p, l, role) !== targetSets(p, stored, role); break;
      case "seconds": changed = l.seconds !== stored.seconds || targetSets(p, l, role) !== targetSets(p, stored, role); break;
      default: changed = false;
    }
    return { lift: l, changed: changed };
  }

  function effCardio(ctx, key, context, d) {
    var stored = ctx.state.cardio.get(key) || freshCardio(context, ctx.profile);
    var ldn = stored.lastDay === undefined ? undefined : dayNumber(stored.lastDay);
    if (ldn === undefined) return { cardio: stored, changed: false };
    var gap = d - ldn;
    var n = breakLevel(gap);
    if (n === undefined) return { cardio: stored, changed: false };
    var c = copyObj(stored);
    c.minutes = Math.max(10, stored.minutes - n * cardioStep(stored.minutes));
    c.missStreak = 0;
    return { cardio: c, changed: c.minutes !== stored.minutes };
  }

  // ---- Sets, rest and time (6.3, 6.4, 6.9) ----

  function targetSets(p, l, role) {
    if (p.experience === "new" && l.calibrationLeft > 0) return 2;
    return Math.min(5, baseSets(role, p.sessionMinutes) + l.extraSets);
  }

  function restSeconds(p, role, e) {
    if (role === "cardio" || role === "recovery" || isCardioEx(e)) return 0;
    if (role === "finisher" && isCountEx(e)) return 30;
    var t = restTable(p.goal);
    var v = undefined;
    if (role === "main") {
      v = t.main;
      if (p.sessionMinutes === 30) v = Math.min(v, 120);
    } else if (role === "secondary") {
      v = t.secondary;
      if (p.sessionMinutes === 30) v = Math.min(v, 90);
    } else {
      v = t.accessory;
      if (p.sessionMinutes === 30) v = Math.min(v, 60);
    }
    if (isCountEx(e)) v = Math.min(v, 60);
    // A heavy barbell hinge (deadlift, Romanian deadlift) always gets at least 2 minutes to reset form.
    if (e.pattern === "hinge" && e.equipment === "barbell") v = Math.max(v, 120);
    return v;
  }

  function estimatedMinutes(workoutId, items) {
    var i = undefined;
    if (workoutId === "cardio" || workoutId === "recovery") {
      var sum = 0;
      for (i = 0; i < items.length; i++) sum += items[i].target.minutes === undefined ? 0 : items[i].target.minutes;
      return sum;
    }
    var total = 300;
    for (i = 0; i < items.length; i++) {
      if (i > 0) total += 60;
      total += itemSeconds(items[i].ex, items[i].target, items[i].restSeconds);
    }
    return roundHalfUp(total, 60);
  }

  /** Seconds one item adds to the 6.9 estimate (without the 60 s change-over before it). */
  function itemSeconds(e, t, rest) {
    if (isCardioEx(e)) return 60 * (t.minutes === undefined ? 0 : t.minutes);
    var sets = t.sets;
    var work = e.logType === "seconds" ? (t.seconds === undefined ? 0 : t.seconds) * (e.perSide ? 2 : 1) + 15 : (e.perSide ? 70 : 40);
    return sets * work + Math.max(0, sets - 1) * rest;
  }

  function aboutMinutes(est) { return Math.max(5, 5 * roundHalfUp(est, 5)); }

  // ---- Projection (9.1) ----

  function workoutIn(plan, id) {
    for (var i = 0; i < plan.workouts.length; i++) if (plan.workouts[i].id === id) return plan.workouts[i];
    return undefined;
  }

  function todayChoiceOf(plan, today) {
    var c = plan.todayChoice;
    if (!c || dayNumber(c.day) !== today) return undefined;
    return c.choice;
  }

  function projectCtx(ctx) { return project(ctx.plan, ctx.log, ctx.index, ctx.today); }

  function project(plan, log, index, today) {
    var n = plan.queue.length;
    var a = plan.active;
    var aDay = a ? dayNumber(a.day) : undefined;
    var choice = todayChoiceOf(plan, today);
    var k = (a && a.kind === "training" && aDay !== today) ? 1 : 0;
    var start = dayNumber(plan.startDay);
    var cards = [];
    for (var i = 0; i < 7; i++) {
      var d = today + i;
      var base = plan.cycle[floorMod(d - start, 7)];
      var recs = index.recordsOn(d);
      var t = undefined;
      for (var q = 0; q < recs.length; q++) if (log[recs[q]].kind === "training") { t = recs[q]; break; }
      var card = undefined;
      if (i === 0 && a && aDay === today) {
        card = newCard(i, d, a.kind, a.workoutId, a.title, a.focus);
        card.active = true;
        if (a.kind === "training") k += 1;
      } else if (t !== undefined) {
        var r = log[t];
        card = newCard(i, d, "training", r.workoutId, r.title, r.focus);
        card.done = true;
        card.planDone = true;
        card.recordIndex = t;
        card.fromRecord = true;
      } else {
        var kind = (i === 0 && choice !== undefined) ? choice : base;
        var z = undefined;
        if (kind === "training") {
          var wid = plan.queue[k % n];
          k += 1;
          var w = workoutIn(plan, wid);
          card = newCard(i, d, "training", wid, w.title, w.focus);
        } else if (kind === "cardio") {
          card = newCard(i, d, "cardio", "cardio", "Cardio", "cardio");
          for (z = 0; z < recs.length; z++) {
            if (log[recs[z]].kind === "cardio") { card.done = true; card.planDone = true; card.recordIndex = recs[z]; break; }
          }
        } else if (kind === "recovery") {
          card = newCard(i, d, "recovery", "recovery", "Active recovery", "recovery");
          for (z = 0; z < recs.length; z++) {
            if (log[recs[z]].kind === "recovery") { card.done = true; card.planDone = true; card.recordIndex = recs[z]; break; }
          }
        } else {
          card = newCard(i, d, "rest", undefined, "Rest day", "rest");
          if (recs.length > 0) { card.done = true; card.recordIndex = recs[0]; }
          card.planDone = recs.some(function (ix) { return log[ix].kind !== "free"; });
          if (i === 0 && choice === "rest") {
            card.restByChoice = true;
            if (base === "training") card.restMovedWorkout = plan.queue[k % n];
          }
        }
      }
      if (i === 0) card.choice = choice;
      cards.push(card);
    }
    return cards;
  }

  // ---- Safety (9.5) ----

  function safety(plan, log, index, today) {
    var cards = project(plan, log, index, today);
    var training = [];
    var heavy = [];
    var fixed = [];
    for (var z = 0; z < 13; z++) { training.push(false); heavy.push(0); fixed.push(false); }
    var a = plan.active;
    var aDay = a ? dayNumber(a.day) : undefined;
    for (var off = -6; off <= 6; off++) {
      var k = off + 6;
      var d = today + off;
      var recs = index.recordsOn(d);
      for (var q = 0; q < recs.length; q++) {
        var r = log[recs[q]];
        if (r.kind !== "training") continue;
        training[k] = true;
        heavy[k] |= heavyMask(r.focus);
      }
      if (off < 0) {
        if (a && a.kind === "training" && aDay === d) {
          training[k] = true;
          heavy[k] |= heavyMask(a.focus);
        }
        fixed[k] = true;
      } else {
        var c = cards[off];
        training[k] = c.kind === "training";
        if (c.kind === "training" && !c.done) heavy[k] |= heavyMask(c.focus);
        fixed[k] = c.done || c.active;
      }
    }
    var windowOK = true;
    for (var kk = 5; kk <= 11; kk++) {
      if (!(fixed[kk] && fixed[kk + 1]) && (heavy[kk] & heavy[kk + 1]) !== 0) windowOK = false;
    }
    var queueOK = true;
    var adjacent = false;
    for (var p = 0; p < 7; p++) if (plan.cycle[p] === "training" && plan.cycle[(p + 1) % 7] === "training") adjacent = true;
    if (adjacent) {
      var n = plan.queue.length;
      for (var i = 0; i < n; i++) {
        var w1 = workoutIn(plan, plan.queue[i]);
        var w2 = workoutIn(plan, plan.queue[(i + 1) % n]);
        var f1 = w1 ? w1.focus : "rest";
        var f2 = w2 ? w2.focus : "rest";
        if ((heavyMask(f1) & heavyMask(f2)) !== 0) queueOK = false;
      }
    }
    var restOK = true;
    for (var s = 0; s <= 6; s++) {
      var all = true;
      var allFixed = true;
      for (var j = s; j <= s + 6; j++) {
        if (!training[j]) all = false;
        if (!fixed[j]) allFixed = false;
      }
      if (all && !allFixed) restOK = false;
    }
    var error = undefined;
    if (!windowOK || !queueOK) error = "backToBack";
    else if (!restOK) error = "needRest";
    return { window: windowOK, queue: queueOK, rest: restOK, safe: windowOK && queueOK && restOK, error: error };
  }

  function safetyCtx(ctx) { return safety(ctx.plan, ctx.log, ctx.index, ctx.today); }

  // ---- Planned items (9.4) ----

  function exerciseIds(ctx, w, i, active) {
    if (active) return active.items.map(function (it) { return it.exerciseId; });
    var xs = w.slots.map(function (s) { return s.exerciseId; });
    var ts = ctx.plan.todaySwaps;
    if (i === 0 && ts && dayNumber(ts.day) === ctx.today) {
      for (var k = 0; k < ts.swaps.length; k++) {
        var sw = ts.swaps[k];
        if (sw.workoutId === w.id && sw.slot >= 0 && sw.slot < xs.length) xs[sw.slot] = sw.exerciseId;
      }
    }
    return xs;
  }

  function mkTarget(sets, o) {
    return {
      sets: sets, weight: o.weight, reps: o.reps, seconds: o.seconds, minutes: o.minutes,
    };
  }

  /** The 9.4 target of exercise x in slot s of workout w on day d: {target, lift, changed}. */
  function plannedTarget(ctx, w, s, x, d) {
    var e = exercise(x);
    var slot = w.slots[s];
    if (isCardioEx(e)) {
      var c = contextOf(w.id);
      if (slot.role === "cardio" && c !== undefined) {
        var ec = effCardio(ctx, c + ":" + x, c, d);
        return { target: mkTarget(1, { minutes: ec.cardio.minutes }), lift: undefined, changed: ec.changed };
      }
      return { target: mkTarget(1, { minutes: slot.minutes === undefined ? 0 : slot.minutes }), lift: undefined, changed: false };
    }
    var el = effLift(ctx, x, d, slot.role);
    var l = el.lift;
    var sets = targetSets(ctx.profile, l, slot.role);
    var t = undefined;
    switch (e.logType) {
      case "weightReps": t = mkTarget(sets, { weight: l.weight, reps: l.reps }); break;
      case "reps": t = mkTarget(sets, { reps: l.reps }); break;
      case "seconds": t = mkTarget(sets, { seconds: l.seconds }); break;
      default: t = mkTarget(1, {});
    }
    return { target: t, lift: l, changed: el.changed };
  }

  function planItems(ctx, w, i, d, active, full) {
    var p = ctx.profile;
    var xs = exerciseIds(ctx, w, i, active);
    var out = [];
    for (var s = 0; s < w.slots.length; s++) {
      var slot = w.slots[s];
      var x = xs[s];
      var e = exercise(x);
      var pt = plannedTarget(ctx, w, s, x, d);
      var target = active ? active.items[s].target : pt.target;
      var it = {
        slot: s, exerciseId: x, ex: e, role: slot.role, target: target, restSeconds: restSeconds(p, slot.role, e),
        calibrating: (pt.lift ? pt.lift.calibrationLeft : 0) > 0, range: isWeightedEx(e) ? repRange(e, p) : undefined,
        notes: [], last: undefined, alternatives: [], change: undefined, fromNumbers: false,
      };
      if (full) {
        it.alternatives = slotOptions(ctx, w, s, xs, pt.lift);
        if (pt.changed) it.notes.push(text("comebackNote"));
        if (isWeightedEx(e) && it.calibrating) it.notes.push(text("calibrationNote"));
        var seen = 0;
        var skippedBoth = true;
        var last = undefined;
        var nf = ctx.index.newestFirst;
        for (var q = 0; q < nf.length; q++) {
          var r = nf[q];
          if (ctx.index.dayNumbers[r] > ctx.today) continue;
          var hist = historyItems(ctx.log[r]);
          var item = undefined;
          for (var z = 0; z < hist.length; z++) if (hist[z].exerciseId === x) { item = hist[z]; break; }
          if (!item) continue;
          if (seen < 2) {
            if (!item.skipped) skippedBoth = false;
            seen += 1;
          }
          if (last === undefined && !item.skipped && !isCardioEx(e)) last = { day: ctx.log[r].day, sets: item.sets };
          if (seen >= 2 && (last !== undefined || isCardioEx(e))) break;
        }
        if (seen === 2 && skippedBoth && it.alternatives.length > 0) it.notes.push(text("skippedTwiceNote"));
        if (last !== undefined) it.last = last;
        it.change = plannedChange(ctx, w, s, e, target);
        var pl = pt.lift;
        if (pl && (e.logType === "weightReps" || e.logType === "reps") && pl.sessions === 0 && pl.calibrationLeft === 0 &&
            seedFor(x, p) !== undefined) {
          it.fromNumbers = true;
        }
      }
      out.push(it);
    }
    return out;
  }

  /**
   * B2 (9.4 change): the newest counted record with a non-skipped item of this move (same logType; for a
   * cardio move also the same role, and for the main cardio block the same context) gives the target
   * planned that time; it is compared with today's target. Undefined when no such record exists.
   */
  function plannedChange(ctx, w, s, e, target) {
    var role = w.slots[s].role;
    var here = contextOf(w.id);
    var nf = ctx.index.newestFirst;
    for (var q = 0; q < nf.length; q++) {
      var r = nf[q];
      if (ctx.index.dayNumbers[r] > ctx.today) continue;
      var rec = ctx.log[r];
      var item = undefined;
      for (var z = 0; z < rec.items.length; z++) {
        var it = rec.items[z];
        if (it.exerciseId !== e.id || it.skipped || it.logType !== e.logType) continue;
        if (isCardioEx(e)) {
          if (it.role !== role) continue;
          if (role === "cardio" && contextOf(rec.workoutId === undefined ? "" : rec.workoutId) !== here) continue;
        }
        item = it;
        break;
      }
      if (!item) continue;
      var ct = changeTag(target, item.target, e.logType, item.role === role);
      return { direction: ct.direction, tag: ct.tag, previous: item.target };
    }
    return undefined;
  }

  /**
   * Compares two targets of one move: weight, then sets (only when compareSets), then reps, seconds or
   * minutes. The first that differs gives the direction and the tag ("5 lb", "1 set", "2 reps", "10 sec",
   * "3 min"); when none differs the direction is same and the tag "Same".
   */
  function changeTag(now, was, lt, compareSets) {
    var parts = [];
    if (lt === "weightReps") parts.push([now.weight, was.weight, function (n) { return fmt(n) + " lb"; }]);
    if (lt !== "cardio" && compareSets) parts.push([now.sets, was.sets, function (n) { return fmt(n) + " " + setWord(n); }]);
    if (lt === "weightReps" || lt === "reps") parts.push([now.reps, was.reps, function (n) { return fmt(n) + " " + repWord(n); }]);
    else if (lt === "seconds") parts.push([now.seconds, was.seconds, function (n) { return fmt(n) + " sec"; }]);
    else parts.push([now.minutes, was.minutes, function (n) { return fmt(n) + " min"; }]);
    for (var i = 0; i < parts.length; i++) {
      var a = parts[i][0];
      var b = parts[i][1];
      if (a === undefined || b === undefined || a === b) continue;
      return { direction: a > b ? "up" : "down", tag: parts[i][2](a > b ? a - b : b - a) };
    }
    return { direction: "same", tag: "Same" };
  }

  /** The slot options (swap list) of 9.4. */
  function slotOptions(ctx, w, s, xs, lift) {
    var p = ctx.profile;
    var slot = w.slots[s];
    if (slot.role === "recovery") return [];
    var x = xs[s];
    var e = exercise(x);
    var base = slot.baseExerciseId;
    var fam = family(base);
    var cands = [];
    if (isCountEx(e) && lift && e.harder !== undefined) {
      var h = e.harder;
      var t = e.logType === "reps" ? (lift.reps === undefined ? 0 : lift.reps) : (lift.seconds === undefined ? 0 : lift.seconds);
      var cap = e.logType === "reps" ? repsCap(p.goal) : secondsCap(p.goal);
      var maxed = t >= cap && (lift.extraSets >= maxExtraFor(p.sessionMinutes) || targetSets(p, lift, slot.role) + 1 > 5);
      if (maxed && (h === base || fam.indexOf(h) >= 0)) cands.push(h);
    }
    cands.push(slot.exerciseId);
    cands.push(base);
    for (var f = 0; f < fam.length; f++) cands.push(fam[f]);
    var exclude = new Set();
    for (var k = 0; k < xs.length; k++) if (k !== s) exclude.add(xs[k]);
    for (var k2 = 0; k2 < w.slots.length; k2++) if (k2 !== s) exclude.add(w.slots[k2].exerciseId);
    var out = [];
    for (var c = 0; c < cands.length; c++) {
      var id = cands[c];
      var ce = exercise(id);
      if (!ce || !fitsEq(ce, p.equipment)) continue;
      if (out.indexOf(id) >= 0 || exclude.has(id) || id === x) continue;
      out.push(id);
      if (out.length === 6) break;
    }
    return out;
  }

  // ---- Card and session output (9.2, 9.3) ----

  function cardWorkout(ctx, c) {
    if (c.workoutId === undefined || c.done || c.kind === "rest") return undefined;
    return workoutIn(ctx.plan, c.workoutId);
  }

  function cardActive(ctx, c) { return c.active ? ctx.plan.active : undefined; }

  function cardDescription(c) { return c.restByChoice ? text("restChosen") : describeFocus(c.focus); }

  function cardJSON(ctx, c) {
    var p = ctx.profile;
    var wi = weekdayIndex(c.dn);
    var o = {
      day: dayKey(c.dn), weekday: WEEKDAY_NAMES[wi], weekdayShort: WEEKDAY_SHORT[wi], isToday: c.i === 0, kind: c.kind,
      focus: c.focus, title: c.title, description: cardDescription(c), done: c.done, planDone: c.planDone, active: c.active,
    };
    if (c.workoutId !== undefined) o.workoutId = c.workoutId;
    if (c.choice !== undefined) o.choice = c.choice;
    var items = [];
    var w = cardWorkout(ctx, c);
    if (w) items = planItems(ctx, w, c.i, c.dn, cardActive(ctx, c), false);
    var count = undefined;
    var minutes = undefined;
    switch (c.kind) {
      case "training":
        count = c.fromRecord ? ctx.log[c.recordIndex].items.length : items.length;
        minutes = p.sessionMinutes;
        break;
      case "cardio":
        count = 1;
        minutes = (items.length > 0 && items[0].target.minutes !== undefined) ? items[0].target.minutes : 0;
        break;
      case "recovery":
        count = 2;
        minutes = 20;
        break;
      default:
        count = 0;
        minutes = 0;
    }
    var about = undefined;
    if (items.length > 0) about = aboutMinutes(estimatedMinutes(c.workoutId, items));
    if (c.recordIndex !== undefined) o.recordId = ctx.log[c.recordIndex].id;
    if (c.done && c.recordIndex !== undefined) minutes = ctx.log[c.recordIndex].durationMinutes;
    if (about !== undefined && !c.done) o.aboutMinutes = about;
    o.exerciseCount = count;
    o.minutes = minutes;
    var summary = undefined;
    if (c.done && c.recordIndex !== undefined) {
      summary = "Done" + SUMMARY_SEP + doneText(ctx.log[c.recordIndex]);
    } else if (c.active) {
      summary = "In progress" + SUMMARY_SEP + fmt(count) + " " + exWord(count);
    } else {
      switch (c.kind) {
        case "training":
          summary = fmt(count) + " " + exWord(count) + SUMMARY_SEP + "about " + fmt(about === undefined ? 5 : about) + " min";
          break;
        case "cardio":
          summary = (items.length > 0 ? items[0].ex.name : "Cardio") + SUMMARY_SEP + fmt(minutes) + " min";
          break;
        case "recovery": {
          var rw = workoutIn(ctx.plan, "recovery");
          var sum = 0;
          for (var z = 0; z < rw.slots.length; z++) sum += rw.slots[z].minutes === undefined ? 0 : rw.slots[z].minutes;
          summary = "Easy walk and stretching" + SUMMARY_SEP + fmt(sum) + " min";
          break;
        }
        default: {
          var mw = c.restMovedWorkout === undefined ? undefined : workoutIn(ctx.plan, c.restMovedWorkout);
          summary = mw ? mw.title + " moves to your next training day" : "Optional: a 10-minute easy walk";
        }
      }
    }
    o.summary = summary;
    return o;
  }

  function itemJSON(it) {
    var e = it.ex;
    var o = {
      slot: it.slot, exerciseId: it.exerciseId, name: e.name, logType: e.logType, role: it.role, muscle: e.muscle,
      equipment: e.equipment, perHand: e.perHand, perSide: e.perSide, muscleLabel: MUSCLE_LABELS.get(e.muscle),
      target: encTarget(it.target), restSeconds: it.restSeconds, calibrating: it.calibrating, notes: it.notes.slice(),
      text: targetText(it.target, e.logType, e),
      alternatives: it.alternatives.map(function (id) { return { exerciseId: id, name: exercise(id).name }; }),
    };
    if (e.hint !== undefined) o.hint = e.hint;
    if (isWeightedEx(e) && it.range) {
      o.repsLow = it.range.lo;
      o.repsHigh = it.range.hi;
      o.weightStep = e.step;
      o.minWeight = e.minWeight;
      o.maxWeight = e.maxWeight;
    }
    if (it.last !== undefined) o.last = { day: it.last.day, sets: it.last.sets.map(encSet) };
    if (it.change !== undefined) {
      o.change = { direction: it.change.direction, tag: it.change.tag, previous: encTarget(it.change.previous) };
    }
    o.fromNumbers = it.fromNumbers;
    return o;
  }

  /** buildSession (9.3) for a card; activeOverride is the open session shown on its own day. */
  function sessionJSON(ctx, c, activeOverride) {
    var p = ctx.profile;
    var o = {
      day: dayKey(c.dn), kind: c.kind, focus: c.focus, title: c.title, description: cardDescription(c), done: c.done,
      planDone: c.planDone, active: c.active,
    };
    if (c.workoutId !== undefined) o.workoutId = c.workoutId;
    if (c.recordIndex !== undefined) o.recordId = ctx.log[c.recordIndex].id;
    var items = [];
    if (c.workoutId !== undefined && !c.done && c.kind !== "rest") {
      var w = workoutIn(ctx.plan, c.workoutId);
      if (w) {
        var a = activeOverride || cardActive(ctx, c);
        items = planItems(ctx, w, activeOverride ? -1 : c.i, c.dn, a, true);
      }
    }
    var minutes = undefined;
    switch (c.kind) {
      case "training": minutes = p.sessionMinutes; break;
      case "cardio": minutes = (items.length > 0 && items[0].target.minutes !== undefined) ? items[0].target.minutes : 0; break;
      case "recovery": minutes = 20; break;
      default: minutes = 0;
    }
    if (c.done && c.recordIndex !== undefined) minutes = ctx.log[c.recordIndex].durationMinutes;
    o.minutes = minutes;
    if (items.length > 0) {
      var est = estimatedMinutes(c.workoutId, items);
      o.estimatedMinutes = est;
      o.aboutMinutes = aboutMinutes(est);
    }
    var tips = [];
    if (!c.done) {
      switch (c.kind) {
        case "training": tips = [text("tipTraining"), text("tipStop")]; break;
        case "cardio": tips = [text("tipCardio")]; break;
        case "recovery": tips = [text("tipRecovery")]; break;
        default: tips = [];
      }
    }
    o.tips = tips;
    if (c.kind === "rest" && !c.done) o.optional = text("restOptional");
    o.items = items.map(itemJSON);
    return o;
  }

  function activeCard(ctx) {
    var a = ctx.plan.active;
    if (!a) return undefined;
    var d = dayNumber(a.day);
    if (d === undefined) return undefined;
    var c = newCard(d === ctx.today ? 0 : -1, d, a.kind, a.workoutId, a.title, a.focus);
    c.active = true;
    return c;
  }

  function activeSessionJSON(ctx) {
    var c = activeCard(ctx);
    if (!c) return undefined;
    return sessionJSON(ctx, c, ctx.plan.active);
  }

  // ---- Today's actions (9.6) ----

  function withChoice(plan, choice, today) {
    var p = copyObj(plan);
    p.todayChoice = { day: dayKey(today), choice: choice };
    return p;
  }

  function swapped(plan, pIndex) {
    var p = copyObj(plan);
    var q = plan.queue.slice();
    var tmp = q[0];
    q[0] = q[pIndex];
    q[pIndex] = tmp;
    p.queue = q;
    return p;
  }

  function canUndoLast(ctx) {
    if (ctx.state.plan && ctx.state.plan.active) return false;
    var u = ctx.state.undo;
    if (!u) return false;
    if (ctx.log.length === 0) return false;
    var newest = 0;
    for (var i = 1; i < ctx.log.length; i++) if (ctx.index.numbers[newest] < ctx.index.numbers[i]) newest = i;
    if (ctx.log[newest].id !== u.recordId) return false;
    var d = u.day !== undefined ? dayNumber(u.day) : ctx.index.dayNumbers[newest];
    return d === ctx.today || d === ctx.today - 1;
  }

  function todayActionsJSON(ctx, cards) {
    var plan = ctx.plan;
    var c0 = cards[0];
    var open = !c0.planDone && !plan.active;
    var kind = c0.kind;
    var canStart = kind !== "rest" && open;
    var canUndoChoice = todayChoiceOf(plan, ctx.today) !== undefined && open;
    var canTrain = false;
    var trainNote = undefined;
    if ((kind === "rest" || kind === "cardio" || kind === "recovery") && open) {
      var sf = safety(withChoice(plan, "training", ctx.today), ctx.log, ctx.index, ctx.today);
      canTrain = sf.safe;
      if (!canTrain) trainNote = sf.error === "needRest" ? text("restNote") : text("trainNote");
    }
    var canDoCardio = (kind === "rest" || kind === "recovery") && open;
    var choices = [];
    if (kind === "training" && open) {
      for (var pIndex = 1; pIndex < plan.queue.length; pIndex++) {
        var q = swapped(plan, pIndex);
        if (safety(q, ctx.log, ctx.index, ctx.today).safe) {
          var w = workoutIn(plan, plan.queue[pIndex]);
          choices.push({ workoutId: w.id, title: w.title, focus: w.focus });
        }
      }
    }
    var o = {
      canStart: canStart, canTakeRest: canStart, canUndoChoice: canUndoChoice, canTrain: canTrain, canDoCardio: canDoCardio,
      swapChoices: choices, canUndoLast: canUndoLast(ctx),
    };
    if (trainNote !== undefined) o.trainNote = trainNote;
    return o;
  }

  // ---- Week (16.3) ----

  function weekJSON(ctx) {
    var plan = ctx.state.plan;
    var p = ctx.state.profile;
    if (!plan || !p) {
      var o0 = { ok: true, hasPlan: false, hasProfile: p !== undefined, today: dayKey(ctx.today), days: [] };
      if (p) o0.profile = encProfile(p);
      return o0;
    }
    var cards = projectCtx(ctx);
    var o = {
      ok: true, hasPlan: true, hasProfile: true, profile: encProfile(p), today: dayKey(ctx.today),
      days: cards.map(function (c) { return cardJSON(ctx, c); }), todayActions: todayActionsJSON(ctx, cards),
      thisWeek: thisWeekJSON(ctx, plan), weeksOnPlan: weeksOnPlan(ctx),
    };
    if (p.experience === "new" && p.daysPerWeek >= 5) o.planNote = text("planNote");
    return o;
  }

  function weekMember(ctx) {
    var o = weekJSON(ctx);
    delete o.ok;
    return o;
  }

  // ---- buildPlan (8) ----

  function buildPlan(state, p, today) {
    var built = buildWorkouts(p, state.swaps);
    var s = copyModel(state);
    var old = state.plan;
    s.profile = p;
    s.plan = {
      startDay: dayKey(today), builtDay: dayKey(today), cycle: built.cycle, workouts: built.workouts,
      rotation: built.rotation, queue: built.rotation.slice(), todayChoice: undefined, todaySwaps: undefined, active: undefined,
    };
    var keys = sortedKeys(s.lifts);
    var i = undefined;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var l0 = s.lifts.get(key);
      var e = exercise(key);
      if (!l0 || !(l0.sessions > 0) || !e) continue;
      var l = copyObj(l0);
      switch (e.logType) {
        case "weightReps": {
          var r = repRange(e, p);
          if (l.weight <= e.minWeight) {
            // Already at the lightest weight: keep building the reps up toward lo.
            l.reps = clampInt(l.reps, 1, r.hi);
          } else if (l.reps < r.lo) {
            l.weight = scaledWeight(e, l.weight, l.reps, r.lo);
            l.reps = r.lo;
            l.missStreak = 0;
            l.sessionsAtTarget = 0;
            l.graceLeft = 0;
            l.rebuildTo = undefined;
          } else {
            l.reps = clampInt(l.reps, r.lo, r.hi);
          }
          break;
        }
        case "reps": l.reps = clampInt(l.reps, 1, repsCap(p.goal)); break;
        case "seconds": l.seconds = clampInt(l.seconds, 10, secondsCap(p.goal)); break;
        default: break;
      }
      l.extraSets = clampInt(l.extraSets, 0, maxExtraFor(p.sessionMinutes));
      s.lifts.set(key, l);
    }
    var w = undefined, j = undefined;
    for (i = 0; i < built.workouts.length; i++) {
      w = built.workouts[i];
      for (j = 0; j < w.slots.length; j++) {
        var se = exercise(w.slots[j].exerciseId);
        if (se && !isCardioEx(se)) ensureLift(s, w.slots[j].exerciseId);
      }
    }
    for (i = 0; i < built.workouts.length; i++) {
      w = built.workouts[i];
      var c = contextOf(w.id);
      if (c === undefined) continue;
      for (j = 0; j < w.slots.length; j++) if (w.slots[j].role === "cardio") ensureCardio(s, c, w.slots[j].exerciseId);
    }
    var ckeys = sortedKeys(s.cardio);
    for (i = 0; i < ckeys.length; i++) {
      var cc = cardioContext(ckeys[i]);
      if (cc) s.cardio.set(ckeys[i], clampCardio(s.cardio.get(ckeys[i]), cc.context, p));
    }
    keys = sortedKeys(s.lifts);
    for (i = 0; i < keys.length; i++) {
      var le = exercise(keys[i]);
      if (le) s.lifts.set(keys[i], clampLift(s.lifts.get(keys[i]), le, p));
    }
    // 8.3 start day and queue.
    var rotation = built.rotation;
    var n = rotation.length;
    var candidates = [];
    if (old && arraysEqual(old.rotation, rotation)) {
      var sd = dayNumber(old.startDay);
      if (sd !== undefined) candidates.push({ start: sd, queue: old.queue });
    }
    var i0 = 0;
    if (old && old.queue.length > 0) {
      var idx = rotation.indexOf(old.queue[0]);
      if (idx >= 0) i0 = idx;
    }
    var rotated = function (off) {
      var q = [];
      for (var m = 0; m < n; m++) q.push(rotation[(m + off) % n]);
      return q;
    };
    for (var t = 0; t < 7; t++) {
      for (j = 0; j < n; j++) candidates.push({ start: today + t, queue: rotated(floorMod(i0 + j, n)) });
    }
    var index = new LogIndex(s.log);
    var chosen = { start: today, queue: rotated(i0) };
    for (i = 0; i < candidates.length; i++) {
      var plan = copyObj(s.plan);
      plan.startDay = dayKey(candidates[i].start);
      plan.queue = candidates[i].queue;
      if (safety(plan, s.log, index, today).safe) {
        chosen = candidates[i];
        break;
      }
    }
    s.plan.startDay = dayKey(chosen.start);
    s.plan.queue = chosen.queue.slice();
    s.plan.builtDay = dayKey(today);
    if (s.counters.coachStartDay === undefined) s.counters.coachStartDay = dayKey(chosen.start);
    return s;
  }

  // ---------------------------------------------------------------------------------------------------
  // Progression (spec 12), new personal records (13.4), progress numbers (13.1 to 13.7) and the reason
  // and record texts (14.4, 14.5).
  // ---------------------------------------------------------------------------------------------------

  function uWord(e, n) { return (e.logType === "seconds" ? secWord(n) : repWord(n)) + sideText(e); }

  function easierText(e, p) {
    var ee = e.easier === undefined ? undefined : exercise(e.easier);
    if (ee && fitsEq(ee, p.equipment)) return " Or try an easier move: " + ee.name + ".";
    return " You can swap it for another move.";
  }

  /** What progression decides for one item of a finished session. */
  function progressItem(ctx, w, item, logged, day, allowGrowth) {
    if (allowGrowth === undefined) allowGrowth = true;
    var p = ctx.profile;
    var e = exercise(item.exerciseId);
    var slot = w.slots[item.slot];
    if (logged.skipped) {
      var cal = false;
      if (!isCardioEx(e)) {
        var stored = ctx.state.lifts.get(e.id) || freshLift(e.id, p, ctx.plan.workouts, ctx.plan.rotation);
        cal = stored.calibrationLeft > 0;
      }
      return {
        change: "skipped", code: "SKIPPED", reason: "Skipped today - same target next time.", next: item.target,
        calibrating: cal, warmupSets: 0,
      };
    }
    if (isCardioEx(e)) {
      var c = contextOf(w.id);
      if (slot.role === "cardio" && c !== undefined) return cardioRule(ctx, e, c, logged, day, allowGrowth);
      return {
        change: "fixed", code: "FIXED", reason: "Nice work - same plan next time.",
        next: mkTarget(1, { minutes: slot.minutes !== undefined ? slot.minutes : item.target.minutes }), calibrating: false,
        warmupSets: 0,
      };
    }
    var l = effLift(ctx, e.id, day, slot.role).lift;
    if (isWeightedEx(e)) return weightedRule(ctx, e, slot.role, l, item.target.sets, logged, day, allowGrowth);
    return countRule(ctx, e, slot.role, l, item.target.sets, logged, day, allowGrowth);
  }

  /** Codes that make the next session longer and that the time budget may refuse (12.6). */
  function addsTime(code, e) {
    if (code === "ADD_SET" || code === "C_ADD_SET" || code === "CA_UP") return true;
    if (code === "C_UP" || code === "C_UP_EASY") return e.logType === "seconds";
    return false;
  }

  function tupleCompare(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return 0;
  }

  function minOf(a) { var m = a[0]; for (var i = 1; i < a.length; i++) if (a[i] < m) m = a[i]; return m; }
  function maxOf(a) { var m = a[0]; for (var i = 1; i < a.length; i++) if (a[i] > m) m = a[i]; return m; }

  function weightedRule(ctx, e, role, l, pSets, logged, day, allowGrowth) {
    if (allowGrowth === undefined) allowGrowth = true;
    var p = ctx.profile;
    var rr = repRange(e, p);
    var lo = rr.lo;
    var hi = rr.hi;
    var step = e.step;
    var minW = e.minWeight;
    var lw = l.weight;
    var lr = l.reps;
    var x = l.extraSets;
    var a = l.sessionsAtTarget;
    var g = l.graceLeft === undefined ? 0 : l.graceLeft;
    var r = l.rebuildTo;
    var m0 = l.missStreak;
    var k = l.calibrationLeft;
    var f = logged.feel;
    var sets = logged.sets;
    var maxExtra = maxExtraFor(p.sessionMinutes);
    var newW = lw;
    var newR = lr;
    var code = "";
    var base = lw;
    var ms = 0;
    var warm = 0;
    var fromRows = false;
    // Every counted set at the planned weight or heavier with at least Lr reps (normal mode, 12.1 step 7).
    var met = false;

    function rowsNormal(nE, minR) {
      var top = nE >= pSets && minR >= hi;
      if (r !== undefined && base < r && nE >= pSets && minR >= lr && f !== "hard" && !bigStep(e, base)) {
        // A top-of-range or easy session closes half the gap (at least easyInc); otherwise one step.
        // After a top-of-range session the reps go back to lo with the heavier weight, as in UP.
        var rinc = (top || f === "easy") ? Math.max(easyInc(e, base), div(r - base, 2)) : step;
        newW = Math.min(r, snapDown(e, base + rinc)); newR = top ? lo : lr; code = "REBUILD";
      } else if (top && f === "hard") {
        newW = base; newR = hi; code = "HARD_HOLD";
      } else if (top && bigStep(e, base) && x < maxExtra && pSets + 1 <= 5 && allowGrowth) {
        newW = base; newR = hi; code = "ADD_SET";
      } else if (top && f === "easy") {
        newW = snapDown(e, base + easyInc(e, base)); newR = lo; code = "UP_EASY";
      } else if (top) {
        newW = snapDown(e, base + step); newR = lo; code = "UP";
      } else if (nE < pSets && minR >= hi) {
        newW = base; newR = hi; code = "FINISH_SETS";
      } else if (nE >= pSets && minR >= lr && f === "hard") {
        newW = base; newR = Math.min(hi, minR); code = "REPS_HARD";
      } else if (nE >= pSets && minR >= lr && f === "easy") {
        newW = base; newR = Math.min(hi, minR + 2); code = "REPS_UP";
      } else if (nE >= pSets && minR >= lr) {
        newW = base; newR = Math.min(hi, minR + 1); code = "REPS_UP";
      } else {
        newW = base; newR = Math.max(lo, Math.min(hi, lr)); code = "REPS_HOLD";
      }
    }

    function rowsCalibration(nE, minR) {
      var top = nE >= pSets && minR >= hi;
      if (top && f === "hard") {
        newW = base; newR = hi; code = "HARD_HOLD";
      } else if (nE >= pSets && minR >= lr && f === "easy") {
        newW = snapDown(e, base + calInc(e, base)); newR = lo; code = "CAL_UP";
      } else if (top) {
        newW = snapDown(e, base + step); newR = lo; code = "UP";
      } else if (nE < pSets && minR >= hi) {
        newW = base; newR = hi; code = "FINISH_SETS";
      } else if (nE >= pSets && minR >= lr && f === "hard") {
        newW = base; newR = Math.min(hi, minR); code = "REPS_HARD";
      } else if (nE >= pSets && minR >= lr) {
        newW = base; newR = Math.min(hi, minR + 1); code = "REPS_UP";
      } else {
        newW = base; newR = Math.max(lo, Math.min(hi, lr)); code = "REPS_HOLD";
      }
    }

    // A miss that came close: every planned set done, and the fewest reps at most 2 short of lo or the
    // total at least 90 percent of P * lo.
    function close(evs) {
      var mr = minOf(evs.map(function (s) { return s.reps; }));
      var tot = 0;
      for (var q = 0; q < evs.length; q++) tot += evs[q].reps;
      return evs.length >= pSets && (mr >= lo - 2 || 10 * tot >= 9 * pSets * lo);
    }

    var ev = undefined, nE = undefined, minR = undefined;
    if (k === 0) {
      warm = warmups(e, lw, sets);
      var counted = sets.slice(warm);
      ev = counted.slice(0, pSets);
      nE = ev.length;
      minR = minOf(ev.map(function (s) { return s.reps; }));
      var hiW = maxOf(ev.map(function (s) { return s.weight; }));
      var loW = minOf(ev.map(function (s) { return s.weight; }));
      met = nE >= pSets && minR >= lr && loW >= lw;
      if (minR < lo) {
        var ref = Math.min(lw, Math.max(minW, hiW));
        base = ref;
        newR = lo;
        var big = e.cls === "compound" && (minR + 3 < lo || 2 * minR < lo);
        if (ref <= minW) {
          // The lightest weight: the reps target starts from what was done there and builds up
          // to lo. Reps done only at heavier weights say nothing about the lightest one.
          var atMin = ev.filter(function (s) { return s.weight <= minW; });
          code = "AT_MIN"; newW = minW; ms = 0;
          newR = atMin.length > 0 ? Math.min(lo, minOf(atMin.map(function (s) { return s.reps; })) + 1) : lo;
        } else if (l.sessions === 0 && !close(ev)) {
          code = "CAL_DOWN"; newW = calDown(e, ref); ms = 0;
        } else if (g === 1 && ref === lw && minR >= lo - 2) {
          code = "GRACE"; newW = lw; ms = 0;
        } else if (big) {
          code = "MISS_BIG"; newW = deload(e, ref); ms = 0;
        } else if (m0 + 1 >= 2) {
          code = "DELOAD"; newW = deload(e, ref); ms = 0;
        } else {
          newW = ref; ms = 1; code = ref === lw ? "MISS_ONCE" : "MISS_LIGHTER";
        }
      } else if (hiW >= lw && loW < lw) {
        code = "FINISH_AT"; newW = lw; newR = lr; base = lw; ms = 0;
      } else {
        base = Math.max(minW, loW);
        ms = 0;
        fromRows = true;
        rowsNormal(nE, minR);
      }
    } else {
      warm = 0;
      var weights = [];
      for (var i = 0; i < sets.length; i++) if (weights.indexOf(sets[i].weight) < 0) weights.push(sets[i].weight);
      var ok = weights.filter(function (wt) {
        return sets.every(function (s) { return s.weight !== wt || s.reps >= lo; });
      });
      if (ok.length === 0) {
        var lightest = minOf(sets.map(function (s) { return s.weight; }));
        var ref2 = Math.min(lw, Math.max(minW, lightest));
        var evl = sets.filter(function (s) { return s.weight === lightest; }).slice(0, pSets);
        var minRl = minOf(evl.map(function (s) { return s.reps; }));
        base = ref2;
        newR = lo;
        if (ref2 <= minW) {
          code = "AT_MIN"; newW = minW; newR = lightest <= minW ? Math.min(lo, minRl + 1) : lo; ms = 0;
        } else if (!close(evl)) {
          code = "CAL_DOWN"; newW = calDown(e, ref2); ms = 0;
        } else if (m0 + 1 >= 2) {
          code = "DELOAD"; newW = deload(e, ref2); ms = 0;
        } else {
          newW = ref2; ms = 1; code = ref2 === lw ? "MISS_ONCE" : "MISS_LIGHTER";
        }
      } else {
        var wStar = maxOf(ok);
        var w0 = Math.max(minW, wStar);
        ev = sets.filter(function (s) { return s.weight === wStar; }).slice(0, pSets);
        nE = ev.length;
        minR = minOf(ev.map(function (s) { return s.reps; }));
        ms = 0;
        if (nE >= pSets || f === "easy") base = w0;
        else if (f === "hard") base = deload(e, w0);
        else base = snapDown(e, w0 - step);
        fromRows = true;
        rowsCalibration(nE, minR);
      }
    }
    if (fromRows && base !== lw) {
      if (code === "UP" || code === "UP_EASY" || code === "CAL_UP") code = "UP_NEW_BASE";
      else if (["HARD_HOLD", "FINISH_SETS", "REPS_HARD", "REPS_UP", "REPS_HOLD"].indexOf(code) >= 0) code = "NEW_BASE";
    }
    // 5. Cap. A rebuild may go back up to rebuildTo; calibration doubles only after a set at the planned
    // weight or lighter reached lo reps (the person worked up), so a typed 315 cannot double the start.
    var capW;
    if (k === 0) {
      capW = lw + easyInc(e, lw);
      if (code === "REBUILD" && r !== undefined) capW = Math.max(capW, r);
    } else {
      var rampUp = sets.some(function (s) { return s.weight <= lw && s.reps >= lo; });
      capW = rampUp ? Math.max(lw + calInc(e, lw), 2 * lw) : lw + calInc(e, lw);
    }
    if (newW > capW) {
      newW = snapDown(e, capW);
      newR = lo;
      code = "CAPPED";
    }
    newW = Math.min(newW, e.maxWeight);
    // 6. Extra sets.
    var newX = code === "ADD_SET" ? x + 1 : (newW === lw ? x : 0);
    // 7. Stall: only sessions that missed the target, did not raise it and were not rated easy count.
    var stalled = k === 0 && newW === lw && newX === x && newR <= lr && f !== "easy" && !met;
    var a1 = stalled ? a + 1 : 0;
    if (a1 >= (hi - lo) + 4) {
      if (bigStep(e, lw) && lr > lo) {
        newR = lo;
        newX = 0;
        ms = 0;
        a1 = 0;
        code = "STALL_REPS";
      } else if (!bigStep(e, lw) && deload(e, lw) < lw) {
        // One step on a light weight is more than 10 percent, so a stall never drops it.
        newW = deload(e, lw);
        newR = lo;
        newX = 0;
        ms = 0;
        a1 = 0;
        code = "STALL";
      }
    }
    // 8. Rebuild and grace.
    var rebuild = undefined;
    if (code === "DELOAD" || code === "STALL" || code === "MISS_BIG") {
      rebuild = r === undefined ? lw : undefined;
    } else {
      rebuild = r;
      if (rebuild !== undefined && newW >= rebuild) rebuild = undefined;
    }
    var grace = (newW > base && bigStep(e, base)) ? 1 : 0;
    // 9. Store.
    var nl = copyObj(l);
    nl.weight = newW;
    nl.reps = newR;
    nl.extraSets = newX;
    nl.missStreak = ms;
    nl.sessionsAtTarget = Math.min(30, a1);
    nl.graceLeft = grace;
    nl.rebuildTo = rebuild;
    nl.sessions = Math.min(1000000000, l.sessions + 1);
    nl.calibrationLeft = Math.max(0, k - 1);
    nl.lastDay = dayKey(day);
    var cmp = tupleCompare([newW, newX, newR], [lw, x, lr]);
    var change = cmp > 0 ? "up" : (cmp < 0 ? "down" : "same");
    var hand = handText(e);
    var side = sideText(e);
    var inc = newW - base;
    var reason = undefined;
    switch (code) {
      case "UP": reason = "You hit " + fmt(hi) + " on every set - adding " + fmt(inc) + " lb" + hand + "."; break;
      case "UP_EASY": reason = "That felt easy - adding " + fmt(inc) + " lb" + hand + "."; break;
      case "CAL_UP": reason = "That felt easy - adding " + fmt(inc) + " lb" + hand + " while we find your level."; break;
      case "UP_NEW_BASE":
        reason = "Good work at " + fmt(base) + " lb" + hand + " - next time " + fmt(newW) + " lb" + hand + " for " + fmt(newR) +
          " " + repWord(newR) + side + ".";
        break;
      case "HARD_HOLD": reason = "You hit " + fmt(hi) + " on every set but it felt hard - same weight next time."; break;
      case "ADD_SET": reason = "You hit " + fmt(hi) + " on every set - adding a set before more weight."; break;
      case "FINISH_SETS":
        reason = "Finish all " + fmt(pSets) + " " + setWord(pSets) + " at " + fmt(hi) + " " + repWord(hi) + side + " to move up.";
        break;
      case "FINISH_AT": reason = "Do all " + fmt(pSets) + " " + setWord(pSets) + " at " + fmt(lw) + " lb" + hand + " to move up."; break;
      case "REPS_UP": reason = "Same weight, aim for " + fmt(newR) + " " + repWord(newR) + side + " on every set next time."; break;
      case "REPS_HARD": reason = "It felt hard - same weight and " + fmt(newR) + " " + repWord(newR) + side + " next time."; break;
      case "REPS_HOLD": reason = "Same weight, aim for " + fmt(newR) + " " + repWord(newR) + side + " on every set again."; break;
      case "NEW_BASE":
        if (newW < lw) {
          reason = "Lighter is fine - next time " + fmt(newW) + " lb" + hand + " for " + fmt(newR) + " " + repWord(newR) + side +
            " on every set, then build up from there.";
        } else {
          reason = "Good work - next time " + fmt(newW) + " lb" + hand + " for " + fmt(newR) + " " + repWord(newR) + side +
            " on every set.";
        }
        break;
      case "GRACE":
        reason = "New weight - stay at " + fmt(newW) + " lb" + hand + " next time and aim for " + fmt(lo) + " " + repWord(lo) +
          side + ".";
        break;
      case "MISS_ONCE": reason = "Tough day - same weight next time, aim for " + fmt(lo) + " " + repWord(lo) + side + "."; break;
      case "MISS_LIGHTER":
        reason = "Tough day - next time " + fmt(newW) + " lb" + hand + ", aim for " + fmt(lo) + " " + repWord(lo) + side + ".";
        break;
      case "MISS_BIG":
        reason = "That was much harder than planned - dropping to " + fmt(newW) + " lb" + hand + " to build back up.";
        break;
      case "DELOAD": reason = "Two tough sessions in a row - dropping to " + fmt(newW) + " lb" + hand + " to build back up."; break;
      case "STALL":
        reason = "You have been at this weight a while - dropping to " + fmt(newW) + " lb" + hand + " to build back up.";
        break;
      case "STALL_REPS":
        reason = "You have been at this weight a while - same weight, aim for " + fmt(lo) + " " + repWord(lo) + side +
          " to build back up.";
        break;
      case "REBUILD": reason = "Building back up - adding " + fmt(inc) + " lb" + hand + "."; break;
      case "CAPPED":
        reason = "Nice work - we will build up to that step by step: " + fmt(newW) + " lb" + hand + " next time.";
        break;
      case "AT_MIN":
        reason = "This is the lightest weight - aim for " + fmt(newR) + " " + repWord(newR) + side + " on every set next time." +
          easierText(e, p);
        break;
      default:
        if (l.sessions === 0) reason = "That was heavy for a first try - starting lighter at " + fmt(newW) + " lb" + hand + ".";
        else reason = "That was heavy - next time " + fmt(newW) + " lb" + hand + " while we find your level.";
    }
    var next = mkTarget(targetSets(p, nl, role), { weight: newW, reps: newR });
    return {
      change: change, code: code, reason: reason, lift: nl, next: next, calibrating: nl.calibrationLeft > 0, base: base,
      warmupSets: warm,
    };
  }

  function countRule(ctx, e, role, l, pSets, logged, day, allowGrowth) {
    if (allowGrowth === undefined) allowGrowth = true;
    var p = ctx.profile;
    var isReps = e.logType === "reps";
    var c = isReps ? REPS_CONSTANTS : SECONDS_CONSTANTS;
    var cap = isReps ? repsCap(p.goal) : secondsCap(p.goal);
    var t = isReps ? l.reps : l.seconds;
    var x = l.extraSets;
    var a = l.sessionsAtTarget;
    var m0 = l.missStreak;
    var k = l.calibrationLeft;
    var f = logged.feel;
    var maxExtra = maxExtraFor(p.sessionMinutes);
    var values = logged.sets.map(function (s) { return isReps ? s.reps : s.seconds; });
    var ev = values.slice(0, pSets);
    var n = ev.length;
    var v = minOf(ev);
    var newT = t;
    var newX = x;
    var ms = 0;
    var code = undefined;
    var success = n >= pSets && v >= t;
    if (success) {
      if (f === "hard") {
        code = "C_HARD";
      } else if (t >= cap) {
        if (x < maxExtra && pSets + 1 <= 5 && allowGrowth) {
          newX = x + 1;
          newT = Math.max(c.minValue, cap - c.resetDrop);
          code = "C_ADD_SET";
        } else {
          code = "C_MAXED";
        }
      } else if (!isReps && !allowGrowth) {
        // A longer hold would push the session past the time the person chose (12.6).
        code = "C_TIME";
      } else {
        newT = Math.min(cap, v + (f === "easy" ? c.easyUnit : c.unit));
        code = f === "easy" ? "C_UP_EASY" : "C_UP";
      }
    } else if (v < t - c.missMargin) {
      if (k > 0 || l.sessions === 0) {
        newT = Math.max(c.minValue, v);
        code = "C_CAL_DOWN";
      } else if (m0 + 1 >= 2) {
        newT = countDropped(c, t);
        code = "C_DOWN";
      } else {
        ms = 1;
        code = "C_MISS_ONCE";
      }
    } else {
      code = (n < pSets && v >= t) ? "C_FINISH_SETS" : "C_HOLD";
    }
    // Stall: only sessions that missed the target, did not change it and were not rated easy count.
    var a1 = (!success && f !== "easy" && newT === t && newX === x) ? a + 1 : 0;
    if (a1 >= c.stallSessions && countDropped(c, newT) < newT) {
      newT = countDropped(c, newT);
      ms = 0;
      a1 = 0;
      code = "C_STALL";
    }
    var nl = copyObj(l);
    if (isReps) nl.reps = newT; else nl.seconds = newT;
    nl.extraSets = newX;
    nl.missStreak = ms;
    nl.sessionsAtTarget = Math.min(30, a1);
    nl.sessions = Math.min(1000000000, l.sessions + 1);
    nl.calibrationLeft = Math.max(0, k - 1);
    nl.lastDay = dayKey(day);
    var change = newX > x ? "up" : (newT > t ? "up" : (newT < t ? "down" : "same"));
    var easierLow = (isReps && newT <= 3) ? easierText(e, p) : "";
    var reason = undefined;
    switch (code) {
      case "C_UP":
        reason = "You hit " + fmt(t) + " " + uWord(e, t) + " on every set - aim for " + fmt(newT) + " " + uWord(e, newT) + " next time.";
        break;
      case "C_UP_EASY": reason = "That felt easy - aim for " + fmt(newT) + " " + uWord(e, newT) + " next time."; break;
      case "C_ADD_SET": reason = "You hit " + fmt(cap) + " " + uWord(e, cap) + " on every set - adding a set."; break;
      case "C_MAXED": {
        var he = e.harder === undefined ? undefined : exercise(e.harder);
        if (he && fitsEq(he, p.equipment)) reason = "You have maxed out this move. Ready for a harder move: try " + he.name + ".";
        else reason = "You have maxed out this move - keep it steady or swap it for another move.";
        break;
      }
      case "C_HARD": reason = "It felt hard - same target next time."; break;
      case "C_FINISH_SETS": reason = "Finish all " + fmt(pSets) + " " + setWord(pSets) + " to move up."; break;
      case "C_HOLD": reason = "Aim for " + fmt(t) + " " + uWord(e, t) + " on every set again."; break;
      case "C_TIME": reason = "That fills the time you set for this session - same target next time."; break;
      case "C_MISS_ONCE": reason = "Tough day - same target next time."; break;
      case "C_DOWN":
        reason = "Two tough sessions in a row - next time aim for " + fmt(newT) + " " + uWord(e, newT) + "." + easierLow;
        break;
      case "C_CAL_DOWN":
        reason = "Starting a little easier - next time aim for " + fmt(newT) + " " + uWord(e, newT) + "." + easierLow;
        break;
      default:
        reason = "You have been at this target a while - next time aim for " + fmt(newT) + " " + uWord(e, newT) + " to build back up.";
    }
    var sets = targetSets(p, nl, role);
    var next = isReps ? mkTarget(sets, { reps: newT }) : mkTarget(sets, { seconds: newT });
    return { change: change, code: code, reason: reason, lift: nl, next: next, calibrating: nl.calibrationLeft > 0, warmupSets: 0 };
  }

  function cardioRule(ctx, e, context, logged, day, allowGrowth) {
    if (allowGrowth === undefined) allowGrowth = true;
    var key = context + ":" + e.id;
    var c = effCardio(ctx, key, context, day).cardio;
    var t = c.minutes;
    var cap = cardioCap(context, ctx.profile);
    var lm = logged.minutes === undefined ? 0 : logged.minutes;
    var week = mondayOf(day);
    var newT = t;
    var ms = 0;
    var liw = c.lastIncreaseWeek;
    var code = undefined;
    var reason = undefined;
    if (lm >= t - 1) {
      if (logged.feel === "hard") {
        code = "CA_HARD";
        reason = "It felt hard - same time next time.";
      } else if (t >= cap) {
        code = "CA_CAP";
        reason = "You are at the top goal of " + fmt(cap) + " " + minWord(cap) + " - keep it up.";
      } else if (c.lastIncreaseWeek !== undefined && dayNumber(c.lastIncreaseWeek) === week) {
        code = "CA_WEEK_HOLD";
        reason = "Nice work - more time comes next week.";
      } else if (!allowGrowth) {
        code = "CA_TIME";
        reason = "That fills the time you set for this session - same time next time.";
      } else {
        newT = Math.min(cap, t + cardioStep(t));
        liw = dayKey(week);
        code = "CA_UP";
        reason = "Good session - next time " + fmt(newT) + " " + minWord(newT) + ".";
      }
    } else if (lm <= t - 3) {
      if (c.missStreak + 1 >= 2) {
        newT = Math.max(10, t - cardioStep(t));
        code = "CA_DOWN";
        reason = "Two short sessions in a row - next goal " + fmt(newT) + " " + minWord(newT) + ".";
      } else {
        ms = 1;
        code = "CA_MISS_ONCE";
        reason = "A shorter day is fine - same goal next time: " + fmt(t) + " " + minWord(t) + ".";
      }
    } else {
      code = "CA_HOLD";
      reason = "Same goal next time: " + fmt(t) + " " + minWord(t) + ".";
    }
    var nc = copyObj(c);
    nc.minutes = newT;
    nc.missStreak = ms;
    nc.lastIncreaseWeek = liw;
    nc.lastDay = dayKey(day);
    var change = newT > t ? "up" : (newT < t ? "down" : "same");
    return {
      change: change, code: code, reason: reason, cardioKey: key, cardio: nc, next: mkTarget(1, { minutes: newT }),
      calibrating: false, warmupSets: 0,
    };
  }

  /** 12.1 step 1: the leading sets below snapDown(div(Lw * 8, 10)) are warm-ups, unless every set is. */
  function warmups(e, lw, sets) {
    var wu = snapDown(e, div(lw * 8, 10));
    var lead = 0;
    while (lead < sets.length && sets[lead].weight < wu) lead += 1;
    return lead === sets.length ? 0 : lead;
  }

  // ---- Work sets and personal records (13.3, 13.4) ----

  function workSets(item) {
    if (item.logType === "weightReps") return item.sets.slice(item.warmupSets === undefined ? 0 : item.warmupSets);
    return item.sets;
  }

  function heaviestText(e, w, r) { return fmt(w) + " lb" + handText(e) + " for " + fmt(r) + " " + repWord(r) + sideText(e); }

  function newPR(x, name, type, value, o, txt) {
    return {
      exerciseId: x, name: name, type: type, value: value, weight: o.weight, reps: o.reps, seconds: o.seconds,
      label: o.label, text: txt,
    };
  }

  function newRecords(log, item) {
    if (item.skipped || item.logType === "cardio") return [];
    var prior = [];
    for (var i = 0; i < log.length; i++) {
      var its = historyItems(log[i]);
      for (var j = 0; j < its.length; j++) {
        var it = its[j];
        if (it.exerciseId === item.exerciseId && !it.skipped && it.logType === item.logType) {
          var ws = workSets(it);
          for (var q = 0; q < ws.length; q++) prior.push(ws[q]);
        }
      }
    }
    if (prior.length === 0) return [];
    var e = exercise(item.exerciseId);
    var work = workSets(item);
    if (work.length === 0) return [];
    var name = item.name;
    var out = [];
    var s = undefined, v = undefined, k = undefined;
    switch (item.logType) {
      case "weightReps": {
        var best = work[0];
        for (k = 1; k < work.length; k++) {
          s = work[k];
          if (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) best = s;
        }
        var priorMax = maxOf(prior.map(function (z) { return z.weight; }));
        if (best.weight > priorMax) {
          out.push(newPR(item.exerciseId, name, "heaviest", best.weight, { weight: best.weight, reps: best.reps },
            "New heaviest " + name + ": " + heaviestText(e, best.weight, best.reps)));
        }
        var bestS = undefined, bestV = undefined;
        for (k = 0; k < work.length; k++) {
          s = work[k];
          v = estimatedMax(s.weight, s.reps);
          if (v === undefined || s.reps > 12) continue;
          if (bestS === undefined || v > bestV) { bestS = s; bestV = v; }
        }
        var priorE = 0;
        for (k = 0; k < prior.length; k++) {
          s = prior[k];
          if (s.reps <= 12) {
            v = estimatedMax(s.weight, s.reps);
            if (v !== undefined) priorE = Math.max(priorE, v);
          }
        }
        if (bestS !== undefined && bestV > priorE) {
          out.push(newPR(item.exerciseId, name, "estimatedMax", bestV, { weight: bestS.weight, reps: bestS.reps, label: "Estimated" },
            "New best estimated one-rep max for " + name + ": " + fmt(bestV) + " lb" + handText(e)));
        }
        break;
      }
      case "reps": {
        var most = maxOf(work.map(function (z) { return z.reps; }));
        if (most > maxOf(prior.map(function (z) { return z.reps; }))) {
          out.push(newPR(item.exerciseId, name, "mostReps", most, { reps: most },
            "New best for " + name + ": " + fmt(most) + " " + repWord(most) + sideText(e) + " in one set"));
        }
        break;
      }
      case "seconds": {
        var longest = maxOf(work.map(function (z) { return z.seconds; }));
        if (longest > maxOf(prior.map(function (z) { return z.seconds; }))) {
          out.push(newPR(item.exerciseId, name, "longestHold", longest, { seconds: longest },
            "New longest " + name + ": " + fmt(longest) + " " + secWord(longest) + sideText(e)));
        }
        break;
      }
      default:
        break;
    }
    return out;
  }

  // ---- Totals (13.2) ----

  function weeksOnPlan(ctx) {
    var s = ctx.state.counters.coachStartDay;
    var sd = s === undefined ? undefined : dayNumber(s);
    if (sd === undefined || ctx.today < sd) return 0;
    return div(mondayOf(ctx.today) - mondayOf(sd), 7) + 1;
  }

  function thisWeekJSON(ctx, plan) {
    var m = mondayOf(ctx.today);
    var built = dayNumber(plan.builtDay);
    var start = dayNumber(plan.startDay);
    if (built === undefined || start === undefined) return undefined;
    var done = 0;
    var target = 0;
    for (var k = 0; k < ctx.log.length; k++) {
      if (ctx.log[k].kind !== "training") continue;
      var d = ctx.index.dayNumbers[k];
      if (!(d <= ctx.today && d >= m)) continue;
      done += 1;
      if (d < built) target += 1;
    }
    for (var dd = Math.max(m, built); dd <= m + 6; dd++) {
      if (plan.cycle[floorMod(dd - start, 7)] === "training") target += 1;
    }
    // An extra workout on a free day raises the target with it, so the text never reads "5 of 4".
    target = Math.max(target, done);
    return { done: done, target: target, text: fmt(done) + " of " + fmt(target) + " this week" };
  }

  // ---- progress (13.7) ----

  function progressJSON(ctx) {
    var today = ctx.today;
    var m = mondayOf(today);
    var counted = ctx.index.countedOldestFirst(today);
    var lifetime = 0;
    var last30 = 0;
    var thisWeek = 0;
    var weekly = [0, 0, 0, 0, 0, 0, 0, 0];
    // B1: plan workouts per week and the split by the record's focus (free workouts are not counted).
    var weeklyWorkouts = [0, 0, 0, 0, 0, 0, 0, 0];
    var weeklyByFocus = [];
    for (var b0 = 0; b0 < 8; b0++) weeklyByFocus.push(new Map());
    var completed = 0;
    var free = 0;
    for (var i = 0; i < counted.length; i++) {
      var k = counted[i];
      var r = ctx.log[k];
      var d = ctx.index.dayNumbers[k];
      lifetime += r.pounds;
      if (d >= today - 29) last30 += r.pounds;
      if (d >= m) thisWeek += r.pounds;
      for (var j = 0; j < 8; j++) {
        var ws = m - 7 * (7 - j);
        if (d >= ws && d <= ws + 6) {
          weekly[j] += r.pounds;
          if (r.kind !== "free") {
            weeklyWorkouts[j] += 1;
            var bf = weeklyByFocus[j].get(r.focus) || { pounds: 0, workouts: 0 };
            weeklyByFocus[j].set(r.focus, { pounds: bf.pounds + r.pounds, workouts: bf.workouts + 1 });
          }
        }
      }
      if (r.kind === "free") free += 1; else completed += 1;
    }
    var weeklyOut = [];
    for (var j2 = 0; j2 < 8; j2++) {
      var byFocus = {};
      weeklyByFocus[j2].forEach(function (v, f) { byFocus[f] = { pounds: v.pounds, workouts: v.workouts }; });
      weeklyOut.push({ weekStart: dayKey(m - 7 * (7 - j2)), pounds: weekly[j2], workouts: weeklyWorkouts[j2], byFocus: byFocus });
    }
    var recent = [];
    for (var q = counted.length - 1; q >= 0 && recent.length < 10; q--) recent.push(recentJSON(ctx.log[counted[q]]));
    var o = {
      ok: true, today: dayKey(today), hasData: counted.length > 0,
      pounds: { lifetime: lifetime, last30Days: last30, thisWeek: thisWeek }, weeklyPounds: weeklyOut,
      workoutsCompleted: completed, freeWorkouts: free, weeksOnPlan: weeksOnPlan(ctx),
      liftRecords: liftRecords(ctx, counted), recent: recent,
    };
    if (ctx.state.plan) {
      var tw = thisWeekJSON(ctx, ctx.state.plan);
      if (tw) o.thisWeek = tw;
    }
    return o;
  }

  /** The "done" summary of 14.3 without its "Done" start: "{d} min" or "{d} min \u00B7 {p} lb lifted". */
  function doneText(r) {
    return r.pounds > 0
      ? fmt(r.durationMinutes) + " min" + SUMMARY_SEP + fmt(r.pounds) + " lb lifted" : fmt(r.durationMinutes) + " min";
  }

  function recentJSON(r) {
    var doneCount = doneSlots(r);
    var summary = doneText(r);
    return {
      id: r.id, day: r.day, kind: r.kind, title: r.title, focus: r.focus, durationMinutes: r.durationMinutes, pounds: r.pounds,
      exercisesDone: doneCount, recordsSet: r.records.length, summary: summary,
    };
  }

  function liftRecords(ctx, counted) {
    var newestType = new Map();
    var newestName = new Map();
    var i = undefined, j = undefined, it = undefined;
    for (i = counted.length - 1; i >= 0; i--) {
      var items = historyItems(ctx.log[counted[i]]);
      for (j = 0; j < items.length; j++) {
        it = items[j];
        if (it.skipped || it.logType === "cardio" || newestType.has(it.exerciseId)) continue;
        newestType.set(it.exerciseId, it.logType);
        newestName.set(it.exerciseId, it.name);
      }
    }
    var best = new Map();
    for (i = 0; i < counted.length; i++) {
      var r = ctx.log[counted[i]];
      // 13.3: sessions counts records, so a record that holds the same move twice (only possible in a
      // hand-edited file) counts once. Swift does the same since the 11/22 repair.
      var seen = new Set();
      var hist = historyItems(r);
      for (j = 0; j < hist.length; j++) {
        it = hist[j];
        if (it.skipped) continue;
        var lt = newestType.get(it.exerciseId);
        if (lt === undefined || lt !== it.logType) continue;
        var b = best.get(it.exerciseId) || { sessions: 0, heavy: undefined, est: undefined, most: undefined, hold: undefined };
        b = { sessions: b.sessions + (seen.has(it.exerciseId) ? 0 : 1), heavy: b.heavy, est: b.est, most: b.most, hold: b.hold };
        seen.add(it.exerciseId);
        var ws = workSets(it);
        for (var q = 0; q < ws.length; q++) {
          var s = ws[q];
          if (lt === "weightReps") {
            var w = s.weight;
            var rp = s.reps;
            if (b.heavy === undefined || w > b.heavy.w || (w === b.heavy.w && rp > b.heavy.r)) b.heavy = { w: w, r: rp, day: r.day };
            if (rp <= 12) {
              var v = estimatedMax(w, rp);
              if (v !== undefined && (b.est === undefined || v > b.est.v)) b.est = { v: v, w: w, r: rp, day: r.day };
            }
          } else if (lt === "reps") {
            if (b.most === undefined || s.reps > b.most.r) b.most = { r: s.reps, day: r.day };
          } else if (lt === "seconds") {
            if (b.hold === undefined || s.seconds > b.hold.s) b.hold = { s: s.seconds, day: r.day };
          }
        }
        best.set(it.exerciseId, b);
      }
    }
    var entries = [];
    best.forEach(function (bb, id) {
      var e = exercise(id);
      var name = e ? e.name : (newestName.has(id) ? newestName.get(id) : "Exercise");
      var ltype = newestType.get(id);
      var o = {
        exerciseId: id, name: name, logType: ltype, perHand: e ? e.perHand : false, perSide: e ? e.perSide : false,
        sessions: bb.sessions,
      };
      var hand = handText(e);
      var side = sideText(e);
      if (bb.heavy) {
        o.heaviest = { weight: bb.heavy.w, reps: bb.heavy.r, day: bb.heavy.day, text: "Heaviest: " + heaviestText(e, bb.heavy.w, bb.heavy.r) };
      }
      if (bb.est) {
        o.bestEstimatedMax = {
          value: bb.est.v, weight: bb.est.w, reps: bb.est.r, day: bb.est.day, label: "Estimated",
          text: "Estimated one-rep max: " + fmt(bb.est.v) + " lb" + hand,
        };
      }
      if (bb.most) {
        o.mostReps = { reps: bb.most.r, day: bb.most.day, text: "Most in one set: " + fmt(bb.most.r) + " " + repWord(bb.most.r) + side };
      }
      if (bb.hold) {
        o.longestHold = {
          seconds: bb.hold.s, day: bb.hold.day, text: "Longest hold: " + fmt(bb.hold.s) + " " + secWord(bb.hold.s) + side,
        };
      }
      entries.push({ name: name, id: id, json: o });
    });
    entries.sort(function (a, b) {
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      return 0;
    });
    return entries.map(function (x) { return x.json; });
  }

  // ---- liftProgress (13.6) ----

  function liftProgressJSON(ctx, e) {
    var counted = ctx.index.countedOldestFirst(ctx.today);
    var points = [];
    for (var i = 0; i < counted.length; i++) {
      var r = ctx.log[counted[i]];
      var it = undefined;
      var hist = historyItems(r);
      for (var j = 0; j < hist.length; j++) {
        var c = hist[j];
        if (c.exerciseId === e.id && !c.skipped && c.logType === e.logType) { it = c; break; }
      }
      if (!it) continue;
      var o = { day: r.day, recordId: r.id };
      var work = workSets(it);
      var k = undefined;
      switch (e.logType) {
        case "weightReps": {
          o.heaviest = work.length > 0 ? maxOf(work.map(function (z) { return z.weight; })) : 0;
          o.pounds = it.pounds;
          var bestE = undefined;
          for (k = 0; k < work.length; k++) {
            if (work[k].reps > 12) continue;
            var v = estimatedMax(work[k].weight, work[k].reps);
            if (v !== undefined) bestE = Math.max(bestE === undefined ? 0 : bestE, v);
          }
          if (bestE !== undefined) o.estimatedMax = bestE;
          break;
        }
        case "reps": {
          o.bestReps = work.length > 0 ? maxOf(work.map(function (z) { return z.reps; })) : 0;
          var total = 0;
          for (k = 0; k < work.length; k++) total += work[k].reps;
          o.totalReps = total;
          break;
        }
        case "seconds":
          o.bestSeconds = work.length > 0 ? maxOf(work.map(function (z) { return z.seconds; })) : 0;
          break;
        default:
          o.minutes = it.minutes === undefined ? 0 : it.minutes;
      }
      points.push(o);
    }
    var out = { ok: true, exerciseId: e.id, name: e.name, logType: e.logType, points: points };
    if (isWeightedEx(e)) out.estimateLabel = "Estimated";
    var l = isCardioEx(e) ? undefined : ctx.state.lifts.get(e.id);
    if (l) {
      if (e.logType === "weightReps") out.current = { weight: l.weight, reps: l.reps };
      else if (e.logType === "reps") out.current = { reps: l.reps };
      else if (e.logType === "seconds") out.current = { seconds: l.seconds };
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------------
  // The dispatcher (16.1) and every operation of 16.2.
  // ---------------------------------------------------------------------------------------------------

  var OPERATIONS = [
    "newState", "load", "save", "catalog", "setup", "editProfile", "week", "session", "startSession",
    "cancelSession", "activeSession", "completeSession", "undoLastSession", "deleteRecord", "takeRestDay",
    "clearTodayChoice", "trainToday", "swapWorkout", "swapExercise", "logFreeWorkout", "progress",
    "liftProgress", "record", "checkSafe", "alternatives", "weightMath", "dayInfo", "estimateMax", "startTarget",
  ];
  var MUTATING = [
    "newState", "load", "setup", "editProfile", "startSession", "cancelSession", "completeSession",
    "undoLastSession", "deleteRecord", "takeRestDay", "clearTodayChoice", "trainToday", "swapWorkout",
    "swapExercise", "logFreeWorkout",
  ];

  function isMutating(op) { return typeof op === "string" && isASCII(op) && MUTATING.indexOf(op) >= 0; }

  function newStateValue() { return encState(newModel()); }

  function errorResult(code, recordId) {
    var e = { code: code, message: ERROR_MESSAGES.get(code) };
    if (recordId !== undefined) e.recordId = recordId;
    return { ok: false, error: e };
  }

  /** run(op, state, input) -> {result, state} (16.1). */
  function run(op, state, input) {
    return runWith(op, state, input, false);
  }

  function runWith(op, state, input, rethrow) {
    if (typeof op !== "string" || !isASCII(op) || OPERATIONS.indexOf(op) < 0) {
      return { result: errorResult("unknownOperation"), state: state };
    }
    if (!isObject(input)) return { result: errorResult("invalidInput"), state: state };
    var inp = new Input(input);
    try {
      if (op === "newState") {
        var s0 = newStateValue();
        return { result: { ok: true, state: s0 }, state: s0 };
      }
      if (op === "load") {
        var s1 = opLoad(inp);
        return { result: { ok: true, state: s1 }, state: s1 };
      }
      var dec = decodeState(state);
      if (dec.error !== undefined) return { result: errorResult(dec.error), state: state };
      var out = dispatch(op, dec.state, inp);
      if (out.state && MUTATING.indexOf(op) >= 0) return { result: out.result, state: encState(out.state) };
      return { result: out.result, state: state };
    } catch (e) {
      if (e instanceof OpError) return { result: errorResult(e.code, e.recordId), state: state };
      if (rethrow) throw e;
      return { result: errorResult("invalidInput"), state: state };
    }
  }

  // ---- Input members (16.1 step 4) ----

  function Input(m) { this.m = m; }
  Input.prototype.has = function (k) { return mValue(this.m, k) !== undefined; };
  Input.prototype.today = function () {
    var v = mValue(this.m, "today");
    var n = typeof v === "string" ? dayNumber(v) : undefined;
    if (n === undefined || !isTodayRange(n)) throw fail("invalidDay");
    return n;
  };
  Input.prototype.storedDay = function (k) {
    var v = mValue(this.m, k);
    var n = typeof v === "string" ? dayNumber(v) : undefined;
    if (n === undefined || !isStoredRange(n)) throw fail("invalidDay");
    return n;
  };
  Input.prototype.string = function (k) {
    var v = mValue(this.m, k);
    if (typeof v !== "string") throw fail("invalidInput");
    return v;
  };
  Input.prototype.int = function (k, lo, hi) {
    var v = mInt(this.m, k, lo, hi);
    if (v === undefined) throw fail("invalidInput");
    return v;
  };
  Input.prototype.optionalInt = function (k, lo, hi) {
    if (!this.has(k)) return undefined;
    return this.int(k, lo, hi);
  };
  Input.prototype.enumValue = function (k, list) {
    var v = mEnum(this.m, k, list);
    if (v === undefined) throw fail("invalidInput");
    return v;
  };
  Input.prototype.libraryId = function (k) {
    var s = this.string(k);
    var e = exercise(s);
    if (!e) throw fail("unknownExercise");
    return e;
  };
  /** Profile validation (16.4). */
  Input.prototype.profile = function () {
    var pm = mObject(this.m, "profile");
    if (!pm) throw fail("invalidProfile");
    var goal = mEnum(pm, "goal", GOALS);
    var exp = mEnum(pm, "experience", EXPERIENCES);
    var eq = mEnum(pm, "equipment", EQUIPMENTS);
    var days = mInt(pm, "daysPerWeek", 2, 6);
    var minutes = mInt(pm, "sessionMinutes");
    if (goal === undefined || exp === undefined || eq === undefined || days === undefined || minutes === undefined ||
      (minutes !== 30 && minutes !== 45 && minutes !== 60)) {
      throw fail("invalidProfile");
    }
    var p = { goal: goal, experience: exp, daysPerWeek: days, equipment: eq, sessionMinutes: minutes, bodyWeight: undefined, anchors: [] };
    if (mValue(pm, "bodyWeight") !== undefined) {
      var b = mInt(pm, "bodyWeight", 50, 700);
      if (b === undefined) throw fail("invalidProfile");
      p.bodyWeight = b;
    }
    var av = mValue(pm, "anchors");
    if (av !== undefined) {
      if (!Array.isArray(av) || av.length > 4) throw fail("invalidProfile");
      var allowed = anchorIds(eq);
      for (var i = 0; i < av.length; i++) {
        var am = av[i];
        if (!isObject(am)) throw fail("invalidProfile");
        var id = mStr(am, "exerciseId");
        if (id === undefined || !isASCII(id) || allowed.indexOf(id) < 0) throw fail("invalidProfile");
        var e = exercise(id);
        if (!e) throw fail("invalidProfile");
        for (var k = 0; k < p.anchors.length; k++) if (p.anchors[k].exerciseId === id) throw fail("invalidProfile");
        if (isWeightedEx(e)) {
          var w = mInt(am, "weight", e.minWeight, e.maxWeight);
          var r = mInt(am, "reps", 1, 30);
          if (w === undefined || r === undefined) throw fail("invalidProfile");
          p.anchors.push({ exerciseId: id, weight: w, reps: r });
        } else {
          var r2 = mInt(am, "reps", 1, 200);
          if (r2 === undefined) throw fail("invalidProfile");
          p.anchors.push({ exerciseId: id, weight: 0, reps: r2 });
        }
      }
    }
    return p;
  };

  // ---- Operations ----

  function okResult(members) {
    var o = {};
    var keys = Object.keys(members);
    for (var i = 0; i < keys.length; i++) o[keys[i]] = members[keys[i]];
    o.ok = true;
    return o;
  }

  function dispatch(op, s, inp) {
    var t = undefined, e = undefined;
    switch (op) {
      case "save": return { result: okResult({ text: canonical(encState(s)) }), state: undefined };
      case "catalog": return { result: catalogJSON(), state: undefined };
      case "setup": return opSetup(s, inp);
      case "editProfile": return opEditProfile(s, inp);
      case "week":
        t = inp.today();
        return { result: weekJSON(makeCtx(s, t)), state: undefined };
      case "session": return opSession(s, inp);
      case "startSession": return opStartSession(s, inp);
      case "cancelSession": return opCancelSession(s, inp);
      case "activeSession": return opActiveSession(s, inp);
      case "completeSession": return completeRun(s, inp);
      case "undoLastSession": return opUndoLastSession(s, inp);
      case "deleteRecord": return opDeleteRecord(s, inp);
      case "takeRestDay": return opTakeRestDay(s, inp);
      case "clearTodayChoice": return opClearTodayChoice(s, inp);
      case "trainToday": return opTrainToday(s, inp);
      case "swapWorkout": return opSwapWorkout(s, inp);
      case "swapExercise": return swapRun(s, inp);
      case "logFreeWorkout": return opLogFreeWorkout(s, inp);
      case "progress":
        t = inp.today();
        return { result: progressJSON(makeCtx(s, t)), state: undefined };
      case "liftProgress":
        t = inp.today();
        e = inp.libraryId("exerciseId");
        return { result: liftProgressJSON(makeCtx(s, t), e), state: undefined };
      case "record": return opRecord(s, inp);
      case "checkSafe": return opCheckSafe(s, inp);
      case "alternatives": return opAlternatives(inp);
      case "weightMath": return opWeightMath(inp);
      case "dayInfo": return opDayInfo(inp);
      case "estimateMax": return opEstimateMax(inp);
      case "startTarget": return opStartTarget(inp);
      default: throw fail("unknownOperation");
    }
  }

  // ---- Shared steps ----

  /** Prune (10 step 3); s is the operation's own copy. */
  function prune(s, today) {
    if (!s.plan) return;
    var plan = copyObj(s.plan);
    var aDay = plan.active ? dayNumber(plan.active.day) : undefined;
    if (plan.todayChoice) {
      var d = dayNumber(plan.todayChoice.day);
      if (d !== undefined && d !== today && d !== aDay) plan.todayChoice = undefined;
    }
    if (plan.todaySwaps) {
      var d2 = dayNumber(plan.todaySwaps.day);
      if (d2 !== undefined && d2 !== today && d2 !== aDay) plan.todaySwaps = undefined;
    }
    s.plan = plan;
  }

  function requirePlan(s, code) { if (!s.plan) throw fail(code || "noPlan"); }
  function requireNoActive(s) { if (s.plan && s.plan.active) throw fail("sessionActive"); }
  function requireNotDone(ctx, c0) {
    if (c0.planDone) throw fail("alreadyDone", c0.recordIndex !== undefined ? ctx.log[c0.recordIndex].id : undefined);
  }

  function weekResult(s, today, extra) {
    var o = extra ? okResult(extra) : { ok: true };
    o.week = weekMember(makeCtx(s, today));
    o.ok = true;
    return o;
  }

  function todaySession(s, today) {
    var ctx = makeCtx(s, today);
    var a = ctx.plan.active;
    if (a && dayNumber(a.day) !== today) {
      var j = activeSessionJSON(ctx);
      if (j) return j;
    }
    return sessionJSON(ctx, projectCtx(ctx)[0]);
  }

  function logFull(s) { return s.log.length >= 1000000 || s.counters.nextRecordNumber >= 1000000000; }

  function newestRecordDay(s) {
    var best = undefined;
    for (var i = 0; i < s.log.length; i++) {
      var d = dayNumber(s.log[i].day);
      if (d !== undefined) best = best === undefined ? d : Math.max(best, d);
    }
    return best;
  }

  function done(result, s) { return { result: result, state: s }; }

  // ---- 10.1, 10.2 ----

  function opSetup(s0, inp) {
    var t = inp.today();
    var p = inp.profile();
    if (s0.plan) throw fail("alreadySetUp");
    var s = buildPlan(s0, p, t);
    s.undo = undefined;
    return done(weekResult(s, t), s);
  }

  function opEditProfile(s0, inp) {
    var t = inp.today();
    var p = inp.profile();
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s, "notSetUp");
    requireNoActive(s);
    s = buildPlan(s, p, t);
    s.undo = undefined;
    return done(weekResult(s, t), s);
  }

  // ---- 10.3 to 10.6 ----

  function opTakeRestDay(s0, inp) {
    var t = inp.today();
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s);
    requireNoActive(s);
    var ctx = makeCtx(s, t);
    var c0 = projectCtx(ctx)[0];
    requireNotDone(ctx, c0);
    if (c0.kind === "rest") throw fail("notAllowedToday");
    s.plan.todayChoice = { day: dayKey(t), choice: "rest" };
    s.undo = undefined;
    return done(weekResult(s, t), s);
  }

  function opClearTodayChoice(s0, inp) {
    var t = inp.today();
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s);
    requireNoActive(s);
    var ctx = makeCtx(s, t);
    var c0 = projectCtx(ctx)[0];
    requireNotDone(ctx, c0);
    if (todayChoiceOf(s.plan, t) === undefined) throw fail("notAllowedToday");
    s.plan.todayChoice = undefined;
    s.undo = undefined;
    return done(weekResult(s, t), s);
  }

  function opTrainToday(s0, inp) {
    var t = inp.today();
    var choice = inp.enumValue("choice", CHOICES);
    if (choice === "rest") throw fail("invalidInput");
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s);
    requireNoActive(s);
    var ctx = makeCtx(s, t);
    var c0 = projectCtx(ctx)[0];
    requireNotDone(ctx, c0);
    if (choice === "training") {
      if (!(c0.kind === "rest" || c0.kind === "cardio" || c0.kind === "recovery")) throw fail("notAllowedToday");
      var plan = withChoice(s.plan, "training", t);
      var err = safety(plan, s.log, ctx.index, t).error;
      if (err !== undefined) throw fail(err);
    } else {
      if (!(c0.kind === "rest" || c0.kind === "recovery")) throw fail("notAllowedToday");
    }
    s.plan.todayChoice = { day: dayKey(t), choice: choice };
    s.undo = undefined;
    return done(weekResult(s, t, { session: todaySession(s, t) }), s);
  }

  function opSwapWorkout(s0, inp) {
    var t = inp.today();
    var wid = inp.string("workoutId");
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s);
    requireNoActive(s);
    var ctx = makeCtx(s, t);
    var c0 = projectCtx(ctx)[0];
    requireNotDone(ctx, c0);
    if (c0.kind !== "training") throw fail("notAllowedToday");
    var p = isASCII(wid) ? s.plan.queue.indexOf(wid) : -1;
    if (p < 0) throw fail("unknownWorkout");
    if (wid === c0.workoutId) throw fail("notAllowedToday");
    var sw = swapped(s.plan, p);
    var err = safety(sw, s.log, ctx.index, t).error;
    if (err !== undefined) throw fail(err);
    s.plan = sw;
    s.undo = undefined;
    return done(weekResult(s, t, { session: todaySession(s, t) }), s);
  }

  // ---- 10.8 ----

  function normalizeLabel(txt) {
    var u = [];
    var i = undefined;
    for (i = 0; i < txt.length; i++) {
      var c = txt.charCodeAt(i);
      if (c === 0x2018 || c === 0x2019) u.push(0x27);
      else if (c === 0x201c || c === 0x201d) u.push(0x22);
      else if (c === 0x2013 || c === 0x2014) u.push(0x2d);
      else if (c === 0x2026) { u.push(0x2e); u.push(0x2e); u.push(0x2e); }
      else if (c === 0xa0) u.push(0x20);
      else if (c >= 32 && c <= 126) u.push(c);
    }
    var v = [];
    for (i = 0; i < u.length; i++) if (!(u[i] === 0x20 && v.length > 0 && v[v.length - 1] === 0x20)) v.push(u[i]);
    var trim = function (a) {
      var lo = 0;
      var hi = a.length;
      while (lo < hi && a[lo] === 0x20) lo += 1;
      while (hi > lo && a[hi - 1] === 0x20) hi -= 1;
      return a.slice(lo, hi);
    };
    v = trim(v);
    if (v.length > 40) v = v.slice(0, 40);
    v = trim(v);
    var out = "";
    for (i = 0; i < v.length; i++) out += String.fromCharCode(v[i]);
    return out;
  }

  function opLogFreeWorkout(s0, inp) {
    var t = inp.today();
    var label = normalizeLabel(inp.string("label"));
    if (label.length === 0) throw fail("invalidInput");
    var duration = Math.min(600, inp.int("durationMinutes", 1));
    var distance = inp.optionalInt("distanceHundredths", 0, 100000);
    var s = copyModel(s0);
    if (logFull(s)) throw fail("logFull");
    var newest = newestRecordDay(s);
    if (newest !== undefined && t < newest) throw fail("outOfOrder");
    var id = "r" + String(s.counters.nextRecordNumber);
    var r = {
      id: id, day: dayKey(t), kind: "free", workoutId: undefined, title: label, focus: "free", durationMinutes: duration,
      distanceHundredths: distance, pounds: 0, items: [], records: [], next: [],
    };
    s.log.push(r);
    s.counters.nextRecordNumber += 1;
    s.undo = { recordId: id, lifts: [], cardio: [], queue: undefined, day: dayKey(t) };
    return done(okResult({ record: encRecord(r) }), s);
  }

  // ---- 11.1, 11.2, 11.4, 11.5 ----

  function opSession(s, inp) {
    var t = inp.today();
    var i = 0;
    if (inp.has("day")) {
      var d = inp.storedDay("day");
      if (!(d >= t && d <= t + 6)) throw fail("invalidInput");
      i = d - t;
    }
    requirePlan(s);
    var ctx = makeCtx(s, t);
    return done(okResult({ session: sessionJSON(ctx, projectCtx(ctx)[i]) }), undefined);
  }

  function opStartSession(s0, inp) {
    var t = inp.today();
    var wid = inp.string("workoutId");
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s);
    requireNoActive(s);
    var ctx = makeCtx(s, t);
    var c0 = projectCtx(ctx)[0];
    requireNotDone(ctx, c0);
    if (c0.kind === "rest") throw fail("notAllowedToday");
    var cw = c0.workoutId;
    var w = cw === undefined ? undefined : workoutIn(s.plan, cw);
    if (cw === undefined || cw !== wid || !w) throw fail("notPlannedToday");
    var items = planItems(ctx, w, 0, t, undefined, false);
    s.plan.active = {
      day: dayKey(t), workoutId: cw, kind: c0.kind, title: c0.title, focus: c0.focus,
      items: items.map(function (it) {
        return { slot: it.slot, exerciseId: it.exerciseId, role: it.role, logType: it.ex.logType, target: it.target };
      }),
    };
    s.undo = undefined;
    var after = makeCtx(s, t);
    return done(okResult({ session: activeSessionJSON(after) }), s);
  }

  function opCancelSession(s0, inp) {
    var t = inp.today();
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s);
    if (!s.plan.active) throw fail("notAllowedToday");
    s.plan.active = undefined;
    s.undo = undefined;
    return done(weekResult(s, t), s);
  }

  function opActiveSession(s, inp) {
    var t = inp.today();
    if (!(s.plan && s.plan.active)) return done(okResult({ active: false }), undefined);
    var ctx = makeCtx(s, t);
    return done(okResult({ active: true, session: activeSessionJSON(ctx) }), undefined);
  }

  function opUndoLastSession(s0, inp) {
    var t = inp.today();
    var s = copyModel(s0);
    prune(s, t);
    requireNoActive(s);
    var ctx = makeCtx(s, t);
    var u = s.undo;
    var k = -1;
    if (canUndoLast(ctx) && u) {
      for (var i = 0; i < s.log.length; i++) if (s.log[i].id === u.recordId) { k = i; break; }
    }
    if (k < 0) throw fail("cannotUndo");
    s.log.splice(k, 1);
    u.lifts.forEach(function (e) { if (e.state) s.lifts.set(e.id, e.state); else s.lifts.delete(e.id); });
    u.cardio.forEach(function (e) { if (e.state) s.cardio.set(e.key, e.state); else s.cardio.delete(e.key); });
    if (u.queue && s.plan) s.plan.queue = u.queue.slice();
    s.undo = undefined;
    return done(weekResult(s, t), s);
  }

  function opDeleteRecord(s0, inp) {
    var t = inp.today();
    var id = inp.string("id");
    var s = copyModel(s0);
    var k = -1;
    for (var i = 0; i < s.log.length; i++) if (s.log[i].id === id) { k = i; break; }
    if (k < 0) throw fail("unknownRecord");
    s.log.splice(k, 1);
    s.undo = undefined;
    return done(weekResult(s, t), s);
  }

  // ---- Read ops ----

  function opRecord(s, inp) {
    var id = inp.string("id");
    for (var i = 0; i < s.log.length; i++) {
      if (s.log[i].id === id) return done(okResult({ record: encRecord(s.log[i]) }), undefined);
    }
    throw fail("unknownRecord");
  }

  function opCheckSafe(s, inp) {
    var t = inp.today();
    requirePlan(s);
    var sf = safetyCtx(makeCtx(s, t));
    return done(okResult({ safe: sf.safe, windowSafe: sf.window, queueSafe: sf.queue, restSafe: sf.rest }), undefined);
  }

  function opAlternatives(inp) {
    var e = inp.libraryId("exerciseId");
    var eq = inp.enumValue("equipment", EQUIPMENTS);
    var exclude = [];
    if (inp.has("exclude")) {
      var arr = mArray(inp.m, "exclude");
      if (!arr) throw fail("invalidInput");
      for (var i = 0; i < arr.length; i++) {
        if (typeof arr[i] !== "string") throw fail("invalidInput");
        exclude.push(arr[i]);
      }
    }
    var list = libraryAlternatives(e.id, eq, exclude);
    return done(okResult({
      alternatives: list.map(function (id) { return { exerciseId: id, name: exercise(id).name }; }),
    }), undefined);
  }

  var WEIGHT_FNS = ["snapDown", "tenthSteps", "fifthSteps", "easyInc", "calInc", "deload", "calDown", "bigStep", "maxWeight"];

  function opWeightMath(inp) {
    var e = inp.libraryId("exerciseId");
    if (!isWeightedEx(e)) throw fail("invalidInput");
    var fn = inp.string("fn");
    if (!isASCII(fn) || WEIGHT_FNS.indexOf(fn) < 0) throw fail("invalidInput");
    var b = 0;
    if (fn !== "maxWeight" || inp.has("b")) b = inp.int("b", 1, 1500);
    var value = undefined;
    switch (fn) {
      case "snapDown": value = snapDown(e, b); break;
      case "tenthSteps": value = tenthSteps(e, b); break;
      case "fifthSteps": value = fifthSteps(e, b); break;
      case "easyInc": value = easyInc(e, b); break;
      case "calInc": value = calInc(e, b); break;
      case "deload": value = deload(e, b); break;
      case "calDown": value = calDown(e, b); break;
      case "bigStep": value = bigStep(e, b); break;
      default: value = e.maxWeight;
    }
    return done(okResult({ value: value }), undefined);
  }

  function opDayInfo(inp) {
    var d = inp.storedDay("day");
    var wi = weekdayIndex(d);
    var o = {
      day: dayKey(d), dayNumber: d, weekday: WEEKDAY_NAMES[wi], weekdayIndex: wi, weekdayShort: WEEKDAY_SHORT[wi],
      monday: dayKey(mondayOf(d)),
    };
    if (inp.has("add")) {
      var add = inp.int("add", -1000000, 1000000);
      if (!isStoredRange(d + add)) throw fail("invalidInput");
      o.added = dayKey(d + add);
    }
    return done(okResult(o), undefined);
  }

  function opEstimateMax(inp) {
    var w = inp.int("weight", 1, 1500);
    var r = inp.int("reps", 1, 100);
    var o = { label: "Estimated" };
    var v = estimatedMax(w, r);
    if (v !== undefined) o.value = v;
    return done(okResult(o), undefined);
  }

  function opStartTarget(inp) {
    var e = inp.libraryId("exerciseId");
    if (isCardioEx(e)) throw fail("invalidInput");
    var goal = inp.enumValue("goal", GOALS);
    var exp = inp.enumValue("experience", EXPERIENCES);
    var hasW = inp.has("anchorWeight");
    var hasR = inp.has("anchorReps");
    var seed = undefined;
    var w = 0;
    var r = 0;
    if (hasW) {
      if (e.logType === "seconds") throw fail("invalidInput");
      w = isWeightedEx(e) ? inp.int("anchorWeight", e.minWeight, e.maxWeight) : inp.int("anchorWeight");
    }
    if (hasR) {
      if (e.logType === "seconds") throw fail("invalidInput");
      r = isWeightedEx(e) ? inp.int("anchorReps", 1, 30) : inp.int("anchorReps", 1, 200);
    }
    if (hasW !== hasR) throw fail("invalidInput");
    var percent = inp.optionalInt("percent", 1, 100);
    if (percent === undefined) percent = 100;
    var cal = inp.optionalInt("calCount", 1, 2);
    if (cal === undefined) cal = 1;
    if (hasW) seed = { weight: isWeightedEx(e) ? w : 0, reps: r, percent: percent };
    var l = freshLiftFor(e, goal, exp, seed, cal);
    var o = { calibrationLeft: l.calibrationLeft };
    if (l.weight !== undefined) o.weight = l.weight;
    if (l.reps !== undefined) o.reps = l.reps;
    if (l.seconds !== undefined) o.seconds = l.seconds;
    return done(okResult(o), undefined);
  }

  // ---- load (3.2, 3.7) ----

  function opLoad(inp) {
    var txt = inp.string("text");
    if (txt.length === 0) return newStateValue();
    var v = undefined;
    try {
      v = parse(txt);
    } catch (e) {
      throw fail("corruptData");
    }
    var dec = decodeState(v);
    if (dec.error !== undefined) throw fail(dec.error);
    return encState(dec.state);
  }

  // ---- swapExercise (10.7) ----

  function removeTodaySwap(s, workoutId, slot) {
    if (!s.plan || !s.plan.todaySwaps) return;
    var ts = s.plan.todaySwaps;
    var swaps = ts.swaps.filter(function (sw) { return !(sw.workoutId === workoutId && sw.slot === slot); });
    s.plan.todaySwaps = swaps.length === 0 ? undefined : { day: ts.day, swaps: swaps };
  }

  function swapRun(s0, inp) {
    var t = inp.today();
    var wid = inp.string("workoutId");
    var slotIndex = inp.int("slot");
    var newId = inp.string("exerciseId");
    var scope = inp.string("scope");
    if (scope !== "today" && scope !== "always") throw fail("invalidInput");
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s);
    var wIndex = -1;
    if (isASCII(wid)) {
      for (var i = 0; i < s.plan.workouts.length; i++) if (s.plan.workouts[i].id === wid) { wIndex = i; break; }
    }
    if (wIndex < 0) throw fail("unknownWorkout");
    var w = copyWorkout(s.plan.workouts[wIndex]);
    if (slotIndex < 0 || slotIndex >= w.slots.length) throw fail("unknownSlot");
    var newEx = exercise(newId);
    if (!newEx) throw fail("unknownExercise");
    var active = s.plan.active;
    if (active && !(scope === "today" && active.workoutId === wid)) throw fail("sessionActive");
    var ctx = makeCtx(s, t);
    var cards = projectCtx(ctx);
    var c0 = cards[0];
    var slot = w.slots[slotIndex];

    var xs = undefined;
    var viewDay = t;
    if (active) {
      xs = active.items.map(function (it) { return it.exerciseId; });
      var ad = dayNumber(active.day);
      viewDay = ad === undefined ? t : ad;
    } else if (c0.workoutId === wid && !c0.done) {
      xs = exerciseIds(ctx, w, 0, undefined);
    } else {
      xs = w.slots.map(function (sl) { return sl.exerciseId; });
    }
    var x = xs[slotIndex];
    var lift = plannedTarget(ctx, w, slotIndex, x, viewDay).lift;
    var options = slotOptions(ctx, w, slotIndex, xs, lift);

    var changedSlots = [];
    if (scope === "today") {
      if (!active) {
        if (c0.planDone) throw fail("alreadyDone", c0.recordIndex !== undefined ? ctx.log[c0.recordIndex].id : undefined);
        if (c0.workoutId !== wid) throw fail("notAllowedToday");
      }
      if (newId === x) {
        // No change.
      } else if (!active && newId === slot.exerciseId) {
        removeTodaySwap(s, wid, slotIndex);
        changedSlots.push([wIndex, slotIndex]);
      } else {
        if (options.indexOf(newId) < 0) throw fail("notAnAlternative");
        changedSlots.push([wIndex, slotIndex]);
        if (!active) {
          var ts = s.plan.todaySwaps;
          var list = ts ? ts.swaps.filter(function (sw) { return !(sw.workoutId === wid && sw.slot === slotIndex); }) : [];
          list.push({ workoutId: wid, slot: slotIndex, exerciseId: newId });
          s.plan.todaySwaps = { day: ts ? ts.day : dayKey(t), swaps: sortSwaps(list) };
        } else {
          var na = copyActive(s.plan.active);
          na.items[slotIndex].exerciseId = newId;
          na.items[slotIndex].logType = newEx.logType;
          s.plan.active = na;
        }
      }
    } else {
      if (newId === slot.exerciseId) {
        removeTodaySwap(s, wid, slotIndex);
      } else {
        if (options.indexOf(newId) < 0) throw fail("notAnAlternative");
        var b = slot.baseExerciseId;
        var tsw = s.plan.todaySwaps;
        var swapsToday = (tsw && dayNumber(tsw.day) === t) ? tsw.swaps : [];
        var snapshot = s.plan.workouts.map(copyWorkout);
        for (var wi = 0; wi < snapshot.length; wi++) {
          var pw = snapshot[wi];
          for (var si = 0; si < pw.slots.length; si++) {
            var ps = pw.slots[si];
            if (ps.baseExerciseId !== b) continue;
            var clash = false;
            for (var sj = 0; sj < pw.slots.length; sj++) {
              if (sj === si) continue;
              if (pw.slots[sj].exerciseId === newId) clash = true;
              for (var q = 0; q < swapsToday.length; q++) {
                var st = swapsToday[q];
                if (st.workoutId === pw.id && st.slot === sj && st.exerciseId === newId) clash = true;
              }
            }
            if (clash) continue;
            if (ps.exerciseId !== newId) {
              s.plan.workouts[wi].slots[si].exerciseId = newId;
              changedSlots.push([wi, si]);
            }
          }
        }
        if (newId === b) s.swaps.delete(b);
        else s.swaps.set(b, newId);
        for (var c = 0; c < changedSlots.length; c++) {
          removeTodaySwap(s, s.plan.workouts[changedSlots[c][0]].id, changedSlots[c][1]);
        }
      }
    }
    if (changedSlots.length > 0) {
      var target = newId;
      var te = exercise(target);
      if (te) {
        if (!isCardioEx(te)) {
          ensureLift(s, target);
        } else {
          for (var c2 = 0; c2 < changedSlots.length; c2++) {
            var cw = s.plan.workouts[changedSlots[c2][0]];
            var context = contextOf(cw.id);
            if (cw.slots[changedSlots[c2][1]].role === "cardio" && context !== undefined) ensureCardio(s, context, target);
          }
        }
      }
    }
    if (active && newId !== x && scope === "today") {
      var after = makeCtx(s, t);
      var dd = dayNumber(active.day);
      var tg = plannedTarget(after, w, slotIndex, newId, dd === undefined ? t : dd).target;
      var na2 = copyActive(s.plan.active);
      na2.items[slotIndex].target = tg;
      s.plan.active = na2;
    }
    s.undo = undefined;
    return done(weekResult(s, t, { session: todaySession(s, t) }), s);
  }

  // ---- completeSession (11.3) ----

  /** A sets array of the 11.3 input: at most 10 objects whose weight, reps and seconds are integers. */
  function parseSets(sv) {
    if (!Array.isArray(sv) || sv.length > 10) throw fail("invalidInput");
    var out = [];
    for (var j = 0; j < sv.length; j++) {
      var sm = sv[j];
      if (!isObject(sm)) throw fail("invalidInput");
      var ks = ["weight", "reps", "seconds"];
      for (var q = 0; q < ks.length; q++) {
        if (mValue(sm, ks[q]) !== undefined && mInt(sm, ks[q]) === undefined) throw fail("invalidInput");
      }
      out.push(sm);
    }
    return out;
  }

  function parseItems(inp) {
    var arr = mArray(inp.m, "items");
    if (!arr) throw fail("invalidInput");
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var im = arr[i];
      if (!isObject(im)) throw fail("invalidInput");
      var slot = mInt(im, "slot");
      var x = mStr(im, "exerciseId");
      if (slot === undefined || x === undefined) throw fail("invalidInput");
      var it = {
        slot: slot, exerciseId: x, skipped: false, sets: [], minutes: undefined, distance: undefined, feel: undefined,
        earlier: undefined,
      };
      if (mValue(im, "skipped") !== undefined) {
        var b = mBool(im, "skipped");
        if (b === undefined) throw fail("invalidInput");
        it.skipped = b;
      }
      var sv = mValue(im, "sets");
      if (sv !== undefined) it.sets = parseSets(sv);
      var ev = mValue(im, "earlierSets");
      if (ev !== undefined) {
        // B3: sets logged for an earlier move before a swap in this slot.
        if (!isObject(ev)) throw fail("invalidInput");
        var ex = mStr(ev, "exerciseId");
        var esv = mValue(ev, "sets");
        if (ex === undefined || esv === undefined) throw fail("invalidInput");
        it.earlier = { exerciseId: ex, sets: parseSets(esv) };
      }
      if (mValue(im, "minutes") !== undefined) {
        var mn = mInt(im, "minutes");
        if (mn === undefined) throw fail("invalidInput");
        it.minutes = mn;
      }
      if (mValue(im, "distanceHundredths") !== undefined) {
        var dh = mInt(im, "distanceHundredths");
        if (dh === undefined) throw fail("invalidInput");
        it.distance = dh;
      }
      if (mValue(im, "feel") !== undefined) {
        var f = mEnum(im, "feel", FEELS);
        if (f === undefined) throw fail("invalidInput");
        it.feel = f;
      }
      out.push(it);
    }
    return out;
  }

  function cleanItem(it, lt) {
    var l = { sets: [], minutes: undefined, distance: undefined, feel: undefined, skipped: true };
    if (!it) return l;
    if (lt === "cardio") {
      if (it.minutes !== undefined) l.minutes = clampInt(it.minutes, 0, 600);
      if (it.distance !== undefined) l.distance = clampInt(it.distance, 0, 100000);
    } else {
      l.sets = cleanSets(it.sets, lt);
    }
    l.feel = it.feel;
    l.skipped = it.skipped || (lt === "cardio" ? (l.minutes === undefined ? 0 : l.minutes) === 0 : l.sets.length === 0);
    if (l.skipped) {
      l.sets = [];
      l.minutes = undefined;
      l.distance = undefined;
      l.feel = undefined;
    }
    return l;
  }

  /** Cleaning of the sets of one move (11.3 step 4): sets without a positive value of the logType are dropped, the others clamped. */
  function cleanSets(sets, lt) {
    var out = [];
    for (var i = 0; i < sets.length; i++) {
      var sm = sets[i];
      var s = { weight: undefined, reps: undefined, seconds: undefined };
      if (lt === "weightReps") {
        var w = mInt(sm, "weight");
        var r = mInt(sm, "reps");
        if (w === undefined || r === undefined || !(w > 0) || !(r > 0)) continue;
        s.weight = Math.min(w, 1500);
        s.reps = Math.min(r, 100);
      } else if (lt === "reps") {
        var r2 = mInt(sm, "reps");
        if (r2 === undefined || !(r2 > 0)) continue;
        s.reps = Math.min(r2, 200);
      } else {
        var sec = mInt(sm, "seconds");
        if (sec === undefined || !(sec > 0)) continue;
        s.seconds = Math.min(sec, 3600);
      }
      out.push(s);
    }
    return out;
  }

  function completeRun(s0, inp) {
    var t = inp.today();
    var wid = inp.string("workoutId");
    var rawDuration = inp.int("durationMinutes");
    if (rawDuration < 0) throw fail("invalidInput");
    var duration = Math.min(600, rawDuration);
    var inItems = parseItems(inp);
    var s = copyModel(s0);
    prune(s, t);
    requirePlan(s);
    if (logFull(s)) throw fail("logFull");
    var ctx = makeCtx(s, t);
    var plan = s.plan;
    var sItems = undefined, kind = undefined, title = undefined, focus = undefined, day = undefined, w = undefined;
    if (plan.active) {
      var a = plan.active;
      if (a.workoutId !== wid) throw fail("notPlannedToday");
      var ad = dayNumber(a.day);
      if (t < ad) throw fail("outOfOrder");
      w = workoutIn(plan, a.workoutId);
      sItems = a.items;
      kind = a.kind;
      title = a.title;
      focus = a.focus;
      day = ad;
    } else {
      var c0 = projectCtx(ctx)[0];
      requireNotDone(ctx, c0);
      if (c0.kind === "rest") throw fail("notAllowedToday");
      var cw = c0.workoutId;
      if (cw === undefined || cw !== wid) throw fail("notPlannedToday");
      var newest = newestRecordDay(s);
      if (newest !== undefined && t < newest) throw fail("outOfOrder");
      w = workoutIn(plan, cw);
      sItems = planItems(ctx, w, 0, t, undefined, false).map(function (it) {
        return { slot: it.slot, exerciseId: it.exerciseId, role: it.role, logType: it.ex.logType, target: it.target };
      });
      kind = c0.kind;
      title = c0.title;
      focus = c0.focus;
      day = t;
    }
    var bySlot = new Map();
    var i = undefined, j = undefined;
    for (i = 0; i < inItems.length; i++) {
      var ii = inItems[i];
      if (ii.slot < 0 || ii.slot >= sItems.length) throw fail("unknownSlot");
      if (bySlot.has(ii.slot)) throw fail("duplicateSlot");
      if (ii.exerciseId !== sItems[ii.slot].exerciseId) throw fail("itemMismatch");
      if (ii.earlier) {
        // B3: the earlier move is a library move of the slot's family (its plan move, its base or the base's
        // family), not cardio and not the move logged now; the slot is not a cardio slot.
        var ee0 = exercise(ii.earlier.exerciseId);
        if (!ee0) throw fail("unknownExercise");
        var sl = w.slots[ii.slot];
        var fam = [sl.exerciseId, sl.baseExerciseId].concat(family(sl.baseExerciseId));
        if (isCardioEx(ee0) || sItems[ii.slot].logType === "cardio" || sl.role === "recovery" ||
            ee0.id === sItems[ii.slot].exerciseId || fam.indexOf(ee0.id) < 0) {
          throw fail("notAnAlternative");
        }
      }
      bySlot.set(ii.slot, ii);
    }
    var logged = sItems.map(function (it) { return cleanItem(bySlot.get(it.slot), it.logType); });
    // B3: the cleaned earlier parts; one with no set left is dropped.
    var earlier = [];
    for (i = 0; i < sItems.length; i++) {
      var bi = bySlot.get(sItems[i].slot);
      if (!bi || !bi.earlier) { earlier.push(undefined); continue; }
      var ee = exercise(bi.earlier.exerciseId);
      var esets = cleanSets(bi.earlier.sets, ee.logType);
      if (esets.length === 0) { earlier.push(undefined); continue; }
      var el = {
        exerciseId: ee.id, name: ee.name, logType: ee.logType, sets: esets, warmupSets: undefined, loadFactor: undefined,
        pounds: 0,
      };
      if (ee.logType === "weightReps") {
        var elift = effLift(ctx, ee.id, day, sItems[i].role).lift;
        el.loadFactor = loadFactor(ee);
        el.warmupSets = elift.calibrationLeft > 0 ? 0 : warmups(ee, elift.weight, esets);
      }
      el.pounds = earlierPounds(el);
      earlier.push(el);
    }
    if (logged.every(function (l) { return l.skipped; }) && earlier.every(function (x) { return x === undefined; })) {
      throw fail("nothingLogged");
    }

    var recordId = "r" + String(s.counters.nextRecordNumber);
    var outcomes = [];
    for (j = 0; j < sItems.length; j++) outcomes.push(progressItem(ctx, w, sItems[j], logged[j], day));
    // 12.6 Time budget: a step that makes the next session longer (a set, a longer hold, more cardio) is
    // taken, in slot order, only while the 6.9 estimate stays within sessionMinutes + 5.
    if (w.id !== "cardio" && w.id !== "recovery") {
      var budget = ctx.profile.sessionMinutes + 5;
      var secsOf = function (q, tg) {
        var ex0 = exercise(sItems[q].exerciseId);
        return itemSeconds(ex0, tg, restSeconds(ctx.profile, sItems[q].role, ex0));
      };
      var growsAt = function (q) { return addsTime(outcomes[q].code, exercise(sItems[q].exerciseId)); };
      var total = 300 + 60 * Math.max(0, sItems.length - 1);
      for (j = 0; j < sItems.length; j++) total += secsOf(j, growsAt(j) ? sItems[j].target : outcomes[j].next);
      for (j = 0; j < sItems.length; j++) {
        if (!growsAt(j)) continue;
        if (roundHalfUp(total + secsOf(j, outcomes[j].next) - secsOf(j, sItems[j].target), 60) > budget) {
          outcomes[j] = progressItem(ctx, w, sItems[j], logged[j], day, false);
        }
        total += secsOf(j, outcomes[j].next) - secsOf(j, sItems[j].target);
      }
    }
    var items = [];
    for (j = 0; j < sItems.length; j++) {
      var item = sItems[j];
      var e = exercise(item.exerciseId);
      var l = logged[j];
      var il = {
        slot: item.slot, exerciseId: item.exerciseId, name: e.name, logType: item.logType, role: item.role,
        target: item.target, sets: l.sets, warmupSets: undefined, loadFactor: undefined, minutes: undefined,
        distanceHundredths: undefined, feel: l.feel, skipped: l.skipped, pounds: 0, earlier: undefined,
      };
      if (item.logType === "cardio" && !l.skipped) {
        il.minutes = l.minutes;
        il.distanceHundredths = l.distance;
      }
      if (item.logType === "weightReps") {
        il.loadFactor = loadFactor(e);
        il.warmupSets = l.skipped ? 0 : outcomes[j].warmupSets;
      }
      il.pounds = itemPounds(il);
      il.earlier = earlier[j];
      items.push(il);
    }
    // 13.4: each history item of the new record (an earlier part before its item) against the log before.
    var prs = [];
    var newHistory = historyItems({ items: items });
    for (j = 0; j < newHistory.length; j++) {
      var found = newRecords(s.log, newHistory[j]);
      for (var q = 0; q < found.length; q++) prs.push(found[q]);
    }
    var next = sItems.map(function (it, k) {
      var o = outcomes[k];
      return {
        slot: it.slot, exerciseId: it.exerciseId, change: o.change, reasonCode: o.code, reason: o.reason,
        text: targetText(o.next, it.logType, exercise(it.exerciseId)),
      };
    });
    var record = {
      id: recordId, day: dayKey(day), kind: kind, workoutId: w.id, title: title, focus: focus, durationMinutes: duration,
      distanceHundredths: undefined, pounds: recordPounds(items), items: items, records: prs, next: next,
    };
    // 1. Undo.
    var undoLifts = [];
    var undoCardio = [];
    for (j = 0; j < sItems.length; j++) {
      var ue = exercise(sItems[j].exerciseId);
      if (!isCardioEx(ue)) {
        undoLifts.push({ id: ue.id, state: s.lifts.get(ue.id) });
      } else {
        var uc = contextOf(w.id);
        if (sItems[j].role === "cardio" && uc !== undefined) {
          var key = uc + ":" + ue.id;
          undoCardio.push({ key: key, state: s.cardio.get(key) });
        }
      }
    }
    undoLifts.sort(function (x, y) { return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0); });
    undoCardio.sort(function (x, y) { return x.key < y.key ? -1 : (x.key > y.key ? 1 : 0); });
    var undo = {
      recordId: recordId, lifts: undoLifts, cardio: undoCardio, queue: kind === "training" ? plan.queue.slice() : undefined,
      day: dayKey(t),
    };
    // 2. Progression results.
    for (j = 0; j < sItems.length; j++) {
      var oc = outcomes[j];
      if (oc.lift && oc.change !== "skipped") s.lifts.set(sItems[j].exerciseId, oc.lift);
      if (oc.cardioKey !== undefined && oc.cardio) s.cardio.set(oc.cardioKey, oc.cardio);
    }
    // 3 to 5.
    s.log.push(record);
    s.counters.nextRecordNumber += 1;
    if (kind === "training") {
      var qq = s.plan.queue.slice();
      qq.push(qq.shift());
      s.plan.queue = qq;
    }
    s.plan.active = undefined;
    s.undo = undo;

    var setsDone = 0;
    for (j = 0; j < items.length; j++) {
      var x = items[j];
      if (x.earlier) setsDone += x.earlier.sets.length;
      if (x.skipped) continue;
      setsDone += x.logType === "cardio" ? ((x.minutes === undefined ? 0 : x.minutes) > 0 ? 1 : 0) : x.sets.length;
    }
    var exDone = doneSlots(record);
    var exSkipped = items.length - exDone;
    var nextTargets = sItems.map(function (it, k) {
      var o = outcomes[k];
      var ex2 = exercise(it.exerciseId);
      var n = {
        slot: it.slot, exerciseId: ex2.id, name: ex2.name, logType: it.logType, change: o.change, reasonCode: o.code,
        reason: o.reason, previous: encTarget(it.target), target: encTarget(o.next), text: targetText(o.next, it.logType, ex2),
        calibrating: o.calibrating,
      };
      if (it.logType === "weightReps" && o.change !== "skipped" && o.base !== undefined) n.base = o.base;
      if (o.change !== "skipped") {
        var ct = changeTag(o.next, it.target, it.logType, true);
        n.direction = ct.direction;
        n.tag = ct.tag;
      }
      return n;
    });
    var summary = {
      title: title, durationMinutes: duration, pounds: record.pounds, setsDone: setsDone, exercisesDone: exDone,
      exercisesSkipped: exSkipped, records: prs.map(encPR), next: nextTargets,
    };
    return done(weekResult(s, t, { record: encRecord(record), summary: summary }), s);
  }

  // ---- catalog (16.5) ----

  function catalogJSON() {
    var exercises = EXERCISES.map(function (e) {
      var o = {
        id: e.id, name: e.name, pattern: e.pattern, muscle: e.muscle, muscleLabel: MUSCLE_LABELS.get(e.muscle),
        equipment: e.equipment, "class": e.cls, logType: e.logType, fits: e.fits.slice(), perHand: e.perHand,
        perSide: e.perSide,
      };
      if (isWeightedEx(e)) {
        o.loadFactor = loadFactor(e);
        o.step = e.step;
        o.minWeight = e.minWeight;
        o.maxWeight = e.maxWeight;
      }
      if (e.start.length > 0) o.start = e.start.slice();
      if (e.harder !== undefined) o.harder = e.harder;
      if (e.easier !== undefined) o.easier = e.easier;
      if (e.hint !== undefined) o.hint = e.hint;
      return o;
    });
    var templates = TEMPLATES.map(function (tp) {
      var o = {
        id: tp.id, focus: tp.focus,
        slots: tp.slots.map(function (sl) {
          return { role: sl.role, fullGym: [sl.fullGym], dumbbells: [sl.dumbbells], bodyweight: [sl.bodyweight] };
        }),
      };
      if (tp.minutes) o.minutes = tp.minutes.slice();
      return o;
    });
    var layouts = LAYOUTS.map(function (l) {
      return {
        daysPerWeek: l.daysPerWeek, cycle: l.cycle.slice(),
        rotation: l.rotation.map(function (r) { return { workoutId: r[0], title: r[1] }; }),
      };
    });
    var cycleXs = {};
    var repRanges = {};
    var countCaps = {};
    var rest = {};
    var cardioCaps = {};
    GOALS.forEach(function (g) {
      cycleXs[g] = cycleX(g);
      var c = libRepRange(g, "some", "compound", true);
      var iso = libRepRange(g, "some", "isolation", false);
      var rr = { compound: [c.lo, c.hi], isolation: [iso.lo, iso.hi] };
      if (g === "getStronger") {
        var nw = libRepRange(g, "new", "compound", true);
        var ot = libRepRange(g, "some", "compound", false);
        rr.compoundNew = [nw.lo, nw.hi];
        rr.compoundOther = [ot.lo, ot.hi];
      }
      repRanges[g] = rr;
      countCaps[g] = { reps: repsCap(g), seconds: secondsCap(g) };
      var rt = restTable(g);
      rest[g] = { main: rt.main, secondary: rt.secondary, accessory: rt.accessory };
      cardioCaps[g] = cardioGoalCap(g);
    });
    var constants = function (c) {
      return {
        unit: c.unit, easyUnit: c.easyUnit, missMargin: c.missMargin, dropPercent: 20, minValue: c.minValue,
        resetDrop: c.resetDrop, stallSessions: c.stallSessions, comebackPercent: [10, 20], comebackFloor: c.comebackFloor,
      };
    };
    var sets = {};
    ["main", "secondary", "accessory", "finisher"].forEach(function (role) {
      sets[role] = { "30": baseSets(role, 30), "45": baseSets(role, 45), "60": baseSets(role, 60) };
    });
    var sessionSize = {};
    var maxExtra = {};
    [30, 45, 60].forEach(function (m) {
      sessionSize[String(m)] = { strengthSlots: strengthSlots(m), coreSlots: coreSlots(m), finisherMinutes: finisherMinutes(m) };
      maxExtra[String(m)] = maxExtraFor(m);
    });
    var cardioStarts = {};
    EXPERIENCES.forEach(function (x) { cardioStarts[x] = cardioStart(x); });
    var heavy = {};
    FOCI.forEach(function (f) {
      var g = heavyGroups(f);
      if (g.length > 0) heavy[f] = g.slice();
    });
    var descriptions = {};
    DESCRIPTION_FOCI.forEach(function (f) { descriptions[f] = describeFocus(f); });
    var limits = {
      maxRecords: 1000000, maxRecordNumber: 1000000000, maxSetsPerItem: 10, maxSetWeight: 1500,
      maxSetReps: { weightReps: 100, reps: 200 }, maxSetSeconds: 3600, maxMinutes: 600, maxDistanceHundredths: 100000,
    };
    var pairsToObject = function (pairs) {
      var o = {};
      for (var i = 0; i < pairs.length; i++) o[pairs[i][0]] = pairs[i][1];
      return o;
    };
    var anchors = {};
    var cardioFin = {};
    EQUIPMENTS.forEach(function (e) {
      anchors[e] = anchorIds(e);
      cardioFin[e] = cardioFinishers(e);
    });
    return {
      ok: true, specVersion: "2", exercises: exercises,
      patterns: PATTERN_FALLBACKS.map(function (p) { return { pattern: p[0], fallback: p[1].slice() }; }),
      templates: templates, layouts: layouts, cycleX: cycleXs,
      finishers: { cardio: cardioFin, corePush: CORE_PUSH_FINISHERS.slice(), corePull: CORE_PULL_FINISHERS.slice() },
      newLifterSwaps: NEW_LIFTER_SWAPS.map(function (r) { return { exerciseId: r[0], substitutes: r[1].slice() }; }),
      anchors: anchors,
      anchorSeeds: ANCHOR_SEEDS.map(function (row) {
        return { anchor: row[0], seeds: row[1].map(function (sd) { return { exerciseId: sd[0], percent: sd[1] }; }) };
      }),
      tables: {
        repRanges: repRanges, countCaps: countCaps,
        countConstants: { reps: constants(REPS_CONSTANTS), seconds: constants(SECONDS_CONSTANTS) },
        rest: rest, sets: sets, maxExtra: maxExtra, sessionSize: sessionSize, cardioCaps: cardioCaps,
        cardioStart: cardioStarts, heavy: heavy, descriptions: descriptions, limits: limits,
      },
      weekdays: WEEKDAY_NAMES.map(function (n, i) { return { name: n, short: WEEKDAY_SHORT[i] }; }),
      texts: pairsToObject(TEXTS), reasonTemplates: pairsToObject(REASON_TEMPLATES),
      recordTemplates: pairsToObject(RECORD_TEMPLATES), summaryTemplates: pairsToObject(SUMMARY_TEMPLATES),
      errorMessages: pairsToObject(ERROR_CODES),
    };
  }

  // ---- Public API (16.6) ----

  var api = {
    run: run,
    parse: parse,
    canonical: canonical,
    equalJSON: equalJSON,
    partialJSON: partialJSON,
    operations: OPERATIONS.slice(),
    isMutating: isMutating,
  };
  OPERATIONS.forEach(function (op) {
    api[op] = function (state, input) { return run(op, state, input); };
  });
  // Internals for the unit tests only; not part of the app contract.
  api._internals = {
    dayNumber: dayNumber, dayKey: dayKey, weekdayIndex: weekdayIndex, mondayOf: mondayOf, floorMod: floorMod,
    floorDiv: floorDiv, div: div, roundHalfUp: roundHalfUp, estimatedMax: estimatedMax, fmt: fmt, exercise: exercise,
    snapDown: snapDown, tenthSteps: tenthSteps, fifthSteps: fifthSteps, easyInc: easyInc, calInc: calInc, deload: deload,
    calDown: calDown, bigStep: bigStep, cardioStep: cardioStep, aboutMinutes: aboutMinutes, estimatedMinutes: estimatedMinutes,
    family: family, normalizeLabel: normalizeLabel, recordNumber: recordNumber, MIN_STORED: MIN_STORED, MAX_STORED: MAX_STORED,
    MIN_TODAY: MIN_TODAY, MAX_TODAY: MAX_TODAY, isTodayRange: isTodayRange, isStoredRange: isStoredRange,
    // Pieces the test suite's section 17 checker reads (the Swift checker reads the same internals).
    decodeState: decodeState, encState: encState, makeCtx: makeCtx, safetyCtx: safetyCtx, prune: prune,
    effLift: effLift, effCardio: effCardio, repRange: repRange, maxExtraFor: maxExtraFor, repsCap: repsCap,
    secondsCap: secondsCap, cardioContext: cardioContext, cardioCap: cardioCap, layout: layout, fitsEq: fitsEq,
    seedsOfAnchor: seedsOfAnchor, expIndex: expIndex, clampInt: clampInt, isPrintableASCII: isPrintableASCII,
    contextOf: contextOf, text: text, isWeightedEx: isWeightedEx, isCountEx: isCountEx, isCardioEx: isCardioEx,
    itemSeconds: itemSeconds, restSeconds: restSeconds, addsTime: addsTime, libRepRange: libRepRange,
    breakLevel: breakLevel, comebackCount: comebackCount, countDropped: countDropped, REPS_CONSTANTS: REPS_CONSTANTS,
    SECONDS_CONSTANTS: SECONDS_CONSTANTS, changeTag: changeTag, warmups: warmups, historyItems: historyItems,
    doneSlots: doneSlots, recordPounds: recordPounds,
    runRethrow: function (op, state, input) { return runWith(op, state, input, true); },
  };

  return api;
});
