export const groupConsecutiveBookings = (bookings: any[]) => {
  if (!bookings || bookings.length === 0) return [];
  
  // Sort chronologically relative to 6 AM business day start
  const getSlotValue = (timeStr: string) => {
    const h = parseInt(timeStr.split(':')[0]);
    return h < 6 ? h + 24 : h;
  };

  const sorted = [...bookings].sort((a, b) => getSlotValue(a.start_time) - getSlotValue(b.start_time));
  
  const grouped: any[] = [];
  let current: any = null;

  sorted.forEach(b => {
    if (!current) {
      current = { ...b, original_ids: [b.id], raw_group: [b] };
    } else {
      const isSameCustomer = 
        (current.booking_group_id && current.booking_group_id === b.booking_group_id) || 
        (current.customer_phone === b.customer_phone);
      
      if (isSameCustomer && current.end_time === b.start_time) {
        current.end_time = b.end_time;
        current.original_ids.push(b.id);
        current.raw_group.push(b);
        current.total_price = Number(current.total_price) + Number(b.total_price || 0);
        current.advance_paid = Number(current.advance_paid) + Number(b.advance_paid || 0);
        current.due_amount = Number(current.due_amount) + Number(b.due_amount || 0);
        current.discount = Number(current.discount) + Number(b.discount || 0);
      } else {
        grouped.push(current);
        current = { ...b, original_ids: [b.id], raw_group: [b] };
      }
    }
  });
  
  if (current) grouped.push(current);
  return grouped;
};
