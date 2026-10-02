/**
 * Utility helper to resolve machine display labels:
 * Primary: localName (if exists) or standardMachineName / item.
 * Secondary: standardMachineName (if differs from localName).
 */
export function getMachineLabel(m: { localName?: string; standardMachineName?: string; item?: string }) {
  const std = (m.standardMachineName || m.item || 'Mesin').trim();
  const local = (m.localName || '').trim();
  const differs = local && local.toLowerCase() !== std.toLowerCase();
  return { primary: local || std, secondary: differs ? std : '' };
}
