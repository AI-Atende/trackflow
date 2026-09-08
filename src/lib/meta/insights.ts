import type { MetaAction } from './types';

export function extractLeadsFromActions(actions?: MetaAction[]): number {
  if (!actions) return 0;

  // Prioritize the aggregate 'lead' metric
  const leadAction = actions.find((a) => a.action_type === 'lead');
  if (leadAction) {
    return Number(leadAction.value || 0);
  }

  // Fallback for legacy or specific cases
  const leadTypes = new Set(['leads', 'onsite_conversion.lead_grouped', 'offsite_conversion.lead']);

  return actions
    .filter((a) => leadTypes.has(a.action_type))
    .reduce((sum, a) => sum + Number(a.value || 0), 0);
}
