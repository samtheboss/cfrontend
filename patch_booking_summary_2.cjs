const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/pages/Accommodation.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSummary = `const bookingSummary = useMemo(() => {
      const room = rooms.find(r => String(r.id) === String(bookingForm.roomId));
      const pkg = packages.find(p => String(p.id) === String(bookingForm.packageId));
  
      const roomRate = room?.nightlyRate || 0;
      const packageRate = pkg?.amount || 0;
      const nightlyTotal = roomRate + packageRate;
  
      const checkIn = new Date(bookingForm.checkInDate);
      const checkOut = new Date(bookingForm.checkOutDate);
      const nights = Math.max(1, differenceInDays(checkOut, checkIn) || 1);
  
      const totalDue = nightlyTotal * nights - (bookingForm.discount || 0);
  
      return {
        roomRate,
        packageRate,
        nightlyTotal,
        nights,
        totalDue,
      };
    }, [bookingForm, rooms, packages]);`;

const newSummary = `const bookingSummary = useMemo(() => {
      const room = rooms.find(r => String(r.id) === String(bookingForm.roomId));
      const pkg = packages.find(p => String(p.id) === String(bookingForm.packageId));
  
      const checkIn = new Date(bookingForm.checkInDate);
      const checkOut = new Date(bookingForm.checkOutDate);
      const nights = Math.max(1, differenceInDays(checkOut, checkIn) || 1);

      let roomRate = room?.nightlyRate || 0;
      let totalRoomRate = roomRate * nights;

      if (bookingForm.roomAllocations && bookingForm.roomAllocations.length > 0) {
         totalRoomRate = bookingForm.roomAllocations.reduce((sum, alloc) => sum + (alloc.nightlyRate || 0), 0);
         roomRate = totalRoomRate / Math.max(1, bookingForm.roomAllocations.length); 
      }

      const packageRate = pkg?.amount || 0;
      const nightlyTotal = roomRate + packageRate;
      
      const totalPackageRate = packageRate * nights;
      const totalDue = totalRoomRate + totalPackageRate - (bookingForm.discount || 0);
  
      return {
        roomRate,
        packageRate,
        nightlyTotal,
        nights,
        totalDue,
        totalRoomRate
      };
    }, [bookingForm, rooms, packages]);`;

content = content.replace(oldSummary, newSummary);
fs.writeFileSync(path, content);
console.log('Patched bookingSummary 2');
