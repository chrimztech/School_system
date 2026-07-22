import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab } from "@mui/material";
import { api } from "@/lib/api";

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function createCardForm(student: any) {
  const { firstName, lastName } = splitName(student.guardian || student.guardianName || `${student.firstName ?? ""} ${student.lastName ?? ""}`);
  return {
    firstName,
    lastName,
    email: student.guardianEmail || "",
    phone: student.guardianPhone || "",
    address: student.guardianAddress || student.address || "",
    city: student.city || "",
    state: student.city || "",
    zipCode: "00000",
    amount: String(Number(student.feeBalance ?? 0) || ""),
  };
}

function createMomoForm(student: any) {
  return {
    phone: student.guardianPhone || "",
    amount: String(Number(student.feeBalance ?? 0) || ""),
  };
}

export function PaymentDialog({
  schoolId,
  student,
  open,
  onOpenChange,
}: {
  schoolId: string;
  student: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [cardForm, setCardForm] = useState(() => createCardForm(student));
  const [momoForm, setMomoForm] = useState(() => createMomoForm(student));
  const [momoPaymentId, setMomoPaymentId] = useState<string | null>(null);
  const [tab, setTab] = useState("card");

  useEffect(() => {
    if (open) {
      setCardForm(createCardForm(student));
      setMomoForm(createMomoForm(student));
      setMomoPaymentId(null);
      setTab("card");
    }
  }, [open, student]);

  const initiateCardMutation = useMutation({
    mutationFn: (data: any) => api.fees.initiateCardPayment(schoolId, student.id, data),
    onSuccess: (result: any) => {
      if (!result?.redirectUrl) {
        toast.error("Payment gateway did not return a checkout link");
        return;
      }
      window.location.href = result.redirectUrl;
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Could not start card payment"),
  });

  const initiateMomoMutation = useMutation({
    mutationFn: (data: any) => api.fees.initiateMomoPayment(schoolId, student.id, data),
    onSuccess: (result: any) => {
      if (!result?.paymentId) {
        toast.error("Payment gateway did not confirm the request");
        return;
      }
      setMomoPaymentId(result.paymentId);
      toast.success("Check your phone to approve the payment");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Could not start mobile money payment"),
  });

  const { data: momoStatus } = useQuery({
    queryKey: ["momo-payment-status", schoolId, momoPaymentId],
    queryFn: () => api.fees.paymentStatus(schoolId, momoPaymentId as string),
    enabled: !!momoPaymentId,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      return status === "pending" ? 4000 : false;
    },
  });

  const submitCard = () => {
    const amount = Number(cardForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!cardForm.firstName.trim() || !cardForm.lastName.trim() || !cardForm.email.trim() || !cardForm.phone.trim()) {
      toast.error("Name, email and phone are required");
      return;
    }
    initiateCardMutation.mutate({
      amount,
      firstName: cardForm.firstName.trim(),
      lastName: cardForm.lastName.trim(),
      email: cardForm.email.trim(),
      phone: cardForm.phone.trim(),
      address: cardForm.address.trim() || "Not provided",
      city: cardForm.city.trim() || "Lusaka",
      state: cardForm.state.trim() || cardForm.city.trim() || "Lusaka",
      zipCode: cardForm.zipCode.trim() || "00000",
    });
  };

  const submitMomo = () => {
    const amount = Number(momoForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!momoForm.phone.trim()) {
      toast.error("Enter the mobile money phone number");
      return;
    }
    initiateMomoMutation.mutate({ amount, phoneNumber: momoForm.phone.trim() });
  };

  const fullName = [student.firstName, student.lastName].filter(Boolean).join(" ");
  const momoState: "idle" | "pending" | "completed" | "failed" = !momoPaymentId
    ? "idle"
    : (momoStatus as any)?.status === "completed"
      ? "completed"
      : (momoStatus as any)?.status === "failed"
        ? "failed"
        : "pending";

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Pay fees for {fullName}</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="fullWidth" sx={{ mb: 2 }}>
          <Tab value="card" icon={<CreditCard size={14} />} iconPosition="start" label="Card" />
          <Tab value="momo" icon={<Smartphone size={14} />} iconPosition="start" label="Mobile Money" />
        </Tabs>

        {tab === "card" && (
          <div className="space-y-3 pt-3">
            <TextField
              label="Amount (K) *"
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              value={cardForm.amount}
              onChange={(e) => setCardForm({ ...cardForm, amount: e.target.value })}
              fullWidth
              size="small"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="First name *"
                value={cardForm.firstName}
                onChange={(e) => setCardForm({ ...cardForm, firstName: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 50 } }}
                fullWidth
                size="small"
              />
              <TextField
                label="Last name *"
                value={cardForm.lastName}
                onChange={(e) => setCardForm({ ...cardForm, lastName: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 50 } }}
                fullWidth
                size="small"
              />
            </div>
            <TextField
              label="Email *"
              type="email"
              value={cardForm.email}
              onChange={(e) => setCardForm({ ...cardForm, email: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 100 } }}
              fullWidth
              size="small"
            />
            <TextField
              label="Phone *"
              value={cardForm.phone}
              onChange={(e) => setCardForm({ ...cardForm, phone: e.target.value })}
              placeholder="+260 977 000 000"
              slotProps={{ htmlInput: { maxLength: 20 } }}
              fullWidth
              size="small"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="City"
                value={cardForm.city}
                onChange={(e) => setCardForm({ ...cardForm, city: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 50 } }}
                fullWidth
                size="small"
              />
              <TextField
                label="Address"
                value={cardForm.address}
                onChange={(e) => setCardForm({ ...cardForm, address: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 150 } }}
                fullWidth
                size="small"
              />
            </div>
            <p className="text-xs text-muted-foreground">You'll be redirected to a secure ZynlePay page to enter your card details.</p>
            <DialogActions sx={{ mt: 2, px: 0 }}>
              <Button variant="outlined" color="inherit" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="contained" onClick={submitCard} disabled={initiateCardMutation.isPending}>
                {initiateCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to payment
              </Button>
            </DialogActions>
          </div>
        )}

        {tab === "momo" && (
          <div className="space-y-3 pt-3">
            {momoState === "idle" && (
              <>
                <TextField
                  label="Amount (K) *"
                  type="number"
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={momoForm.amount}
                  onChange={(e) => setMomoForm({ ...momoForm, amount: e.target.value })}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Mobile money number *"
                  value={momoForm.phone}
                  onChange={(e) => setMomoForm({ ...momoForm, phone: e.target.value })}
                  placeholder="+260 977 000 000"
                  slotProps={{ htmlInput: { maxLength: 20 } }}
                  fullWidth
                  size="small"
                />
                <p className="text-xs text-muted-foreground">You'll get a prompt on this phone to approve the payment.</p>
                <DialogActions sx={{ mt: 2, px: 0 }}>
                  <Button variant="outlined" color="inherit" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button variant="contained" onClick={submitMomo} disabled={initiateMomoMutation.isPending}>
                    {initiateMomoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send payment request
                  </Button>
                </DialogActions>
              </>
            )}
            {momoState === "pending" && (
              <div className="py-6 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Waiting for approval on {momoForm.phone}</p>
                <p className="mt-1 text-xs text-muted-foreground">Enter your mobile money PIN on your phone to confirm. This page updates automatically.</p>
                <Button variant="outlined" size="small" sx={{ mt: 2 }} onClick={() => onOpenChange(false)}>Close and check later</Button>
              </div>
            )}
            {momoState === "completed" && (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-3 text-sm font-medium">Payment received</p>
                <Button variant="contained" size="small" sx={{ mt: 2 }} onClick={() => onOpenChange(false)}>Done</Button>
              </div>
            )}
            {momoState === "failed" && (
              <div className="py-6 text-center">
                <XCircle className="mx-auto h-8 w-8 text-destructive" />
                <p className="mt-3 text-sm font-medium">Payment failed or was declined</p>
                <Button size="small" variant="outlined" sx={{ mt: 2 }} onClick={() => setMomoPaymentId(null)}>Try again</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

