import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/shared/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm, ProfileDetailsForm } from "@/components/admin/profile-forms";
import { fullName } from "@/lib/format";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSION_DESCRIPTIONS, PERMISSION_GROUPS } from "@/modules/access-control/permissions";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfilePage() {
  const ctx = await requireStaff();
  const { user } = ctx;
  const name = fullName(user);
  // What the user's roles allow, grouped like the role editor. Read-only: no links to settings.
  const access = PERMISSION_GROUPS
    .map((group) => ({ label: group.label, items: group.permissions.filter((p) => ctx.can(p)).map((p) => PERMISSION_DESCRIPTIONS[p]) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={name} size="md" />Profile settings</span>}
        description="Your name, password and access."
      />

      <Card>
        <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
        <CardContent>
          <ProfileDetailsForm email={user.email} defaultValues={{ firstName: user.firstName, lastName: user.lastName }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Enter your current password, then choose a new one.</CardDescription>
        </CardHeader>
        <CardContent><ChangePasswordForm email={user.email} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
          <CardDescription>Your roles decide what you can do. Contact a Super Admin if you need different access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ctx.roleNames.length === 1 ? "Role" : "Roles"}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ctx.roleNames.length ? ctx.roleNames.map((role) => <Badge key={role} tone="outline">{role}</Badge>) : <span className="text-sm text-muted-foreground">No role</span>}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What you can do</p>
            {access.length ? (
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                {access.map((group) => (
                  <div key={group.label}>
                    <p className="text-sm font-semibold">{group.label}</p>
                    <ul className="mt-1.5 space-y-1">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">Your roles don&apos;t grant any extra permissions. You can see the jobs you created.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
