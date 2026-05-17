const normalize = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function getDonationReferenceKey(donation) {
  const reference = normalize(
    donation?.normalizedReferenceNumber || donation?.referenceNumber
  );
  if (reference) return `ref:${reference}`;
  return `id:${String(donation?._id || "").trim()}`;
}

export function groupDonationRowsByReference(rows = []) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = getDonationReferenceKey(row);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        ...row,
        duplicateCount: 1,
        groupedDonationIds: [row?._id].filter(Boolean),
      });
      return;
    }

    const existingTime = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime();
    const nextTime = new Date(row?.updatedAt || row?.createdAt || 0).getTime();
    const preferred = nextTime >= existingTime ? row : existing;

    groups.set(key, {
      ...preferred,
      duplicateCount: Number(existing.duplicateCount || 1) + 1,
      groupedDonationIds: [
        ...new Set([...existing.groupedDonationIds, row?._id].filter(Boolean)),
      ],
    });
  });

  return Array.from(groups.values());
}
