import { UserRound } from "lucide-react";
import { Autocomplete, TextField, InputAdornment, Typography, Box } from "@mui/material";

export type PersonOption = { id: string; label: string; sublabel?: string };

/**
 * Searchable picker for selecting a real Student/Teacher/User record instead of typing
 * a name freehand. Purely presentational — callers own the option list and what happens
 * on selection (e.g. auto-filling other form fields).
 */
export function PersonCombobox({
  options,
  onSelect,
  placeholder = "Search…",
  emptyText = "No matches.",
  loading = false,
  disabled = false,
}: {
  options: PersonOption[];
  onSelect: (option: PersonOption) => void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Autocomplete
      options={options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      loading={loading}
      disabled={disabled}
      noOptionsText={emptyText}
      value={null}
      onChange={(_event, value) => {
        if (value) onSelect(value);
      }}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Typography variant="body2">{option.label}</Typography>
            {option.sublabel && (
              <Typography variant="caption" color="text.secondary">
                {option.sublabel}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder={loading ? "Loading…" : placeholder}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <UserRound size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );
}
