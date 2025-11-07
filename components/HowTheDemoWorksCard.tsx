import { Card } from './Card';

export function HowTheDemoWorksCard() {
  return (
    <Card className="text-sm text-zinc-400" padding="compact">
      <h3 className="text-lg font-semibold text-zinc-100">How the demo works</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>Sign in with a throwaway email.</li>
        <li>Start the account linking flow and approve it in the popup.</li>
        <li>Watch the webhook events update this dashboard in real time.</li>
        <li>Subscribe and watch the webhook confirm completion.</li>
      </ol>
    </Card>
  );
}
