import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/formatters';

export function Notifications() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.notifications.getPreferences(),
  });

  const mutation = useMutation({
    mutationFn: (next: { emailEnabled: boolean; consent: boolean }) => api.notifications.updatePreferences(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  const enabled = data?.emailEnabled ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
        <p className="text-muted-foreground">
          Keep email alerts for transfers and account activity aligned with your consent settings.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email alerts
          </CardTitle>
          <div className="rounded-full bg-muted px-3 py-1 text-sm">
            {enabled ? 'Enabled' : 'Disabled'}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-medium">Email notifications</div>
                  <div className="text-sm text-muted-foreground">
                    {enabled ? 'You are currently receiving email notifications.' : 'Email notifications are currently off.'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant={enabled ? 'secondary' : 'default'}
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      emailEnabled: !enabled,
                      consent: !enabled,
                    })
                  }
                >
                  {enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ShieldCheck className="h-4 w-4" />
                    Consent status
                  </div>
                  <div className="text-lg font-semibold">{enabled ? 'Consent active' : 'Consent not active'}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="mb-2 text-sm font-medium text-muted-foreground">Last change</div>
                  <div className="text-lg font-semibold">
                    {data?.consentedAt ? formatDate(data.consentedAt) : 'Not set'}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
