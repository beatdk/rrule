import { Frequency, DateTimeProperty, DateTimeValue } from './types';
import { Weekday } from './weekday';
import dateutil from './dateutil';
import { Days } from './rrule';
export function parseString(rfcString) {
    var options = rfcString.split('\n').map(parseLine).filter(function (x) { return x !== null; });
    /**
     * From [RFC 5545](https://tools.ietf.org/html/rfc5545):
     *
     * 3.8.2.2. Date-Time End ("DTEND")
     *
     * The value type of this property MUST be the same as the "DTSTART" property, and its
     * value MUST be later in time than the value of the "DTSTART" property. Furthermore,
     * this property MUST be specified as a date with local time if and only if the
     * "DTSTART" property is also specified as a date with local time.
     */
    return options.reduce(function (acc, cur) {
        var existing;
        if (cur.dtstart) {
            if (acc.dtstart) {
                throw new Error('Invalid rule: DTSTART must occur only once');
            }
            if (acc.dtend && acc.dtend.valueOf() <= cur.dtstart.valueOf()) {
                throw new Error('Invalid rule: DTEND must be later than DTSTART');
            }
            existing = acc.dtend;
        }
        if (cur.dtend) {
            if (acc.dtend) {
                throw new Error('Invalid rule: DTEND must occur only once');
            }
            if (acc.dtstart && acc.dtstart.valueOf() >= cur.dtend.valueOf()) {
                throw new Error('Invalid rule: DTEND must be later than DTSTART');
            }
            existing = acc.dtstart;
        }
        if (existing && acc.dtvalue !== cur.dtvalue) {
            // Different value types.
            throw new Error('Invalid rule: DTSTART and DTEND must have the same value type');
        }
        else if (existing && acc.tzid !== cur.tzid) {
            // Different timezones.
            throw new Error('Invalid rule: DTSTART and DTEND must have the same timezone');
        }
        return Object.assign(acc, cur);
    }, {}) || {};
}
export function parseDateTime(line, prop) {
    if (prop === void 0) { prop = DateTimeProperty.START; }
    var options = {};
    var dtWithZone = new RegExp(prop + "(?:;TZID=([^:=]+?))?(?:;VALUE=(DATE|DATE-TIME))?(?::|=)([^;\\s]+)", 'i').exec(line);
    if (!dtWithZone) {
        return options;
    }
    var _ = dtWithZone[0], tzid = dtWithZone[1], dtvalue = dtWithZone[2], dt = dtWithZone[3];
    if (tzid) {
        if (dt.endsWith('Z')) {
            throw new Error("Invalid UTC date-time value with timezone: " + line);
        }
        options.tzid = tzid;
    }
    else if (dt.endsWith('Z')) {
        options.tzid = 'UTC';
    }
    if (dtvalue === DateTimeValue.DATE) {
        if (prop === DateTimeProperty.START) {
            options.dtstart = dateutil.fromRfc5545Date(dt);
        }
        else {
            options.dtend = dateutil.fromRfc5545Date(dt);
        }
        options.dtvalue = DateTimeValue.DATE;
        if (options.tzid) {
            throw new Error("Invalid date value with timezone: " + line);
        }
    }
    else { // Default value type is DATE-TIME
        if (prop === DateTimeProperty.START) {
            options.dtstart = dateutil.fromRfc5545DateTime(dt);
        }
        else {
            options.dtend = dateutil.fromRfc5545DateTime(dt);
        }
        if (dtvalue) {
            options.dtvalue = DateTimeValue.DATE_TIME;
        }
    }
    return options;
}
function parseLine(rfcString) {
    rfcString = rfcString.replace(/^\s+|\s+$/, '');
    if (!rfcString.length)
        return null;
    var header = /^([A-Z]+?)[:;]/.exec(rfcString.toUpperCase());
    if (!header) {
        return parseRrule(rfcString);
    }
    var _ = header[0], key = header[1];
    switch (key.toUpperCase()) {
        case 'RRULE':
        case 'EXRULE':
            return parseRrule(rfcString);
        case 'DTSTART':
            return parseDateTime(rfcString, DateTimeProperty.START);
        case 'DTEND':
            return parseDateTime(rfcString, DateTimeProperty.END);
        default:
            throw new Error("Unsupported RFC prop " + key + " in " + rfcString);
    }
}
function parseRrule(line) {
    var strippedLine = line.replace(/^RRULE:/i, '');
    var options = parseDateTime(strippedLine);
    var attrs = line.replace(/^(?:RRULE|EXRULE):/i, '').split(';');
    attrs.forEach(function (attr) {
        var _a = attr.split('='), key = _a[0], value = _a[1];
        switch (key.toUpperCase()) {
            case 'FREQ':
                options.freq = Frequency[value.toUpperCase()];
                break;
            case 'WKST':
                options.wkst = Days[value.toUpperCase()];
                break;
            case 'COUNT':
            case 'INTERVAL':
            case 'BYSETPOS':
            case 'BYMONTH':
            case 'BYMONTHDAY':
            case 'BYYEARDAY':
            case 'BYWEEKNO':
            case 'BYHOUR':
            case 'BYMINUTE':
            case 'BYSECOND':
                var num = parseNumber(value);
                var optionKey = key.toLowerCase();
                // @ts-ignore
                options[optionKey] = num;
                break;
            case 'BYWEEKDAY':
            case 'BYDAY':
                options.byweekday = parseWeekday(value);
                break;
            case 'DTSTART':
            case 'TZID':
                // for backwards compatibility
                var parsed = parseDateTime(line);
                options.tzid = parsed.tzid;
                options.dtstart = parsed.dtstart;
                if (parsed.dtvalue) {
                    options.dtvalue = parsed.dtvalue;
                }
                break;
            case 'UNTIL':
                options.until = dateutil.fromRfc5545DateTime(value);
                break;
            case 'BYEASTER':
                options.byeaster = Number(value);
                break;
            default:
                throw new Error("Unknown RRULE property '" + key + "'");
        }
    });
    return options;
}
function parseNumber(value) {
    if (value.indexOf(',') !== -1) {
        var values = value.split(',');
        return values.map(parseIndividualNumber);
    }
    return parseIndividualNumber(value);
}
function parseIndividualNumber(value) {
    if (/^[+-]?\d+$/.test(value)) {
        return Number(value);
    }
    return value;
}
function parseWeekday(value) {
    var days = value.split(',');
    return days.map(function (day) {
        if (day.length === 2) {
            // MO, TU, ...
            return Days[day]; // wday instanceof Weekday
        }
        // -1MO, +3FR, 1SO, 13TU ...
        var parts = day.match(/^([+-]?\d{1,2})([A-Z]{2})$/);
        var n = Number(parts[1]);
        var wdaypart = parts[2];
        var wday = Days[wdaypart].weekday;
        return new Weekday(wday, n);
    });
}
//# sourceMappingURL=parsestring.js.map