import type { MetaAction } from "./types";

export function extractLeadsFromActions(actions?: MetaAction[]): number {
    if (!actions) return 0;

    const leadTypes = new Set([
        "lead",
        "leads",
        "onsite_conversion.lead_grouped",
        "offsite_conversion.lead",
    ]);

    return actions
        .filter((a) => leadTypes.has(a.action_type))
        .reduce((sum, a) => sum + Number(a.value || 0), 0);
}
