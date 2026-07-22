import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

import { Button } from "@mui/material";
import { api } from "@/lib/api";

export const Route = createFileRoute("/payment-result")({
  head: () => ({ meta: [{ title: "Payment result — SRMS" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    // ZynlePay's exact redirect query param isn't documented — check the common names defensively.
    referenceNo: (search.reference_no ?? search.referenceNo ?? search.ref ?? "") as string,
  }),
  component: PaymentResultPage,
});

function PaymentResultPage() {
  const { referenceNo } = Route.useSearch();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["payment-result", referenceNo],
    queryFn: () => api.fees.publicPaymentStatus(referenceNo),
    enabled: !!referenceNo,
    refetchInterval: (query) => (query.state.data && (query.state.data as any).status === "pending" ? 4000 : false),
  });

  const status = (data as any)?.status;

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        {!referenceNo ? (
          <>
            <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-lg font-semibold">No payment reference found</h1>
            <p className="mt-1 text-sm text-muted-foreground">If you just completed a payment, check your dashboard for the updated fee balance.</p>
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
            <h1 className="mt-4 text-lg font-semibold">Checking payment status…</h1>
          </>
        ) : isError ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-lg font-semibold">Could not verify payment</h1>
            <p className="mt-1 text-sm text-muted-foreground">Please check your dashboard for the current fee balance, or contact the school bursar.</p>
          </>
        ) : status === "completed" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-4 text-lg font-semibold">Payment successful</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              K {Number((data as any).amount ?? 0).toLocaleString()} received for {(data as any).studentName}.
            </p>
          </>
        ) : status === "failed" ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-lg font-semibold">Payment failed</h1>
            <p className="mt-1 text-sm text-muted-foreground">The transaction was not completed. You can try again from your dashboard.</p>
          </>
        ) : (
          <>
            <Clock className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-4 text-lg font-semibold">Payment pending</h1>
            <p className="mt-1 text-sm text-muted-foreground">We're still waiting for confirmation from the payment provider. This page will update automatically.</p>
          </>
        )}
        <Button component={Link} to="/" variant="contained" sx={{ mt: 3 }}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
