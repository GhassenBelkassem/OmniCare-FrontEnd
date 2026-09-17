export function hasDuplicateResponsibilityPositions(
  primaryPositionId: string | null,
  backupPositionId: string | null,
  escalationPositionId: string | null,
): boolean {
  const configuredPositionIds = [primaryPositionId, backupPositionId, escalationPositionId].filter(
    (positionId): positionId is string => positionId !== null,
  );

  return new Set(configuredPositionIds).size !== configuredPositionIds.length;
}
