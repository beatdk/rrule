import { DateTimeProperty, DateTimeValue } from './types';
import RRule, { DEFAULT_OPTIONS } from './rrule';
import { includes, isPresent, isArray, isNumber, toArray } from './helpers';
import { Weekday } from './weekday';
import dateutil from './dateutil';
import { DateWithZone } from './datewithzone';
export function optionsToString(options) {
    var rrule = [];
    var dtstart = '';
    var dtend = '';
    var keys = Object.keys(options);
    var defaultKeys = Object.keys(DEFAULT_OPTIONS);
    for (var i = 0; i < keys.length; i++) {
        if (keys[i] === 'tzid')
            continue;
        if (!includes(defaultKeys, keys[i]))
            continue;
        var key = keys[i].toUpperCase();
        var value = options[keys[i]];
        var outValue = '';
        if (!isPresent(value) || (isArray(value) && !value.length))
            continue;
        switch (key) {
            case 'FREQ':
                outValue = RRule.FREQUENCIES[options.freq];
                break;
            case 'WKST':
                if (isNumber(value)) {
                    outValue = new Weekday(value).toString();
                }
                else {
                    outValue = value.toString();
                }
                break;
            case 'BYWEEKDAY':
                /*
                NOTE: BYWEEKDAY is a special case.
                RRule() deconstructs the rule.options.byweekday array
                into an array of Weekday arguments.
                On the other hand, rule.origOptions is an array of Weekdays.
                We need to handle both cases here.
                It might be worth change RRule to keep the Weekdays.
      
                Also, BYWEEKDAY (used by RRule) vs. BYDAY (RFC)
      
                */
                key = 'BYDAY';
                outValue = toArray(value).map(function (wday) {
                    if (wday instanceof Weekday) {
                        return wday;
                    }
                    if (isArray(wday)) {
                        return new Weekday(wday[0], wday[1]);
                    }
                    return new Weekday(wday);
                }).toString();
                break;
            case 'DTSTART':
                dtstart = formatDateTime(value, options, DateTimeProperty.START);
                break;
            case 'DTEND':
                dtend = formatDateTime(value, options, DateTimeProperty.END);
                break;
            case 'DTVALUE':
                break;
            case 'UNTIL':
                /**
                 * From [RFC 5545](https://tools.ietf.org/html/rfc5545):
                 *
                 * 3.3.10. Recurrence Rule
                 *
                 * The value of the UNTIL rule part MUST have the same value type as the
                 * "DTSTART" property. Furthermore, if the "DTSTART" property is specified as
                 * a date with local time, then the UNTIL rule part MUST also be specified as
                 * a date with local time. If the "DTSTART" property is specified as a date
                 * with UTC time or a date with local time and time zone reference, then the
                 * UNTIL rule part MUST be specified as a date with UTC time.
                 */
                if (options.dtvalue === DateTimeValue.DATE) {
                    outValue = dateutil.toRfc5545Date(value);
                }
                else {
                    outValue = dateutil.toRfc5545DateTime(value, !!options.tzid);
                }
                break;
            default:
                if (isArray(value)) {
                    var strValues = [];
                    for (var j = 0; j < value.length; j++) {
                        strValues[j] = String(value[j]);
                    }
                    outValue = strValues.toString();
                }
                else {
                    outValue = String(value);
                }
        }
        if (outValue) {
            rrule.push([key, outValue]);
        }
    }
    var rules = rrule.map(function (_a) {
        var key = _a[0], value = _a[1];
        return key + "=" + value.toString();
    }).join(';');
    var ruleString = '';
    if (rules !== '') {
        ruleString = "RRULE:" + rules;
    }
    return [dtstart, dtend, ruleString].filter(function (x) { return !!x; }).join('\n');
}
function formatDateTime(dt, options, prop) {
    if (options === void 0) { options = {}; }
    if (prop === void 0) { prop = DateTimeProperty.START; }
    if (!dt) {
        return '';
    }
    var prefix = prop.toString();
    if (options.dtvalue) {
        prefix += ';VALUE=' + options.dtvalue.toString();
    }
    if (!options.tzid) {
        if (options.dtvalue === DateTimeValue.DATE) {
            return prefix + ':' + dateutil.toRfc5545Date(dt);
        }
        else {
            return prefix + ':' + dateutil.toRfc5545DateTime(dt, false);
        }
    }
    return prefix + new DateWithZone(new Date(dt), options.tzid).toString();
}
//# sourceMappingURL=optionstostring.js.map