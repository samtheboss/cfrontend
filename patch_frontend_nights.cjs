const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/pages/Accommodation.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add BookingNight interface and update Booking interface
if (!content.includes('export interface BookingNight')) {
    content = content.replace(
        /export interface GuestDetail \{/,
        "export interface BookingNight {\n  nightDate: string;\n  roomId: any;\n  nightlyRate: number;\n}\n\nexport interface GuestDetail {"
    );
    content = content.replace(
        /guestList: GuestDetail\[\];/,
        "guestList: GuestDetail[];\n    roomAllocations?: BookingNight[];"
    );
}

// 2. Update bookingForm state and handlers
if (!content.includes('roomAllocations?: BookingNight[]')) {
    content = content.replace(
        /guestList: GuestDetail\[\];\n  \}/g,
        "guestList: GuestDetail[];\n    roomAllocations?: BookingNight[];\n  }"
    );
}

content = content.replace(
    /guestList: booking\.guestList \|\| \[\]/,
    "guestList: booking.guestList || [],\n        roomAllocations: booking.roomAllocations || []"
);

// 3. Update global availableRooms logic
const oldIsBooked = `const isBooked = bookings.some(b => {
          if (editingBooking && String(b.id) === String(editingBooking.id)) {
            return false;
          }
          if (b.status === 'CHECKED OUT' || b.status === 'VACANT') {
            return false;
          }
          const matchRoom = String(b.roomId) === String(room.id);
          const overlap = bookingForm.checkInDate < b.checkOutDate && bookingForm.checkOutDate > b.checkInDate;
          return matchRoom && overlap;
        });`;

const newIsBooked = `const isBooked = bookings.some(b => {
          if (editingBooking && String(b.id) === String(editingBooking.id)) {
            return false;
          }
          if (b.status === 'CHECKED OUT' || b.status === 'VACANT') {
            return false;
          }
          if (b.roomAllocations && b.roomAllocations.length > 0) {
             return b.roomAllocations.some(ra => 
               String(ra.roomId) === String(room.id) &&
               ra.nightDate >= bookingForm.checkInDate &&
               ra.nightDate < bookingForm.checkOutDate
             );
          }
          const matchRoom = String(b.roomId) === String(room.id);
          const overlap = bookingForm.checkInDate < b.checkOutDate && bookingForm.checkOutDate > b.checkInDate;
          return matchRoom && overlap;
        });`;
content = content.replace(oldIsBooked, newIsBooked);

// 4. Update the save booking form payload
content = content.replace(
    /guestList: guestListInput,/,
    "guestList: guestListInput,\n          roomAllocations: bookingForm.roomAllocations,"
);

// 5. Update Nightly Schedules Tab Grid
const oldScheduleGrid = `const items = [];
                          for (let i = 0; i < days; i++) {
                            const date = addDays(checkInDate, i);
                            const roomObj = rooms.find(r => String(r.id) === String(bookingForm.roomId));
                            items.push(
                              <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border rounded-xl shadow-xs">
                                <div className="flex items-center gap-3">
                                  <span className="h-6 w-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                                    {i + 1}
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-255">{format(date, 'EEEE, dd MMM yyyy')}</p>
                                    <p className="text-[10px] text-slate-400">Night occupancy allocation slot</p>
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                  KES {roomObj ? roomObj.nightlyRate.toLocaleString() : '0'}
                                </span>
                              </div>
                            );
                          }
                          return items;`;

const newScheduleGrid = `const items = [];
                          for (let i = 0; i < days; i++) {
                            const date = addDays(checkInDate, i);
                            const dateStr = format(date, 'yyyy-MM-dd');
                            
                            const alloc = bookingForm.roomAllocations?.find(a => a.nightDate === dateStr);
                            const currentRoomId = alloc ? alloc.roomId : bookingForm.roomId;
                            const currentRate = alloc ? alloc.nightlyRate : (rooms.find(r => String(r.id) === String(bookingForm.roomId))?.nightlyRate || 0);
                            const roomObj = rooms.find(r => String(r.id) === String(currentRoomId));

                            // Get available rooms for this specific night
                            const nightlyRooms = rooms.filter(room => {
                                if (!room.active || room.status === 'OUT OF ORDER') return false;
                                if (String(room.id) === String(currentRoomId)) return true;
                                const isBooked = bookings.some(b => {
                                  if (editingBooking && String(b.id) === String(editingBooking.id)) return false;
                                  if (b.status === 'CHECKED OUT' || b.status === 'VACANT') return false;
                                  if (b.roomAllocations && b.roomAllocations.length > 0) {
                                    return b.roomAllocations.some(ra => String(ra.roomId) === String(room.id) && ra.nightDate === dateStr);
                                  } else {
                                    return String(b.roomId) === String(room.id) && dateStr >= b.checkInDate && dateStr < b.checkOutDate;
                                  }
                                });
                                return !isBooked;
                            });

                            items.push(
                              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-slate-900 border rounded-xl shadow-xs gap-3">
                                <div className="flex items-center gap-3">
                                  <span className="h-6 w-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {i + 1}
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-255">{format(date, 'EEEE, dd MMM yyyy')}</p>
                                    <p className="text-[10px] text-slate-400">Room {roomObj?.roomNumber || currentRoomId}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                    KES {currentRate.toLocaleString()}
                                  </span>
                                  <select 
                                    className="h-8 text-xs rounded-lg border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                                    value={currentRoomId}
                                    onChange={(e) => {
                                      const newRoomId = e.target.value;
                                      const newRoomObj = rooms.find(r => String(r.id) === String(newRoomId));
                                      const newRate = newRoomObj ? newRoomObj.nightlyRate : 0;
                                      
                                      let currentAllocs = [...(bookingForm.roomAllocations || [])];
                                      if (currentAllocs.length === 0) {
                                        for (let j = 0; j < days; j++) {
                                          const d = format(addDays(new Date(bookingForm.checkInDate), j), 'yyyy-MM-dd');
                                          currentAllocs.push({ nightDate: d, roomId: bookingForm.roomId, nightlyRate: (rooms.find(r => String(r.id) === String(bookingForm.roomId))?.nightlyRate || 0) });
                                        }
                                      }
                                      const idx = currentAllocs.findIndex(a => a.nightDate === dateStr);
                                      if (idx >= 0) {
                                        currentAllocs[idx] = { ...currentAllocs[idx], roomId: newRoomId, nightlyRate: newRate };
                                      }
                                      setBookingForm(prev => ({ ...prev, roomAllocations: currentAllocs }));
                                    }}
                                  >
                                    <option value={currentRoomId} disabled>Transfer Room...</option>
                                    {nightlyRooms.map(nr => (
                                      <option key={nr.id} value={nr.id}>Room {nr.roomNumber} ({nr.type}) - KES {nr.nightlyRate}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          }
                          return items;`;
content = content.replace(oldScheduleGrid, newScheduleGrid);

// 6. Update Calendar UI overlap checking
const oldCalendarOverlap = `// Find any booking overlapping this date for this room
                            const matchBooking = bookings.find(b =>
                              String(b.roomId) === String(room.id) &&
                              dateStr >= b.checkInDate &&
                              dateStr < b.checkOutDate
                            );`;

const newCalendarOverlap = `// Find any booking overlapping this date for this room
                            const matchBooking = bookings.find(b => {
                              if (b.roomAllocations && b.roomAllocations.length > 0) {
                                return b.roomAllocations.some(ra => String(ra.roomId) === String(room.id) && ra.nightDate === dateStr);
                              }
                              return String(b.roomId) === String(room.id) && dateStr >= b.checkInDate && dateStr < b.checkOutDate;
                            });`;
content = content.replace(oldCalendarOverlap, newCalendarOverlap);


fs.writeFileSync(path, content);
console.log('Patched Accommodation.tsx for BookingNight integration');
