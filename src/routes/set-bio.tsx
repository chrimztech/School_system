import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, TextField, Typography, Box, Paper, Stack, Alert } from "@mui/material";

import { useAuth } from "@/lib/auth";
import { parentProfileNeedsCompletion } from "@/lib/auth-navigation";
import { api } from "@/lib/api";

export const Route = createFileRoute("/set-bio")({
  head: () => ({ meta: [{ title: "Complete your profile — SRMS" }] }),
  component: SetBioPage,
});

function SetBioPage() {
  const { user, markProfileCompleted } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(parentProfileNeedsCompletion(user) ? "" : (user?.name ?? ""));
  const [bio, setBio] = useState(user?.bio ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Full name is required");
      return;
    }
    setLoading(true);
    try {
      const updatedUser = await api.auth.updateMe({ name: name.trim(), bio: bio.trim() });
      markProfileCompleted(updatedUser.name, updatedUser.bio);
      toast.success("Profile updated successfully");
      void navigate({ to: "/" });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(data?.message ?? "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", px: 2, bgcolor: "background.default" }}>
      <Paper elevation={2} sx={{ p: { xs: 3.5, sm: 4 }, borderRadius: 5, maxWidth: 420, width: "100%" }}>
        <Stack spacing={1} sx={{ mb: 3, alignItems: "center", textAlign: "center", color: "primary.main" }}>
          <UserCircle className="h-8 w-8" />
          <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
            Complete your profile
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We don't have your name on file. Complete your details to continue to the parent portal.
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
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
              helperText="This is how you'll appear across the platform"
              slotProps={{ htmlInput: { maxLength: 120, autoComplete: "name" } }}
            />
            <TextField
              label="Bio (optional)"
              multiline
              minRows={3}
              maxRows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              fullWidth
              disabled={loading}
              placeholder="A short description about yourself..."
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            <Button type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? "Saving…" : "Save profile"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
