import { __assign } from "tslib";
import RRule from './rrule';
import RRuleSet from './rruleset';
import dateutil from './dateutil';
import { includes, split } from './helpers';
import { DateTimeProperty } from './types';
import { parseString, parseDateTime } from './parsestring';
/**
 * RRuleStr
 *  To parse a set of rrule strings
 */
var DEFAULT_OPTIONS = {
    dtstart: null,
    dtend: null,
    dtvalue: null,
    cache: false,
    unfold: false,
    forceset: false,
    compatible: false,
    tzid: null
};
export function parseInput(s, options) {
    var rrulevals = [];
    var rdatevals = [];
    var exrulevals = [];
    var exdatevals = [];
    var _a = parseDateTime(s), dtstart = _a.dtstart, dtvalue = _a.dtvalue, tzid = _a.tzid;
    var dtend = null;
    var lines = splitIntoLines(s, options.unfold);
    lines.forEach(function (line) {
        if (!line)
            return;
        var _a = breakDownLine(line), name = _a.name, parms = _a.parms, value = _a.value;
        switch (name.toUpperCase()) {
            case 'RRULE':
                if (parms.length) {
                    throw new Error("unsupported RRULE parm: " + parms.join(','));
                }
                rrulevals.push(parseString(line));
                break;
            case 'RDATE':
                var _b = /RDATE(?:;TZID=([^:=]+))?/i.exec(line), _ = _b[0], rdateTzid = _b[1];
                if (rdateTzid && !tzid) {
                    tzid = rdateTzid;
                }
                rdatevals = rdatevals.concat(parseRDate(value, parms));
                break;
            case 'EXRULE':
                if (parms.length) {
                    throw new Error("unsupported EXRULE parm: " + parms.join(','));
                }
                exrulevals.push(parseString(value));
                break;
            case 'EXDATE':
                exdatevals = exdatevals.concat(parseRDate(value, parms));
                break;
            case 'DTSTART':
                break;
            case 'DTEND':
                var parsed = parseDateTime(s, DateTimeProperty.END);
                if (parsed.dtend) {
                    if (dtend) {
                        throw new Error('Invalid rule: DTEND must occur only once');
                    }
                    if (dtstart && dtstart.valueOf() >= parsed.dtend.valueOf()) {
                        throw new Error('Invalid rule: DTEND must be later than DTSTART');
                    }
                    if (dtstart && dtvalue !== parsed.dtvalue) {
                        // Different value types.
                        throw new Error('Invalid rule: DTSTART and DTEND must have the same value type');
                    }
                    else if (dtstart && tzid !== parsed.tzid) {
                        // Different timezones.
                        throw new Error('Invalid rule: DTSTART and DTEND must have the same timezone');
                    }
                    dtend = parsed.dtend;
                }
                break;
            default:
                throw new Error('unsupported property: ' + name);
        }
    });
    return {
        dtstart: dtstart,
        dtend: dtend,
        dtvalue: dtvalue,
        tzid: tzid,
        rrulevals: rrulevals,
        rdatevals: rdatevals,
        exrulevals: exrulevals,
        exdatevals: exdatevals
    };
}
function buildRule(s, options) {
    var _a = parseInput(s, options), rrulevals = _a.rrulevals, rdatevals = _a.rdatevals, exrulevals = _a.exrulevals, exdatevals = _a.exdatevals, dtstart = _a.dtstart, dtend = _a.dtend, dtvalue = _a.dtvalue, tzid = _a.tzid;
    var noCache = options.cache === false;
    if (options.compatible) {
        options.forceset = true;
        options.unfold = true;
    }
    if (options.forceset ||
        rrulevals.length > 1 ||
        rdatevals.length ||
        exrulevals.length ||
        exdatevals.length) {
        var rset_1 = new RRuleSet(noCache);
        rset_1.dtstart(dtstart);
        rset_1.dtend(dtend);
        rset_1.tzid(tzid || undefined);
        rrulevals.forEach(function (val) {
            rset_1.rrule(new RRule(groomRruleOptions(val, dtstart, dtend, dtvalue, tzid), noCache));
        });
        rdatevals.forEach(function (date) {
            rset_1.rdate(date);
        });
        exrulevals.forEach(function (val) {
            rset_1.exrule(new RRule(groomRruleOptions(val, dtstart, dtend, dtvalue, tzid), noCache));
        });
        exdatevals.forEach(function (date) {
            rset_1.exdate(date);
        });
        if (options.compatible && options.dtstart)
            rset_1.rdate(dtstart);
        return rset_1;
    }
    var val = rrulevals[0] || {};
    return new RRule(groomRruleOptions(val, val.dtstart || options.dtstart || dtstart, val.dtend || options.dtend || dtend, val.dtvalue || options.dtvalue || dtvalue, val.tzid || options.tzid || tzid), noCache);
}
export function rrulestr(s, options) {
    if (options === void 0) { options = {}; }
    return buildRule(s, initializeOptions(options));
}
function groomRruleOptions(val, dtstart, dtend, dtvalue, tzid) {
    return __assign(__assign({}, val), { dtstart: dtstart,
        dtend: dtend,
        dtvalue: dtvalue,
        tzid: tzid });
}
function initializeOptions(options) {
    var invalid = [];
    var keys = Object.keys(options);
    var defaultKeys = Object.keys(DEFAULT_OPTIONS);
    keys.forEach(function (key) {
        if (!includes(defaultKeys, key))
            invalid.push(key);
    });
    if (invalid.length) {
        throw new Error('Invalid options: ' + invalid.join(', '));
    }
    return __assign(__assign({}, DEFAULT_OPTIONS), options);
}
function extractName(line) {
    if (line.indexOf(':') === -1) {
        return {
            name: 'RRULE',
            value: line
        };
    }
    var _a = split(line, ':', 1), name = _a[0], value = _a[1];
    return {
        name: name,
        value: value
    };
}
function breakDownLine(line) {
    var _a = extractName(line), name = _a.name, value = _a.value;
    var parms = name.split(';');
    if (!parms)
        throw new Error('empty property name');
    return {
        name: parms[0].toUpperCase(),
        parms: parms.slice(1),
        value: value
    };
}
function splitIntoLines(s, unfold) {
    if (unfold === void 0) { unfold = false; }
    s = s && s.trim();
    if (!s)
        throw new Error('Invalid empty string');
    // More info about 'unfold' option
    // Go head to http://www.ietf.org/rfc/rfc2445.txt
    if (!unfold) {
        return s.split(/\s/);
    }
    var lines = s.split('\n');
    var i = 0;
    while (i < lines.length) {
        // TODO
        var line = (lines[i] = lines[i].replace(/\s+$/g, ''));
        if (!line) {
            lines.splice(i, 1);
        }
        else if (i > 0 && line[0] === ' ') {
            lines[i - 1] += line.slice(1);
            lines.splice(i, 1);
        }
        else {
            i += 1;
        }
    }
    return lines;
}
function validateDateParm(parms) {
    parms.forEach(function (parm) {
        if (!/(VALUE=DATE(-TIME)?)|(TZID=)/.test(parm)) {
            throw new Error('unsupported RDATE/EXDATE parm: ' + parm);
        }
    });
}
function parseRDate(rdateval, parms) {
    validateDateParm(parms);
    return rdateval
        .split(',')
        .map(function (datestr) { return dateutil.fromRfc5545DateTime(datestr); });
}
//# sourceMappingURL=rrulestr.js.map