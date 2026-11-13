import { LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const controls = [
  {
    title: 'Customer-scoped access',
    description: 'Every request is bound to the authenticated customer and ownership is enforced on account access.',
    icon: ShieldCheck,
  },
  {
    title: 'Idempotent money movement',
    description: 'Deposits, withdrawals, and transfers require a UUID idempotency key to avoid duplicate execution.',
    icon: WalletCards,
  },
  {
    title: 'Protected ledger operations',
    description: 'Ledger and transaction writes remain atomic and are validated before they update balances.',
    icon: LockKeyhole,
  },
];

export function Security() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Security</h2>
        <p className="text-muted-foreground">
          Banking controls are designed around ownership, auditability, and safe operation.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {controls.map(({ title, description, icon: Icon }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-5 w-5 text-primary" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
