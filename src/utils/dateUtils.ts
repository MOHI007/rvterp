export const getBusinessDate = (): Date => {
  const now = new Date();
  // If the current hour is less than 6 (i.e., 00:00 to 05:59)
  if (now.getHours() < 6) {
    now.setDate(now.getDate() - 1); // Subtract 1 day
  }
  return now;
};

export const getBusinessDateStr = (d: Date = getBusinessDate()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
