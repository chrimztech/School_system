import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, Box, Button, Paper, Stack, TextField, Typography, InputAdornment } from "@mui/material";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/change-password")({
  head: () => ({ meta: [{ title: "Change password — SRMS" }] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, markPasswordChanged } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const required = Boolean(user?.mustChangePassword);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.auth.changePassword(current, next);
      markPasswordChanged();
      toast.success("Password changed successfully");
      setCurrent("");
      setNext("");
      setConfirm("");
      void navigate({ to: "/" });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(data?.message ?? "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", px: 2, bgcolor: "background.default" }}>
      <Paper elevation={2} sx={{ p: { xs: 3.5, sm: 4 }, borderRadius: 5, maxWidth: 420, width: "100%" }}>
        <Stack spacing={1} sx={{ mb: 3, alignItems: "center", textAlign: "center", color: "primary.main" }}>
          <ShieldCheck className="h-8 w-8" />
          <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
            Set a new password
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {required
              ? "For security, you must set a new password before continuing."
              : "Update your account password."}
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={submit}>
          <Stack spacing={2}>
            <TextField
              label="Current password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
              fullWidth
              disabled={loading}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock size={16} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="New password"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
              fullWidth
              disabled={loading}
              helperText="At least 8 characters"
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              fullWidth
              disabled={loading}
            />
            <Button type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? "Saving…" : "Change password"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
