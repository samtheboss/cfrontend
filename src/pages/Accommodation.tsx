import { useState, useMemo, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  Trash2,
  Grid,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Printer,
  User,
  Building,
  Bed,
  X,
  ChevronsUpDown,
  Banknote,
  CreditCard,
  Smartphone,
  Check,
} from 'lucide-react';
import { format, addDays, startOfWeek, subWeeks, addWeeks, differenceInDays } from 'date-fns';
import { apiFetch } from '@/lib/api';

interface Room {
  id: any;
  roomNumber: string;
  type: string;
  nightlyRate: number;
  maxOccupants: number;
  floor: string;
  status: 'VACANT' | 'BOOKED' | 'CHECKED IN' | 'RESERVED' | 'OUT OF ORDER' | 'CHECKED OUT';
  active: boolean;
  amenities: string;
  description: string;
}

interface BillingPackage {
  id: any;
  name: string;
  amount: number;
  description: string;
  status: 'Active' | 'Inactive';
}

interface Booking {
  id: any;
  transactionNumber: string;
  customerId: string;
  customerName: string;
  guestMobile: string;
  roomId: any;
  packageId: any;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  reservationType: string;
  checkedIn: boolean;
  noOfChildren: number;
  paymentMethod: string;
  paidAmount: number;
  discount: number;
  status: 'VACANT' | 'BOOKED' | 'CHECKED IN' | 'RESERVED' | 'OUT OF ORDER' | 'CHECKED OUT';
  guestList: string[];
}

interface ApiResponse<T> {
  title: string;
  message: string;
  data: T;
}

export default function Accommodation() {
  const { customers, addCustomer } = useInventory();
  const [activeTab, setActiveTab] = useState('rooms');

  // --- Core States ---
  const [rooms, setRooms] = useState<Room[]>([]);
  const [packages, setPackages] = useState<BillingPackage[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load from backend
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const roomsRes = await apiFetch<ApiResponse<Room[]>>('/api/accommodation/rooms');
      setRooms(roomsRes.data || []);

      const pkgsRes = await apiFetch<ApiResponse<BillingPackage[]>>('/api/accommodation/packages');
      setPackages(pkgsRes.data || []);

      const bookingsRes = await apiFetch<ApiResponse<Booking[]>>('/api/accommodation/bookings');
      setBookings(bookingsRes.data || []);
    } catch (err: any) {
      toast.error('Failed to fetch accommodation data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Re-calculate room statuses based on active bookings today
  useEffect(() => {
    if (rooms.length === 0) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const updatedRooms = rooms.map(room => {
      // Find active booking today
      const bookingToday = bookings.find(b =>
        String(b.roomId) === String(room.id) &&
        todayStr >= b.checkInDate &&
        todayStr < b.checkOutDate
      );
      if (bookingToday) {
        return {
          ...room,
          status: bookingToday.status
        };
      }
      return {
        ...room,
        status: (room.status === 'CHECKED IN' || room.status === 'BOOKED' || room.status === 'CHECKED OUT') ? 'VACANT' as const : room.status
      };
    });
    // Check if deep equal to prevent loops
    if (JSON.stringify(updatedRooms) !== JSON.stringify(rooms)) {
      setRooms(updatedRooms);
    }
  }, [bookings, rooms]);

  // --- Filtering & Search ---
  const [roomSearch, setRoomSearch] = useState('');
  const [roomFilterStatus, setRoomFilterStatus] = useState('All');

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      const matchSearch = r.roomNumber.toLowerCase().includes(roomSearch.toLowerCase()) || r.type.toLowerCase().includes(roomSearch.toLowerCase());
      const matchStatus = roomFilterStatus === 'All' || r.status === roomFilterStatus;
      return matchSearch && matchStatus;
    });
  }, [rooms, roomSearch, roomFilterStatus]);

  // --- Statistics ---
  const stats = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;
    bookings.forEach(b => {
      const roomObj = rooms.find(r => String(r.id) === String(b.roomId));
      const pkgObj = packages.find(p => String(p.id) === String(b.packageId));
      const rate = roomObj?.nightlyRate || 0;
      const pkgAmt = pkgObj?.amount || 0;
      const nights = Math.max(1, differenceInDays(new Date(b.checkOutDate), new Date(b.checkInDate)));
      const due = (rate + pkgAmt) * nights - (b.discount || 0);
      totalDue += due;
      totalPaid += b.paidAmount;
    });
    return {
      totalBookings: bookings.length,
      totalDue,
      totalPaid,
      outstanding: totalDue - totalPaid,
    };
  }, [bookings, rooms, packages]);

  // --- Add/Edit Room Modal ---
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState<Omit<Room, 'id'>>({
    roomNumber: '',
    type: 'Standard',
    nightlyRate: 0,
    maxOccupants: 2,
    floor: '',
    status: 'VACANT',
    active: true,
    amenities: '',
    description: '',
  });

  const handleOpenAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({
      roomNumber: '',
      type: 'Standard',
      nightlyRate: 0,
      maxOccupants: 2,
      floor: '',
      status: 'VACANT',
      active: true,
      amenities: '',
      description: '',
    });
    setIsRoomDialogOpen(true);
  };

  const handleOpenEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({ ...room });
    setIsRoomDialogOpen(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.roomNumber || !roomForm.type || roomForm.nightlyRate <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const payload = editingRoom ? { ...roomForm, id: editingRoom.id } : roomForm;
      await apiFetch('/api/accommodation/rooms', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(editingRoom ? 'Room updated successfully' : 'Room added successfully');
      fetchAllData();
      setIsRoomDialogOpen(false);
    } catch (err: any) {
      toast.error('Failed to save room: ' + err.message);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (confirm('Are you sure you want to delete this room?')) {
      try {
        await apiFetch(`/api/accommodation/rooms/${roomId}`, {
          method: 'DELETE',
        });
        toast.success('Room deleted');
        fetchAllData();
      } catch (err: any) {
        toast.error('Failed to delete room: ' + err.message);
      }
    }
  };

  // --- Add/Edit Package Modal ---
  const [isPkgDialogOpen, setIsPkgDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<BillingPackage | null>(null);
  const [pkgForm, setPkgForm] = useState<Omit<BillingPackage, 'id'>>({
    name: '',
    amount: 0,
    description: '',
    status: 'Active',
  });

  const handleOpenAddPkg = () => {
    setEditingPkg(null);
    setPkgForm({
      name: '',
      amount: 0,
      description: '',
      status: 'Active',
    });
    setIsPkgDialogOpen(true);
  };

  const handleOpenEditPkg = (pkg: BillingPackage) => {
    setEditingPkg(pkg);
    setPkgForm({ ...pkg });
    setIsPkgDialogOpen(true);
  };

  const handleSavePkg = async () => {
    if (!pkgForm.name) {
      toast.error('Package Name is required');
      return;
    }
    try {
      const payload = editingPkg ? { ...pkgForm, id: editingPkg.id } : pkgForm;
      await apiFetch('/api/accommodation/packages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(editingPkg ? 'Billing Package updated' : 'Billing Package created');
      fetchAllData();
      setIsPkgDialogOpen(false);
    } catch (err: any) {
      toast.error('Failed to save package: ' + err.message);
    }
  };

  // --- Bookings Filtering & Search ---
  const [bookingSearch, setBookingSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [filterEndDate, setFilterEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('All');
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const room = rooms.find(r => String(r.id) === String(b.roomId));
      const matchesSearch =
        b.customerName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        b.guestMobile.includes(bookingSearch) ||
        (room && room.roomNumber.toLowerCase().includes(bookingSearch.toLowerCase()));
      
      const matchesDate = 
        (!filterStartDate || b.checkOutDate >= filterStartDate) && 
        (!filterEndDate || b.checkInDate <= filterEndDate);
      
      const matchesStatus = bookingFilterStatus === 'All' || b.status === bookingFilterStatus;
      
      return matchesSearch && matchesDate && matchesStatus;
    }).sort((a, b) => b.transactionNumber.localeCompare(a.transactionNumber));
  }, [bookings, rooms, bookingSearch, filterStartDate, filterEndDate, bookingFilterStatus]);

  // --- New Booking & Edit Booking dialog ---
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [bookingActiveTab, setBookingActiveTab] = useState('details');
  const [isRoomPopoverOpen, setIsRoomPopoverOpen] = useState(false);

  const [bookingForm, setBookingForm] = useState({
    customerId: '',
    guestMobile: '',
    roomId: '',
    packageId: '',
    checkInDate: format(new Date(), 'yyyy-MM-dd'),
    checkOutDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    reservationType: 'Room Booking',
    checkedIn: false,
    noOfChildren: 0,
    paymentMethod: 'CASH',
    paidAmount: 0,
    discount: 0,
    newGuestName: '',
  });

  const [guestListInput, setGuestListInput] = useState<string[]>([]);
  const [newGuestNameInput, setNewGuestNameInput] = useState('');

  // MPESA STK Push States
  const [isPollingMpesa, setIsPollingMpesa] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'CANCELLED' | 'FAILED'>('IDLE');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [useStkPush, setUseStkPush] = useState(true);
  const [manualMpesaRef, setManualMpesaRef] = useState('');
  const stopPollingRef = useRef(false);
  const pollSessionRef = useRef(0);

  // Checkout Payment Popup States
  const [isCheckoutPaymentDialogOpen, setIsCheckoutPaymentDialogOpen] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);
  const [checkoutPayments, setCheckoutPayments] = useState<Record<string, { active: boolean; amount: string; reference: string }>>({
    cash: { active: true, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mpesa: { active: false, amount: '', reference: '' },
    bank: { active: false, amount: '', reference: '' },
  });

  // Auto-calculated Billing Summary
  const bookingSummary = useMemo(() => {
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
  }, [bookingForm, rooms, packages]);

  const availableRooms = useMemo(() => {
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) {
      return rooms.filter(r => (r.active && r.status !== 'OUT OF ORDER') || (editingBooking && String(r.id) === String(editingBooking.roomId)));
    }
    return rooms.filter(room => {
      if (editingBooking && String(room.id) === String(editingBooking.roomId)) {
        return true;
      }
      if (!room.active || room.status === 'OUT OF ORDER') return false;

      const isBooked = bookings.some(b => {
        if (editingBooking && String(b.id) === String(editingBooking.id)) {
          return false;
        }
        if (b.status === 'CHECKED OUT' || b.status === 'VACANT') {
          return false;
        }
        const matchRoom = String(b.roomId) === String(room.id);
        const overlap = bookingForm.checkInDate < b.checkOutDate && bookingForm.checkOutDate > b.checkInDate;
        return matchRoom && overlap;
      });

      return !isBooked;
    });
  }, [rooms, bookings, bookingForm.checkInDate, bookingForm.checkOutDate, editingBooking]);

  const handleOpenAddBooking = (initialRoomId?: string, initialDate?: string) => {
    setEditingBooking(null);
    setBookingActiveTab('details');
    setGuestListInput([]);
    setBookingForm({
      customerId: '',
      guestMobile: '',
      roomId: initialRoomId || '',
      packageId: packages[0]?.id || '',
      checkInDate: initialDate || format(new Date(), 'yyyy-MM-dd'),
      checkOutDate: initialDate ? format(addDays(new Date(initialDate), 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      reservationType: 'Room Booking',
      checkedIn: false,
      noOfChildren: 0,
      paymentMethod: 'CASH',
      paidAmount: 0,
      discount: 0,
      newGuestName: '',
    });
    setIsBookingDialogOpen(true);
  };

  const handleOpenEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setBookingActiveTab('details');
    setGuestListInput(booking.guestList || []);
    setBookingForm({
      customerId: booking.customerId,
      guestMobile: booking.guestMobile,
      roomId: String(booking.roomId),
      packageId: String(booking.packageId),
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      reservationType: booking.reservationType,
      checkedIn: booking.checkedIn,
      noOfChildren: booking.noOfChildren,
      paymentMethod: booking.paymentMethod,
      paidAmount: booking.paidAmount,
      discount: booking.discount || 0,
      newGuestName: '',
    });
    setIsBookingDialogOpen(true);
  };

  const pollMpesaStatus = async (requestId: string, sessionId?: number) => {
    if (stopPollingRef.current) return;
    if (sessionId !== undefined && sessionId !== pollSessionRef.current) return;

    try {
      const data = await apiFetch<any>(`/api/mpesa/stkpush/status/${requestId}`);

      if (data.status === 'SUCCESS') {
        setIsPollingMpesa(false);
        setMpesaStatus('SUCCESS');

        const receipt = data.mpesaReceiptNumber || data.MpesaReceiptNumber;
        toast.success(`M-Pesa payment of KES ${data.amount} confirmed!`);

        // Refresh data to show recorded payment (the callback does it in the backend!)
        setTimeout(() => {
          fetchAllData();
          setIsBookingDialogOpen(false);
          setMpesaStatus('IDLE');
          setCheckoutRequestId(null);
          setMpesaPhone('');
        }, 1500);
      } else if (data.status === 'FAILED') {
        setIsPollingMpesa(false);
        setMpesaStatus('FAILED');
        toast.error('M-Pesa payment failed.');
      } else if (data.status === 'CANCELLED') {
        setIsPollingMpesa(false);
        setMpesaStatus('CANCELLED');
        toast.error('M-Pesa payment was cancelled.');
      } else {
        if (!stopPollingRef.current && (sessionId === undefined || sessionId === pollSessionRef.current)) {
          setTimeout(() => pollMpesaStatus(requestId, sessionId || pollSessionRef.current), 3000);
        }
      }
    } catch (err: any) {
      console.error('Error polling MPESA status:', err);
      if (!stopPollingRef.current && (sessionId === undefined || sessionId === pollSessionRef.current)) {
        setTimeout(() => pollMpesaStatus(requestId, sessionId || pollSessionRef.current), 3000);
      }
    }
  };

  const manualQueryMpesa = async (requestId: string) => {
    setIsPollingMpesa(true);
    try {
      await apiFetch(`/api/mpesa/stkpush/query/${requestId}`);
      // Wait a moment and then poll once
      setTimeout(async () => {
        try {
          const data = await apiFetch<any>(`/api/mpesa/stkpush/status/${requestId}`);
          if (data.status === 'SUCCESS') {
            setIsPollingMpesa(false);
            setMpesaStatus('SUCCESS');
            toast.success(`M-Pesa payment of KES ${data.amount} confirmed!`);
            setTimeout(() => {
              fetchAllData();
              setIsBookingDialogOpen(false);
              setMpesaStatus('IDLE');
              setCheckoutRequestId(null);
              setMpesaPhone('');
            }, 1500);
          } else if (data.status === 'FAILED') {
            setIsPollingMpesa(false);
            setMpesaStatus('FAILED');
            toast.error('M-Pesa payment failed.');
          } else if (data.status === 'CANCELLED') {
            setIsPollingMpesa(false);
            setMpesaStatus('CANCELLED');
            toast.error('M-Pesa payment was cancelled.');
          } else {
            setIsPollingMpesa(false);
            toast.info('M-Pesa payment is still pending. Please try again in a few seconds.');
          }
        } catch (e) {
          setIsPollingMpesa(false);
          toast.error('Could not verify status. Please try again.');
        }
      }, 1000);
    } catch (err: any) {
      setIsPollingMpesa(false);
      toast.error('Failed to query M-Pesa status: ' + err.message);
    }
  };

  const handleSaveBooking = async () => {
    let finalCustId = bookingForm.customerId;
    let finalCustName = '';

    // If customer Add New name provided
    if (!finalCustId && bookingForm.newGuestName) {
      const newCustName = bookingForm.newGuestName;
      await addCustomer({
        name: newCustName,
        phone: bookingForm.guestMobile,
      });
      finalCustName = newCustName;
      finalCustId = 'cust_' + Date.now();
    } else {
      const match = customers.find(c => String(c.id) === String(finalCustId));
      finalCustName = match ? match.name : 'Guest';
    }

    if (!finalCustName) {
      toast.error('Please select a customer or type a new guest name');
      return;
    }

    const bookingStatus = bookingForm.checkedIn ? 'CHECKED IN' as const : 'BOOKED' as const;

    try {
      const payload = {
        customerId: finalCustId,
        customerName: finalCustName,
        guestMobile: bookingForm.guestMobile,
        roomId: Number(bookingForm.roomId),
        packageId: Number(bookingForm.packageId),
        checkInDate: bookingForm.checkInDate,
        checkOutDate: bookingForm.checkOutDate,
        reservationType: bookingForm.reservationType,
        checkedIn: bookingForm.checkedIn,
        noOfChildren: Number(bookingForm.noOfChildren),
        paymentMethod: bookingForm.paymentMethod,
        paidAmount: Number(bookingForm.paidAmount),
        discount: Number(bookingForm.discount),
        status: bookingStatus,
        guestList: guestListInput,
        ...(editingBooking ? { id: editingBooking.id, transactionNumber: editingBooking.transactionNumber } : { transactionNumber: '#' + (bookings.length + 3) }),
      };

      const savedBookingRes = await apiFetch<any>('/api/accommodation/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const finalBooking = savedBookingRes.data || savedBookingRes;

      if (bookingForm.paymentMethod === 'MPESA' && !useStkPush && bookingForm.paidAmount > 0) {
        await apiFetch(`/api/accommodation/bookings/${finalBooking.id}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            bookingId: finalBooking.id,
            method: 'MPESA',
            amount: bookingForm.paidAmount,
            reference: manualMpesaRef || 'Manual M-Pesa Payment'
          })
        });
      }

      toast.success(editingBooking ? 'Booking details updated' : 'New booking saved');
      fetchAllData();
      setIsBookingDialogOpen(false);
    } catch (err: any) {
      toast.error('Failed to save booking: ' + err.message);
    }
  };

  const handleMpesaStkPush = async () => {
    if (!mpesaPhone) {
      toast.error('Please enter M-Pesa Phone Number');
      return;
    }

    let finalCustId = bookingForm.customerId;
    let finalCustName = '';

    if (!finalCustId && bookingForm.newGuestName) {
      const newCustName = bookingForm.newGuestName;
      await addCustomer({
        name: newCustName,
        phone: bookingForm.guestMobile,
      });
      finalCustName = newCustName;
      finalCustId = 'cust_' + Date.now();
    } else {
      const match = customers.find(c => String(c.id) === String(finalCustId));
      finalCustName = match ? match.name : 'Guest';
    }

    const bookingStatus = bookingForm.checkedIn ? 'CHECKED IN' as const : 'BOOKED' as const;

    try {
      // 1. Save booking first so we have the transaction in DB
      const payload = {
        customerId: finalCustId,
        customerName: finalCustName,
        guestMobile: bookingForm.guestMobile,
        roomId: Number(bookingForm.roomId),
        packageId: Number(bookingForm.packageId),
        checkInDate: bookingForm.checkInDate,
        checkOutDate: bookingForm.checkOutDate,
        reservationType: bookingForm.reservationType,
        checkedIn: bookingForm.checkedIn,
        noOfChildren: Number(bookingForm.noOfChildren),
        paymentMethod: 'MPESA',
        paidAmount: editingBooking ? Number(bookingForm.paidAmount) : 0,
        discount: Number(bookingForm.discount),
        status: bookingStatus,
        guestList: guestListInput,
        ...(editingBooking ? { id: editingBooking.id, transactionNumber: editingBooking.transactionNumber } : { transactionNumber: '#' + (bookings.length + 3) }),
      };

      const savedBookingRes = await apiFetch<any>('/api/accommodation/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const finalBooking = savedBookingRes.data || savedBookingRes;

      // 2. Trigger STK push
      setIsPollingMpesa(true);
      setMpesaStatus('PENDING');
      stopPollingRef.current = false;
      pollSessionRef.current += 1;
      const currentSession = pollSessionRef.current;

      const data = await apiFetch<any>(`/api/mpesa/stkpush`, {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: mpesaPhone,
          amount: bookingForm.paidAmount,
          journalNumber: finalBooking.transactionNumber
        })
      });

      const requestId = data.CheckoutRequestID || data.checkoutRequestID;
      setCheckoutRequestId(requestId);
      toast.success('M-Pesa STK Push initiated. Please enter your PIN on your phone.');
      pollMpesaStatus(requestId, currentSession);
    } catch (error: any) {
      setIsPollingMpesa(false);
      setMpesaStatus('FAILED');
      toast.error(error.message || 'Failed to initiate STK push');
    }
  };

  const handleCheckoutBooking = async (bookingId: string) => {
    const booking = bookings.find(b => String(b.id) === String(bookingId));
    if (!booking) return;

    // Calculate outstanding balance
    const room = rooms.find(r => String(r.id) === String(booking.roomId));
    const pkg = packages.find(p => String(p.id) === String(booking.packageId));
    const rate = room?.nightlyRate || 0;
    const pkgAmt = pkg?.amount || 0;
    const nights = Math.max(1, differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate)));
    const totalDue = (rate + pkgAmt) * nights - (booking.discount || 0);
    const outstanding = Math.max(0, totalDue - booking.paidAmount);

    if (outstanding <= 0.01) {
      try {
        const payload = {
          ...booking,
          status: 'CHECKED OUT' as const,
          checkedIn: false,
        };

        await apiFetch('/api/accommodation/bookings', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        toast.success('Guest checked out successfully');
        fetchAllData();
        setIsBookingDialogOpen(false);
      } catch (err: any) {
        toast.error('Failed to checkout: ' + err.message);
      }
      return;
    }

    const methodUpper = (booking.paymentMethod || 'CASH').toUpperCase();
    const isMpesa = methodUpper.includes('MPESA');
    const isCard = methodUpper.includes('CARD');
    const isBank = methodUpper.includes('BANK');
    const isCash = !isMpesa && !isCard && !isBank;

    setCheckoutBooking(booking);
    setMpesaPhone(booking.guestMobile || '');
    setCheckoutPayments({
      cash: { active: isCash && outstanding > 0, amount: isCash && outstanding > 0 ? outstanding.toFixed(2) : '', reference: '' },
      card: { active: isCard && outstanding > 0, amount: isCard && outstanding > 0 ? outstanding.toFixed(2) : '', reference: '' },
      mpesa: { active: isMpesa && outstanding > 0, amount: isMpesa && outstanding > 0 ? outstanding.toFixed(2) : '', reference: '' },
      bank: { active: isBank && outstanding > 0, amount: isBank && outstanding > 0 ? outstanding.toFixed(2) : '', reference: '' },
    });
    setMpesaStatus('IDLE');
    setCheckoutRequestId(null);
    setIsCheckoutPaymentDialogOpen(true);
  };

  const handleCompleteCheckoutPayment = async () => {
    if (!checkoutBooking) return;

    // Calculate required outstanding balance to enforce exact payment matching
    const room = rooms.find(r => String(r.id) === String(checkoutBooking.roomId));
    const pkg = packages.find(p => String(p.id) === String(checkoutBooking.packageId));
    const rate = room?.nightlyRate || 0;
    const pkgAmt = pkg?.amount || 0;
    const nights = Math.max(1, differenceInDays(new Date(checkoutBooking.checkOutDate), new Date(checkoutBooking.checkInDate)));
    const totalDue = (rate + pkgAmt) * nights - (checkoutBooking.discount || 0);
    const outstanding = Math.max(0, totalDue - checkoutBooking.paidAmount);

    let totalPaidInDialog = 0;
    const paymentMethodsToSave: { method: string; amount: number; reference: string }[] = [];

    for (const [methodKey, p] of Object.entries(checkoutPayments)) {
      if (p.active) {
        const amt = parseFloat(p.amount) || 0;
        if (amt > 0) {
          totalPaidInDialog += amt;
          const methodLabel = methodKey.toUpperCase();
          paymentMethodsToSave.push({
            method: methodLabel === 'MPESA' ? 'MPESA' : methodLabel === 'BANK' ? 'BANK TRANSFER' : methodLabel,
            amount: amt,
            reference: p.reference || 'Checkout Payment'
          });
        }
      }
    }

    if (Math.abs(totalPaidInDialog - outstanding) > 0.01) {
      toast.error(`Total payment ($${totalPaidInDialog.toFixed(2)}) must match the outstanding required amount ($${outstanding.toFixed(2)})`);
      return;
    }

    try {
      // 1. Post each individual payment to /api/accommodation/bookings/{id}/payments
      for (const pay of paymentMethodsToSave) {
        await apiFetch(`/api/accommodation/bookings/${checkoutBooking.id}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            bookingId: checkoutBooking.id,
            method: pay.method,
            amount: pay.amount,
            reference: pay.reference
          })
        });
      }

      // 2. Mark booking as CHECKED OUT
      const payload = {
        ...checkoutBooking,
        status: 'CHECKED OUT' as const,
        checkedIn: false,
      };

      await apiFetch('/api/accommodation/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Guest checked out successfully and payments recorded');
      fetchAllData();
      setIsCheckoutPaymentDialogOpen(false);
      setIsBookingDialogOpen(false);
    } catch (err: any) {
      toast.error('Failed to complete checkout: ' + err.message);
    }
  };

  const handleCheckoutMpesaPush = async () => {
    if (!checkoutBooking) return;
    const mpesaAmt = parseFloat(checkoutPayments.mpesa.amount) || 0;
    if (mpesaAmt <= 0) {
      toast.error('Please enter a valid M-Pesa amount');
      return;
    }
    if (!mpesaPhone) {
      toast.error('Please enter M-Pesa Phone Number');
      return;
    }

    setIsPollingMpesa(true);
    setMpesaStatus('PENDING');
    stopPollingRef.current = false;
    pollSessionRef.current += 1;
    const currentSession = pollSessionRef.current;

    try {
      const data = await apiFetch<any>(`/api/mpesa/stkpush`, {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: mpesaPhone,
          amount: mpesaAmt,
          journalNumber: checkoutBooking.transactionNumber
        })
      });

      const requestId = data.CheckoutRequestID || data.checkoutRequestID;
      setCheckoutRequestId(requestId);
      toast.success('M-Pesa STK Push initiated. Please enter your PIN on your phone.');
      pollCheckoutMpesaStatus(requestId, currentSession);
    } catch (error: any) {
      setIsPollingMpesa(false);
      setMpesaStatus('FAILED');
      toast.error(error.message || 'Failed to initiate STK push');
    }
  };

  const pollCheckoutMpesaStatus = async (requestId: string, sessionId?: number) => {
    if (stopPollingRef.current) return;
    if (sessionId !== undefined && sessionId !== pollSessionRef.current) return;

    try {
      const data = await apiFetch<any>(`/api/mpesa/stkpush/status/${requestId}`);

      if (data.status === 'SUCCESS') {
        setIsPollingMpesa(false);
        setMpesaStatus('SUCCESS');

        const receipt = data.mpesaReceiptNumber || data.MpesaReceiptNumber || 'MPESA-' + requestId;
        toast.success(`M-Pesa payment of KES ${data.amount} confirmed!`);

        setCheckoutPayments(prev => ({
          ...prev,
          mpesa: { ...prev.mpesa, reference: receipt }
        }));
      } else if (data.status === 'FAILED') {
        setIsPollingMpesa(false);
        setMpesaStatus('FAILED');
        toast.error('M-Pesa payment failed.');
      } else if (data.status === 'CANCELLED') {
        setIsPollingMpesa(false);
        setMpesaStatus('CANCELLED');
        toast.error('M-Pesa payment was cancelled.');
      } else {
        if (!stopPollingRef.current && (sessionId === undefined || sessionId === pollSessionRef.current)) {
          setTimeout(() => pollCheckoutMpesaStatus(requestId, sessionId || pollSessionRef.current), 3000);
        }
      }
    } catch (err: any) {
      console.error('Error polling MPESA status:', err);
      if (!stopPollingRef.current && (sessionId === undefined || sessionId === pollSessionRef.current)) {
        setTimeout(() => pollCheckoutMpesaStatus(requestId, sessionId || pollSessionRef.current), 3000);
      }
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (confirm('Are you sure you want to cancel and delete this booking transaction?')) {
      try {
        await apiFetch(`/api/accommodation/bookings/${bookingId}`, {
          method: 'DELETE',
        });
        toast.success('Booking deleted');
        fetchAllData();
        setIsBookingDialogOpen(false);
      } catch (err: any) {
        toast.error('Failed to delete booking: ' + err.message);
      }
    }
  };

  const handlePrintReceipt = () => {
    toast.info('Printing receipt details...');
  };

  // --- Guest List Management inside Booking ---
  const handleAddGuestToBooking = () => {
    if (!newGuestNameInput) return;
    setGuestListInput([...guestListInput, newGuestNameInput]);
    setNewGuestNameInput('');
  };

  const handleRemoveGuestFromBooking = (index: number) => {
    setGuestListInput(guestListInput.filter((_, i) => i !== index));
  };

  // --- Room Schedules Calendar Grid Logic ---
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const handlePrevWeek = () => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  };

  const handleGoToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  return (
    <AppLayout title="Hotel Guest Rooms">
      <div className="space-y-6">
        {/* Main Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {activeTab === 'rooms' && 'Guest Rooms'}
                {activeTab === 'schedules' && 'Room Schedules'}
                {activeTab === 'bookings' && 'Bookings & Transactions'}
                {activeTab === 'packages' && 'Billing Packages'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeTab === 'rooms' && 'Manage hotel guest rooms and status'}
                {activeTab === 'schedules' && `Week of ${format(daysOfWeek[0], 'dd MMM')} - ${format(daysOfWeek[6], 'dd MMM yyyy')}`}
                {activeTab === 'bookings' && 'Manage all guest room bookings, check-ins, and check-outs'}
                {activeTab === 'packages' && 'Extra charge packages applied to room bookings'}
              </p>
            </div>

            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <TabsTrigger value="rooms" className="rounded-lg px-4 py-2 text-xs font-semibold">Guest Rooms</TabsTrigger>
              <TabsTrigger value="schedules" className="rounded-lg px-4 py-2 text-xs font-semibold">Room Schedules</TabsTrigger>
              <TabsTrigger value="bookings" className="rounded-lg px-4 py-2 text-xs font-semibold">Bookings & Transactions</TabsTrigger>
              <TabsTrigger value="packages" className="rounded-lg px-4 py-2 text-xs font-semibold">Billing Packages</TabsTrigger>
            </TabsList>
          </div>

          {/* ==================== TABS CONTENT: ROOMS ==================== */}
          <TabsContent value="rooms" className="space-y-6 mt-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="flex flex-1 items-center gap-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search rooms..."
                    value={roomSearch}
                    onChange={e => setRoomSearch(e.target.value)}
                    className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <Select value={roomFilterStatus} onValueChange={setRoomFilterStatus}>
                  <SelectTrigger className="w-[180px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="VACANT">VACANT</SelectItem>
                    <SelectItem value="BOOKED">BOOKED</SelectItem>
                    <SelectItem value="CHECKED IN">CHECKED IN</SelectItem>
                    <SelectItem value="RESERVED">RESERVED</SelectItem>
                    <SelectItem value="OUT OF ORDER">OUT OF ORDER</SelectItem>
                    <SelectItem value="CHECKED OUT">CHECKED OUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleOpenAddRoom} className="bg-primary hover:bg-primary/95 text-white font-medium px-5 rounded-xl shadow-md transition-all">
                <Plus className="h-4 w-4 mr-2" />
                Add Room
              </Button>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {['VACANT', 'BOOKED', 'CHECKED IN', 'RESERVED', 'OUT OF ORDER', 'CHECKED OUT'].map(st => {
                const count = rooms.filter(r => r.status === st).length;
                return (
                  <Card key={st} className="border border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{st}</p>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-200 mt-1">{count} room{count !== 1 && 's'}</p>
                      </div>
                      <span className={cn(
                        "h-3.5 w-3.5 rounded-full",
                        st === 'VACANT' && "bg-emerald-500",
                        st === 'BOOKED' && "bg-blue-500",
                        st === 'CHECKED IN' && "bg-amber-500",
                        st === 'RESERVED' && "bg-purple-500",
                        st === 'OUT OF ORDER' && "bg-rose-500",
                        st === 'CHECKED OUT' && "bg-slate-500"
                      )} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Rooms Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredRooms.map(room => (
                <Card key={room.id} className="relative overflow-hidden border border-slate-100 dark:border-slate-850 hover:shadow-xl transition-all duration-300 rounded-2xl group bg-white dark:bg-slate-900 flex flex-col justify-between">
                  <div className="absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r from-emerald-500 to-teal-500" />
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-150">Room {room.roomNumber}</h3>
                        <p className="text-xs text-slate-400 font-medium">{room.type}</p>
                      </div>
                      <Badge className={cn(
                        "px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wide",
                        room.status === 'VACANT' && "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450",
                        room.status === 'BOOKED' && "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-450",
                        room.status === 'CHECKED IN' && "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-450",
                        room.status === 'RESERVED' && "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/20 dark:text-purple-450",
                        room.status === 'OUT OF ORDER' && "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-450",
                        room.status === 'CHECKED OUT' && "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-950/20 dark:text-slate-450"
                      )}>
                        {room.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-medium flex items-center">
                          <User className="h-3.5 w-3.5 mr-1 text-slate-400" />
                          {room.maxOccupants} max
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="flex items-center">
                          <Building className="h-3.5 w-3.5 mr-1 text-slate-400" />
                          {room.floor}
                        </span>
                      </div>
                    </div>

                    {room.amenities && (
                      <p className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg line-clamp-1 border border-slate-100/50 flex items-center">
                        <Bed className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                        {room.amenities}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 rounded-b-2xl">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      KES {room.nightlyRate.toLocaleString()}<span className="text-xs text-slate-450 font-normal"> /night</span>
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEditRoom(room)} className="text-slate-650 hover:bg-slate-100 hover:text-slate-900 rounded-lg">
                        Edit →
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteRoom(room.id)} className="text-rose-600 hover:bg-rose-50 rounded-lg">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ==================== TABS CONTENT: ROOM SCHEDULES ==================== */}
          <TabsContent value="schedules" className="space-y-6 mt-4">
            {/* Calendar Header / Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevWeek} className="rounded-xl px-3 h-9">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <div className="relative">
                  <Input
                    type="date"
                    value={format(currentWeekStart, 'yyyy-MM-dd')}
                    onChange={e => e.target.value && setCurrentWeekStart(startOfWeek(new Date(e.target.value), { weekStartsOn: 1 }))}
                    className="h-9 px-3 rounded-xl text-xs bg-slate-50 border-slate-200 text-slate-700"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleNextWeek} className="rounded-xl px-3 h-9">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button onClick={handleGoToToday} className="bg-orange-500 hover:bg-orange-650 text-white rounded-xl px-4 h-9 font-medium">
                  Today
                </Button>
              </div>

              {/* Status Badges Legend */}
              <div className="flex flex-wrap items-center gap-2.5">
                {[
                  { label: 'VACANT', bgClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-400 border-emerald-200' },
                  { label: 'BOOKED', bgClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/35 dark:text-blue-400 border-blue-200' },
                  { label: 'CHECKED IN', bgClass: 'bg-amber-100 text-amber-850 dark:bg-amber-950/35 dark:text-amber-400 border-amber-200' },
                  { label: 'RESERVED', bgClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/35 dark:text-purple-400 border-purple-200' },
                  { label: 'OUT OF ORDER', bgClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/35 dark:text-rose-450 border-rose-200' },
                  { label: 'CHECKED OUT', bgClass: 'bg-slate-100 text-slate-800 dark:bg-slate-905 dark:text-slate-350 border-slate-200' }
                ].map(legend => (
                  <Badge key={legend.label} className={cn("px-2.5 py-1 text-[9px] font-bold rounded-lg border", legend.bgClass)}>
                    {legend.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Weekly Schedule Grid Table */}
            <Card className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-950/40 hover:bg-transparent">
                      <TableHead className="w-[150px] font-bold text-slate-500 uppercase tracking-wider text-xs border-r">ROOM</TableHead>
                      {daysOfWeek.map(day => (
                        <TableHead key={day.toISOString()} className={cn(
                          "text-center py-4 border-r font-bold text-xs uppercase tracking-wide text-slate-600",
                          format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && "border-b-2 border-b-blue-600 bg-blue-50/20"
                        )}>
                          <div>{format(day, 'EEE')}</div>
                          <div className="text-[10px] font-normal text-slate-400 mt-0.5">{format(day, 'd MMM')}</div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map(room => (
                      <TableRow key={room.id} className="border-b last:border-b-0 hover:bg-slate-50/30">
                        {/* Room Title Column */}
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200 border-r bg-slate-50/10 py-5">
                          <div className="text-sm">{room.roomNumber}</div>
                          <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">{room.type}</span>
                        </TableCell>

                        {/* Calendar Grid Cells */}
                        {daysOfWeek.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          // Find any booking overlapping this date for this room
                          const matchBooking = bookings.find(b =>
                            String(b.roomId) === String(room.id) &&
                            dateStr >= b.checkInDate &&
                            dateStr < b.checkOutDate
                          );

                          if (matchBooking) {
                            const isCheckedIn = matchBooking.status === 'CHECKED IN';
                            const isCheckedOut = matchBooking.status === 'CHECKED OUT';
                            return (
                              <TableCell
                                key={day.toISOString()}
                                onClick={() => handleOpenEditBooking(matchBooking)}
                                className={cn(
                                  "p-2 text-center border-r align-middle cursor-pointer transition-all hover:brightness-95",
                                  isCheckedIn && "bg-amber-100/40 hover:bg-amber-100/60 dark:bg-amber-955/25",
                                  isCheckedOut && "bg-slate-100/45 hover:bg-slate-100/75 dark:bg-slate-900/30",
                                  !isCheckedIn && !isCheckedOut && "bg-blue-100/30 hover:bg-blue-100/50 dark:bg-blue-955/25"
                                )}
                              >
                                <div className={cn(
                                  "rounded-xl p-3 h-full flex flex-col justify-center items-center gap-1 border shadow-xs transition-transform hover:scale-[1.02]",
                                  isCheckedIn && "bg-amber-150/70 border-amber-300 text-amber-900 dark:text-amber-400",
                                  isCheckedOut && "bg-slate-200 border-slate-300 text-slate-800 dark:text-slate-400",
                                  !isCheckedIn && !isCheckedOut && "bg-blue-150 border-blue-300 text-blue-900 dark:text-blue-450"
                                )}>
                                  <span className="text-[9px] font-bold uppercase tracking-wider block">
                                    {isCheckedIn ? 'IN' : isCheckedOut ? 'OUT' : 'BK'}
                                  </span>
                                  <span className="text-xs font-bold block truncate max-w-[110px]">
                                    {matchBooking.customerName.split(' ')[0]}
                                  </span>
                                </div>
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell
                              key={day.toISOString()}
                              onClick={() => handleOpenAddBooking(String(room.id), dateStr)}
                              className="p-2 text-center border-r align-middle cursor-pointer hover:bg-emerald-50/20"
                            >
                              <div className="bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200/50 rounded-xl p-3 text-emerald-850 hover:border-emerald-350 transition-all">
                                <span className="text-[8px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">Free</span>
                                <span className="text-xs font-bold block">VACANT</span>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TABS CONTENT: BOOKINGS & TRANSACTIONS ==================== */}
          <TabsContent value="bookings" className="space-y-6 mt-4">
            {/* Statistics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
                  <p className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-2">{stats.totalBookings} Transactions</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600">
                  <Grid className="h-6 w-6" />
                </div>
              </Card>

              <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Due</p>
                  <p className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-2">KES {stats.totalDue.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                  <DollarSign className="h-6 w-6" />
                </div>
              </Card>

              <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Paid</p>
                  <p className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-2">KES {stats.totalPaid.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600">
                  <CheckCircle className="h-6 w-6" />
                </div>
              </Card>

              <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-450 mt-2">KES {stats.outstanding.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-650">
                  <AlertCircle className="h-6 w-6" />
                </div>
              </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search guest, room..."
                    value={bookingSearch}
                    onChange={e => setBookingSearch(e.target.value)}
                    className="pl-9 bg-white dark:bg-slate-950 border-slate-200 rounded-xl"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-1 px-2.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-500">From:</span>
                  <Input
                    type="date"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                    className="h-7 w-32 bg-transparent border-none text-xs font-semibold focus-visible:ring-0 p-0"
                  />
                  <span className="text-xs font-semibold text-slate-500">To:</span>
                  <Input
                    type="date"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                    className="h-7 w-32 bg-transparent border-none text-xs font-semibold focus-visible:ring-0 p-0"
                  />
                  {(filterStartDate || filterEndDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterStartDate('');
                        setFilterEndDate('');
                      }}
                      className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <Select value={bookingFilterStatus} onValueChange={setBookingFilterStatus}>
                  <SelectTrigger className="w-[150px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl h-10">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="BOOKED">BOOKED</SelectItem>
                    <SelectItem value="CHECKED IN">CHECKED IN</SelectItem>
                    <SelectItem value="RESERVED">RESERVED</SelectItem>
                    <SelectItem value="CHECKED OUT">CHECKED OUT</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="border-emerald-350 text-emerald-700 bg-emerald-50/40 hover:bg-emerald-50 rounded-xl h-10 px-4 font-semibold gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" /> Print (.xlsx)
                </Button>
                <Button variant="outline" size="sm" className="border-blue-350 text-blue-700 bg-blue-50/40 hover:bg-blue-50 rounded-xl h-10 px-4 font-semibold gap-1.5">
                  <FileText className="h-4 w-4" /> Print (.pdf)
                </Button>
              </div>
              <Button onClick={() => handleOpenAddBooking()} className="bg-primary hover:bg-primary/95 text-white font-medium px-5 rounded-xl shadow-md transition-all">
                <Plus className="h-4 w-4 mr-2" />
                New Booking
              </Button>
            </div>

            {/* Bookings Table */}
            <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-950/40">
                      <TableHead className="w-[80px] font-bold text-xs uppercase text-slate-550">#</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">GUEST</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">ROOM</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">CHECK-IN</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">CHECK-OUT</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550 text-center">NIGHTS</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550 text-right">DUE (KES)</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550 text-right">PAID (KES)</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550 text-right">BALANCE</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">STATUS</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map(b => {
                      const roomObj = rooms.find(r => String(r.id) === String(b.roomId));
                      const pkgObj = packages.find(p => String(p.id) === String(b.packageId));
                      const rate = roomObj?.nightlyRate || 0;
                      const pkgAmt = pkgObj?.amount || 0;
                      const nights = Math.max(1, differenceInDays(new Date(b.checkOutDate), new Date(b.checkInDate)));
                      const due = (rate + pkgAmt) * nights - (b.discount || 0);
                      const balance = due - b.paidAmount;

                      return (
                        <TableRow key={b.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-slate-500">{b.transactionNumber}</TableCell>
                          <TableCell>
                            <div className="font-bold text-slate-800 dark:text-slate-100">{b.customerName}</div>
                            <span className="text-[11px] text-slate-450">{b.guestMobile}</span>
                          </TableCell>
                          <TableCell className="font-bold text-slate-700 dark:text-slate-200">
                            {roomObj ? roomObj.roomNumber : 'Unknown'}
                          </TableCell>
                          <TableCell className="text-slate-500 font-medium">
                            {format(new Date(b.checkInDate), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="text-slate-500 font-medium">
                            {format(new Date(b.checkOutDate), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-650">{nights}</TableCell>
                          <TableCell className="text-right font-semibold text-slate-700 dark:text-slate-200">
                            {due.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-650">
                            {b.paidAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-bold",
                            balance > 0 ? "text-rose-600" : "text-emerald-600"
                          )}>
                            {balance.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "px-2 py-0.5 text-[10px] font-bold rounded-lg uppercase",
                              b.status === 'CHECKED IN' && "bg-amber-100 text-amber-850 dark:bg-amber-950/20 dark:text-amber-450",
                              b.status === 'BOOKED' && "bg-blue-100 text-blue-850 dark:bg-blue-950/20 dark:text-blue-450",
                              b.status === 'CHECKED OUT' && "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-400"
                            )}>
                              {b.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => handleOpenEditBooking(b)} className="border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 px-3 h-8">
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredBookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="h-32 text-center text-slate-400">
                          No bookings found matching filter constraints.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TABS CONTENT: BILLING PACKAGES ==================== */}
          <TabsContent value="packages" className="space-y-6 mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search packages..."
                  className="pl-9 bg-white dark:bg-slate-950 border-slate-200 rounded-xl"
                />
              </div>
              <Button onClick={handleOpenAddPkg} className="bg-primary hover:bg-primary/95 text-white font-medium px-5 rounded-xl shadow-md transition-all">
                <Plus className="h-4 w-4 mr-2" />
                Add Package
              </Button>
            </div>

            <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-950/40">
                      <TableHead className="font-bold text-xs uppercase text-slate-550">PACKAGE NAME</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">DESCRIPTION</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550 text-right">AMOUNT (KES)</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">STATUS</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map(pkg => (
                      <TableRow key={pkg.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-800 dark:text-slate-100">{pkg.name}</TableCell>
                        <TableCell className="text-slate-500">{pkg.description}</TableCell>
                        <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">
                          {pkg.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase border",
                            pkg.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-250" : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            {pkg.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditPkg(pkg)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-3 h-8">
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== MODAL: ADD/EDIT ROOM ==================== */}
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-lg font-bold text-slate-855 dark:text-slate-100">
              {editingRoom ? 'Edit Guest Room' : 'Add Guest Room'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-450 mt-1">
              Provide necessary specs and rates for guest room
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 py-4">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-bold text-slate-550 uppercase">Room Number *</Label>
              <Input
                placeholder="e.g. 101"
                value={roomForm.roomNumber}
                onChange={e => setRoomForm(prev => ({ ...prev, roomNumber: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-bold text-slate-550 uppercase">Room Type *</Label>
              <Select value={roomForm.type} onValueChange={val => setRoomForm(prev => ({ ...prev, type: val }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Executive">Executive</SelectItem>
                  <SelectItem value="Deluxe">Deluxe</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-bold text-slate-550 uppercase">Nightly Rate (KES) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">KES</span>
                <Input
                  type="number"
                  value={roomForm.nightlyRate}
                  onChange={e => setRoomForm(prev => ({ ...prev, nightlyRate: Number(e.target.value) }))}
                  className="pl-11 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-550 uppercase">Max Occupants *</Label>
              <Input
                type="number"
                value={roomForm.maxOccupants}
                onChange={e => setRoomForm(prev => ({ ...prev, maxOccupants: Number(e.target.value) }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-550 uppercase">Floor</Label>
              <Input
                placeholder="e.g. Ground, 1st"
                value={roomForm.floor}
                onChange={e => setRoomForm(prev => ({ ...prev, floor: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-550 uppercase">Status</Label>
              <Input
                value={roomForm.status}
                readOnly
                className="bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 rounded-xl"
              />
            </div>

            <div className="md:col-span-3 flex items-center justify-between border-t border-b py-3 my-2">
              <div>
                <p className="text-sm font-bold text-slate-750 dark:text-slate-200">Active</p>
                <p className="text-[11px] text-slate-450">Determine if room is ready for occupancy listing</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={roomForm.active}
                  onCheckedChange={checked => setRoomForm(prev => ({ ...prev, active: checked }))}
                />
                <span className="text-xs font-bold text-slate-500">{roomForm.active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-3">
              <Label className="text-xs font-bold text-slate-550 uppercase">Amenities</Label>
              <Input
                placeholder="e.g. WiFi, Smart TV, AC, Mini Bar"
                value={roomForm.amenities}
                onChange={e => setRoomForm(prev => ({ ...prev, amenities: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5 md:col-span-3">
              <Label className="text-xs font-bold text-slate-550 uppercase">Description</Label>
              <textarea
                placeholder="Write summary description details..."
                value={roomForm.description}
                onChange={e => setRoomForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full min-h-[80px] rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-slate-950"
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)} className="rounded-xl px-5">
              Cancel
            </Button>
            <Button onClick={handleSaveRoom} className="bg-primary hover:bg-primary/95 text-white rounded-xl px-5 font-semibold">
              {editingRoom ? 'Save Changes' : 'Add Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: ADD/EDIT BILLING PACKAGE ==================== */}
      <Dialog open={isPkgDialogOpen} onOpenChange={setIsPkgDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-lg font-bold text-slate-850 dark:text-slate-100">
              {editingPkg ? 'Edit Billing Package' : 'Add Billing Package'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-550 uppercase">Package Name *</Label>
              <Input
                placeholder="e.g. Breakfast Package"
                value={pkgForm.name}
                onChange={e => setPkgForm(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-550 uppercase">Amount (KES) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">KES</span>
                <Input
                  type="number"
                  value={pkgForm.amount}
                  onChange={e => setPkgForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  className="pl-11 rounded-xl"
                />
              </div>
              <p className="text-[10px] text-slate-450 mt-1">Enter 0 for packages with no additional charge.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-550 uppercase">Description</Label>
              <textarea
                placeholder="Optional description..."
                value={pkgForm.description}
                onChange={e => setPkgForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full min-h-[80px] rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-slate-950"
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-sm font-bold text-slate-750 dark:text-slate-200">Status</p>
                <p className="text-[11px] text-slate-450">Active packages are selectable on new bookings</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={pkgForm.status === 'Active'}
                  onCheckedChange={checked => setPkgForm(prev => ({ ...prev, status: checked ? 'Active' : 'Inactive' }))}
                />
                <span className="text-xs font-bold text-slate-500">{pkgForm.status}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsPkgDialogOpen(false)} className="rounded-xl px-5">
              Cancel
            </Button>
            <Button onClick={handleSavePkg} className="bg-primary hover:bg-primary/95 text-white rounded-xl px-5 font-semibold">
              {editingPkg ? 'Save Changes' : 'Add Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: NEW ROOM BOOKING / EDIT TRANSACTION ==================== */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="border-b pb-4 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                {editingBooking ? `Transaction ${editingBooking.transactionNumber} - ${editingBooking.customerName}` : 'New Room Booking'}
              </DialogTitle>
            </div>
            {editingBooking && (
              <Badge className={cn(
                "px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase mr-6",
                editingBooking.status === 'CHECKED IN' && "bg-amber-100 text-amber-850 dark:bg-amber-955/20 dark:text-amber-450 border border-amber-250",
                editingBooking.status === 'BOOKED' && "bg-blue-100 text-blue-850 dark:bg-blue-955/20 dark:text-blue-450 border border-blue-250",
                editingBooking.status === 'CHECKED OUT' && "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border border-slate-200"
              )}>
                {editingBooking.status}
              </Badge>
            )}
          </DialogHeader>

          {/* Modal Tab Headers */}
          <div className="border-b pb-1">
            <Tabs value={bookingActiveTab} onValueChange={setBookingActiveTab} className="w-full">
              <TabsList className="bg-slate-50 dark:bg-slate-800 p-0.5 rounded-lg flex w-fit gap-1 border">
                <TabsTrigger value="details" className="rounded-md px-4 py-1.5 text-xs font-semibold">Booking Details</TabsTrigger>
                <TabsTrigger value="guests" className="rounded-md px-4 py-1.5 text-xs font-semibold">
                  Guest List <span className="ml-1 bg-slate-200 dark:bg-slate-750 px-1.5 py-0.5 rounded-full text-[10px]">{guestListInput.length}</span>
                </TabsTrigger>
                <TabsTrigger value="schedules" className="rounded-md px-4 py-1.5 text-xs font-semibold">
                  Nightly Schedules <span className="ml-1 bg-slate-200 dark:bg-slate-750 px-1.5 py-0.5 rounded-full text-[10px]">{editingBooking ? 1 : 0}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
            {/* Booking Details Tab Contents */}
            <div className="lg:col-span-2 space-y-4">
              {bookingActiveTab === 'details' && (
                <div className="space-y-4">
                  {editingBooking && (
                    <div className="p-3.5 bg-blue-50/50 dark:bg-blue-955/15 border border-blue-200 rounded-xl text-xs font-medium text-blue-750 dark:text-blue-400 flex items-center justify-between">
                      <span>Room and billing package are already allocated for this booking.</span>
                      <Button variant="link" size="sm" onClick={() => setBookingActiveTab('schedules')} className="text-blue-600 underline text-xs p-0 font-bold">
                        Go to Nightly Schedules
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Selection */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-550 uppercase">Customer <span className="text-red-500">*</span></Label>
                        <span className="text-[11px] text-blue-600 font-bold cursor-pointer hover:underline">Add New</span>
                      </div>
                      <Select
                        value={bookingForm.customerId}
                        onValueChange={val => setBookingForm(prev => ({ ...prev, customerId: val }))}
                        disabled={!!editingBooking}
                      >
                        <SelectTrigger className={cn("rounded-xl", !bookingForm.customerId && "border-red-400 focus:ring-red-200")}>
                          <SelectValue placeholder="select a customer..." />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!bookingForm.customerId && !editingBooking && (
                        <div className="mt-2 space-y-1">
                          <Label className="text-[10px] text-slate-400 uppercase font-semibold">Or enter New Guest Name</Label>
                          <Input
                            placeholder="Guest Name (e.g. John Doe)"
                            value={bookingForm.newGuestName}
                            onChange={e => setBookingForm(prev => ({ ...prev, newGuestName: e.target.value }))}
                            className="rounded-xl h-9 text-xs"
                          />
                        </div>
                      )}
                    </div>

                    {/* Guest Mobile */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Guest Mobile</Label>
                      <Input
                        placeholder="+254 7xx xxx xxx"
                        value={bookingForm.guestMobile}
                        onChange={e => setBookingForm(prev => ({ ...prev, guestMobile: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>

                    {/* Room Selector with Search */}
                    <div className="space-y-1.5 flex flex-col">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Room <span className="text-red-500">*</span></Label>
                      {editingBooking ? (
                        <Input
                          value={rooms.find(r => String(r.id) === String(bookingForm.roomId)) ? `Room ${rooms.find(r => String(r.id) === String(bookingForm.roomId))?.roomNumber} (${rooms.find(r => String(r.id) === String(bookingForm.roomId))?.type})` : 'Unknown Room'}
                          readOnly
                          className="bg-slate-50 dark:bg-slate-950 font-semibold h-10 rounded-xl"
                        />
                      ) : (
                        <Popover open={isRoomPopoverOpen} onOpenChange={setIsRoomPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isRoomPopoverOpen}
                              className="w-full justify-between rounded-xl font-normal text-left h-10 border-slate-200"
                            >
                              {bookingForm.roomId
                                ? `Room ${rooms.find(r => String(r.id) === String(bookingForm.roomId))?.roomNumber} (${rooms.find(r => String(r.id) === String(bookingForm.roomId))?.type})`
                                : "- Select a room -"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] p-0 rounded-xl shadow-xl bg-white dark:bg-slate-900 border" align="start">
                            <Command className="bg-white dark:bg-slate-900">
                              <CommandInput placeholder="Search room number or type..." className="h-9 border-none focus:ring-0" />
                              <CommandList className="max-h-[200px] overflow-y-auto">
                                <CommandEmpty>No available rooms found.</CommandEmpty>
                                <CommandGroup>
                                  {availableRooms.map((r) => (
                                    <CommandItem
                                      key={r.id}
                                      value={`${r.roomNumber} ${r.type}`}
                                      onSelect={() => {
                                        setBookingForm(prev => ({ ...prev, roomId: String(r.id) }));
                                        setIsRoomPopoverOpen(false);
                                      }}
                                      className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-2 text-xs"
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <div>
                                          <span className="font-bold text-slate-800 dark:text-slate-200">Room {r.roomNumber}</span>
                                          <span className="text-[11px] text-slate-400 ml-2">({r.type})</span>
                                        </div>
                                        <span className="font-semibold text-xs text-slate-600 dark:text-slate-450">KES {r.nightlyRate.toLocaleString()}/night</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    {/* Package Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Billing Package <span className="text-red-500">*</span></Label>
                      <Select
                        value={bookingForm.packageId}
                        onValueChange={val => setBookingForm(prev => ({ ...prev, packageId: val }))}
                        disabled={!!editingBooking}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="- Select a package -" />
                        </SelectTrigger>
                        <SelectContent>
                          {packages.filter(p => p.status === 'Active' || String(p.id) === String(bookingForm.packageId)).map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name} (+ KES {p.amount.toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Check In Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Check-In Date *</Label>
                      <Input
                        type="date"
                        value={bookingForm.checkInDate}
                        onChange={e => setBookingForm(prev => ({ ...prev, checkInDate: e.target.value }))}
                        disabled={!!editingBooking}
                        className="rounded-xl"
                      />
                    </div>

                    {/* Check Out Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Check-Out Date *</Label>
                      <Input
                        type="date"
                        value={bookingForm.checkOutDate}
                        onChange={e => setBookingForm(prev => ({ ...prev, checkOutDate: e.target.value }))}
                        disabled={!!editingBooking}
                        className="rounded-xl"
                      />
                    </div>

                    {/* Reservation Type */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Reservation Type</Label>
                      <Select
                        value={bookingForm.reservationType}
                        onValueChange={val => setBookingForm(prev => ({ ...prev, reservationType: val }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Room Booking" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Room Booking">Room Booking</SelectItem>
                          <SelectItem value="Conference">Conference</SelectItem>
                          <SelectItem value="Event">Event</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Children count */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">No. of Children</Label>
                      <Input
                        type="number"
                        value={bookingForm.noOfChildren}
                        onChange={e => setBookingForm(prev => ({ ...prev, noOfChildren: Number(e.target.value) }))}
                        className="rounded-xl"
                      />
                    </div>

                    {/* Check-In Checkbox */}
                    <div className="flex items-center gap-3 py-4">
                      <input
                        type="checkbox"
                        id="chk_checked_in"
                        checked={bookingForm.checkedIn}
                        onChange={e => setBookingForm(prev => ({ ...prev, checkedIn: e.target.checked }))}
                        className="h-5 w-5 rounded-md border-slate-300 text-primary focus:ring-primary accent-primary"
                      />
                      <Label htmlFor="chk_checked_in" className="text-sm font-bold text-emerald-600 cursor-pointer">
                        Guest has Checked In
                      </Label>
                    </div>
                  </div>

                  {/* Payment and Discount section */}
                  <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Payment Method</Label>
                      <Select
                        value={bookingForm.paymentMethod}
                        onValueChange={val => setBookingForm(prev => ({ ...prev, paymentMethod: val }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="CASH" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">CASH</SelectItem>
                          <SelectItem value="MPESA">MPESA</SelectItem>
                          <SelectItem value="CARD">CARD</SelectItem>
                          <SelectItem value="BANK TRANSFER">BANK TRANSFER</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Paid Amount (KES)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">KES</span>
                        <Input
                          type="number"
                          value={bookingForm.paidAmount}
                          onChange={e => setBookingForm(prev => ({ ...prev, paidAmount: Number(e.target.value) }))}
                          className="pl-11 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-550 uppercase">Discount (KES)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">KES</span>
                        <Input
                          type="number"
                          value={bookingForm.discount}
                          onChange={e => setBookingForm(prev => ({ ...prev, discount: Number(e.target.value) }))}
                          className="pl-11 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {bookingForm.paymentMethod === 'MPESA' && bookingForm.paidAmount > 0 && (
                    <div className="mt-4 p-4 border border-blue-105 rounded-xl bg-blue-50/50 dark:bg-blue-955/10 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="space-y-0.5">
                          <Label htmlFor="toggle-stk" className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">Use M-Pesa STK Push</Label>
                          <p className="text-[10px] text-slate-450">Send a prompt directly to guest phone</p>
                        </div>
                        <Switch
                          id="toggle-stk"
                          checked={useStkPush}
                          onCheckedChange={setUseStkPush}
                        />
                      </div>

                      {useStkPush ? (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="space-y-1.5 flex-1">
                              <Label className="text-xs font-bold text-slate-550 uppercase">M-Pesa Phone Number *</Label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="e.g. 07XXXXXXXX"
                                  value={mpesaPhone}
                                  onChange={e => setMpesaPhone(e.target.value)}
                                  className="rounded-xl flex-1"
                                  disabled={isPollingMpesa}
                                />
                                <Button
                                  onClick={handleMpesaStkPush}
                                  disabled={isPollingMpesa}
                                  className="bg-green-650 hover:bg-green-750 text-white rounded-xl h-10 px-4 font-semibold text-xs shrink-0"
                                >
                                  {isPollingMpesa ? 'Sending...' : 'STK Push'}
                                </Button>
                              </div>
                            </div>
                            {(isPollingMpesa || mpesaStatus !== 'IDLE') && (
                              <div className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl ${
                                mpesaStatus === 'PENDING' ? 'text-blue-600 animate-pulse bg-blue-50 dark:bg-blue-950/20' :
                                mpesaStatus === 'SUCCESS' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' :
                                mpesaStatus === 'CANCELLED' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' :
                                'text-rose-600 bg-rose-50 dark:bg-rose-950/20'
                              }`}>
                                <span>
                                  {mpesaStatus === 'PENDING' && 'Waiting...'}
                                  {mpesaStatus === 'SUCCESS' && 'Confirmed!'}
                                  {mpesaStatus === 'CANCELLED' && 'Cancelled'}
                                  {mpesaStatus === 'FAILED' && 'Failed'}
                                </span>
                                {mpesaStatus !== 'SUCCESS' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 rounded-lg text-xs"
                                    onClick={() => checkoutRequestId && manualQueryMpesa(checkoutRequestId)}
                                    disabled={isPollingMpesa}
                                  >
                                    {isPollingMpesa ? 'Checking...' : 'Check Again'}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-450">
                            Entering a phone number and clicking "STK Push" will request payment confirmation on the guest's phone.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                          <Label className="text-xs font-bold text-slate-550 uppercase">M-Pesa Reference Code *</Label>
                          <Input
                            placeholder="e.g. SGH537HJKD"
                            value={manualMpesaRef}
                            onChange={e => setManualMpesaRef(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Guest List Tab Contents */}
              {bookingActiveTab === 'guests' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Enter other guest name..."
                      value={newGuestNameInput}
                      onChange={e => setNewGuestNameInput(e.target.value)}
                      className="rounded-xl flex-1"
                    />
                    <Button onClick={handleAddGuestToBooking} className="bg-primary hover:bg-primary/95 text-white rounded-xl">
                      Add Guest
                    </Button>
                  </div>

                  <div className="border border-slate-100 rounded-xl bg-slate-50 dark:bg-slate-950/45 p-4 min-h-[200px]">
                    <h4 className="text-xs font-bold text-slate-455 uppercase mb-3 tracking-wider">Occupant Guest List</h4>
                    {guestListInput.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-10">No additional guests registered under this transaction.</p>
                    ) : (
                      <div className="space-y-2">
                        {guestListInput.map((guest, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border rounded-lg shadow-xs">
                            <span className="text-xs font-semibold text-slate-750 dark:text-slate-255">{guest}</span>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveGuestFromBooking(idx)} className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 rounded-lg">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Nightly Schedules Tab Contents */}
              {bookingActiveTab === 'schedules' && (
                <div className="space-y-4">
                  <div className="p-4 border border-dashed rounded-xl bg-slate-50 dark:bg-slate-950/20 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-bold text-slate-450 uppercase">Allocated Schedule Grid</span>
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const checkInDate = new Date(bookingForm.checkInDate);
                        const checkOutDate = new Date(bookingForm.checkOutDate);
                        const days = Math.max(1, differenceInDays(checkOutDate, checkInDate));
                        const items = [];
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
                        return items;
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Billing Summary Side Panel */}
            <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-955/25 flex flex-col justify-between h-full space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Billing Summary</h3>

                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-center text-slate-550">
                    <span>Room Rate</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">KES {bookingSummary.roomRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center text-slate-550">
                    <span>Package ({packages.find(p => String(p.id) === String(bookingForm.packageId))?.name || 'NONE'})</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">KES {bookingSummary.packageRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center border-t border-dashed pt-2.5 text-slate-550">
                    <span>Nightly Total</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">KES {bookingSummary.nightlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center text-slate-550">
                    <span>x {bookingSummary.nights} night(s)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">KES {(bookingSummary.nightlyTotal * bookingSummary.nights).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {bookingForm.discount > 0 && (
                    <div className="flex justify-between items-center text-rose-600 font-semibold">
                      <span>Discount (-)</span>
                      <span>KES {bookingForm.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t border-slate-200 pt-3 text-sm font-bold">
                    <span className="text-blue-650">Due Amount</span>
                    <span className="text-blue-650">KES {bookingSummary.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center border-t pt-2.5 text-xs text-emerald-650 font-semibold">
                    <span>Amount Paid</span>
                    <span>KES {bookingForm.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons inside Booking Modal */}
              <div className="space-y-2.5 pt-4 border-t">
                {editingBooking ? (
                  <>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handlePrintReceipt} className="border-slate-350 text-slate-700 bg-white hover:bg-slate-50 flex-1 rounded-xl h-10 font-bold gap-1 text-xs">
                        <Printer className="h-4 w-4" /> Print Receipt
                      </Button>
                      {editingBooking.status === 'CHECKED IN' && (
                        <Button onClick={() => handleCheckoutBooking(editingBooking.id)} className="bg-orange-500 hover:bg-orange-655 text-white flex-1 rounded-xl h-10 font-bold text-xs">
                          Check Out
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={() => handleDeleteBooking(editingBooking.id)} className="bg-red-650 hover:bg-red-750 text-white rounded-xl h-10 font-bold text-xs flex-1">
                        Delete Booking
                      </Button>
                      <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)} className="rounded-xl h-10 font-bold text-xs flex-1">
                        Cancel
                      </Button>
                    </div>
                    <Button onClick={handleSaveBooking} className="w-full bg-primary hover:bg-primary/95 text-white rounded-xl h-11 font-bold text-xs">
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)} className="rounded-xl h-10 font-bold text-xs flex-1">
                        Cancel
                      </Button>
                      <Button onClick={handleSaveBooking} className="bg-primary hover:bg-primary/95 text-white rounded-xl h-10 font-bold text-xs flex-1">
                        Save Booking
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: COMPLETE CHECKOUT SPLIT PAYMENT ==================== */}
      <Dialog open={isCheckoutPaymentDialogOpen} onOpenChange={setIsCheckoutPaymentDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Complete Checkout Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Booking Ref: {checkoutBooking?.transactionNumber} | Guest: {checkoutBooking?.customerName}
            </DialogDescription>
          </DialogHeader>

          {/* Payment Method Split Selection */}
          <div className="space-y-4 py-4">
            <Label className="text-xs font-bold text-slate-550 uppercase">Select Payment Methods</Label>

            {(['cash', 'card', 'mpesa', 'bank'] as const).map((method) => {
              const isActive = checkoutPayments[method].active;
              return (
                <div key={method} className="space-y-3 border rounded-xl p-3 bg-slate-50/50 dark:bg-slate-955/10">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`chk-checkout-pay-${method}`}
                      checked={isActive}
                      onChange={(e) => {
                        setCheckoutPayments(prev => ({
                          ...prev,
                          [method]: { ...prev[method], active: e.target.checked }
                        }));
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary accent-primary"
                    />
                    <Label htmlFor={`chk-checkout-pay-${method}`} className="capitalize flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">
                      {method === 'cash' && <Banknote className="h-4 w-4 text-slate-400" />}
                      {method === 'card' && <CreditCard className="h-4 w-4 text-slate-400" />}
                      {method === 'mpesa' && <Smartphone className="h-4 w-4 text-slate-400" />}
                      {method === 'bank' && <DollarSign className="h-4 w-4 text-slate-400" />}
                      {method === 'mpesa' ? 'M-PESA' : method === 'bank' ? 'BANK TRANSFER' : method}
                    </Label>
                  </div>

                  {isActive && (
                    <div className="grid grid-cols-2 gap-3 pl-6 animate-in fade-in slide-in-from-top-1">
                      <div className="space-y-1">
                        <Label htmlFor={`checkout-amount-${method}`} className="text-[10px] font-bold text-slate-550">Amount (KES)</Label>
                        <Input
                          id={`checkout-amount-${method}`}
                          type="number"
                          value={checkoutPayments[method].amount}
                          onChange={(e) => {
                            setCheckoutPayments(prev => ({
                              ...prev,
                              [method]: { ...prev[method], amount: e.target.value }
                            }));
                          }}
                          placeholder="0.00"
                          className="h-9 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`checkout-ref-${method}`} className="text-[10px] font-bold text-slate-550">
                          {method === 'mpesa' ? 'M-Pesa Phone' : 'Reference (Optional)'}
                        </Label>
                        {method === 'mpesa' ? (
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              value={mpesaPhone}
                              onChange={(e) => setMpesaPhone(e.target.value)}
                              placeholder="07..."
                              className="h-9 rounded-lg flex-1"
                              disabled={isPollingMpesa}
                            />
                            <Button
                              size="sm"
                              className="h-9 bg-green-650 hover:bg-green-750 text-white rounded-lg px-3 text-xs"
                              onClick={handleCheckoutMpesaPush}
                              disabled={isPollingMpesa}
                            >
                              {isPollingMpesa ? '...' : 'Push'}
                            </Button>
                          </div>
                        ) : (
                          <Input
                            id={`checkout-ref-${method}`}
                            type="text"
                            value={checkoutPayments[method].reference}
                            onChange={(e) => {
                              setCheckoutPayments(prev => ({
                                ...prev,
                                [method]: { ...prev[method], reference: e.target.value }
                              }));
                            }}
                            placeholder="Ref #"
                            className="h-9 rounded-lg"
                          />
                        )}
                      </div>
                      {method === 'mpesa' && (isPollingMpesa || mpesaStatus !== 'IDLE') && (
                        <div className="col-span-2 py-1">
                          <div className={`flex items-center gap-2 text-xs font-semibold ${
                            mpesaStatus === 'PENDING' ? 'text-blue-600 animate-pulse' :
                            mpesaStatus === 'SUCCESS' ? 'text-green-600' :
                            mpesaStatus === 'CANCELLED' ? 'text-amber-600' :
                            'text-red-600'
                          }`}>
                            <span>
                              {mpesaStatus === 'PENDING' && 'Waiting for M-Pesa...'}
                              {mpesaStatus === 'SUCCESS' && 'Confirmed!'}
                              {mpesaStatus === 'CANCELLED' && 'Cancelled'}
                              {mpesaStatus === 'FAILED' && 'Failed'}
                            </span>
                            {mpesaStatus !== 'SUCCESS' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => checkoutRequestId && manualQueryMpesa(checkoutRequestId)}
                                disabled={isPollingMpesa}
                              >
                                {isPollingMpesa ? 'Checking...' : 'Check Again'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsCheckoutPaymentDialogOpen(false)} className="rounded-xl px-5">
              Cancel
            </Button>
            <Button onClick={handleCompleteCheckoutPayment} className="bg-primary hover:bg-primary/95 text-white rounded-xl px-5 font-semibold">
              Confirm Checkout & Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
