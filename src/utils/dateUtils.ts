export const getBusinessDate = (): Date => {
  const now = new Date();
  // If the current hour is less than 6 (i.e., 00:00 to 05:59)
  if (now.getHours() < 6) {
    now.setDate(now.getDate() - 1); // Subtract 1 day
  }
  return now;
};

export const getBusinessDateStr = (d: Date = getBusinessDate()): string => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};
