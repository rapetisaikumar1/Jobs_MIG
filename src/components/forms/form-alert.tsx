import { Alert } from "@/components/ui/alert";

export function FormAlert({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return <Alert variant="error">{error}</Alert>;
  if (success) return <Alert variant="success">{success}</Alert>;
  return null;
}
