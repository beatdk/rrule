import RRule from './rrule';
import RRuleSet from './rruleset';
import { Options, DateTimeValue } from './types';
export interface RRuleStrOptions {
    dtstart: Date | null;
    dtend: Date | null;
    dtvalue: DateTimeValue | null;
    cache: boolean;
    unfold: boolean;
    forceset: boolean;
    compatible: boolean;
    tzid: string | null;
}
export declare function parseInput(s: string, options: Partial<RRuleStrOptions>): {
    dtstart: Date | null | undefined;
    dtend: null;
    dtvalue: DateTimeValue | null | undefined;
    tzid: string | null | undefined;
    rrulevals: Partial<Options>[];
    rdatevals: Date[];
    exrulevals: Partial<Options>[];
    exdatevals: Date[];
};
export declare function rrulestr(s: string, options?: Partial<RRuleStrOptions>): RRule | RRuleSet;
//# sourceMappingURL=rrulestr.d.ts.map