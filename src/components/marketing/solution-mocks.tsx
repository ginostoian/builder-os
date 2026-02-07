function Pill({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${
        dark
          ? "border-[#d1d5db] bg-[#f3f4f6] text-[#111111]"
          : "border-[var(--border)] bg-white text-[var(--muted-foreground)]"
      }`}
    >
      {label}
    </span>
  );
}

export function QuoteBuilderMock() {
  return (
    <div className="rounded-xl border bg-[#fafafa] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--foreground)]">Quote draft v3</p>
          <p className="text-xs text-[var(--muted-foreground)]">Loft conversion - Walthamstow</p>
        </div>
        <Pill label="Send quote" dark />
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_auto] items-center rounded-lg border bg-white px-3 py-2 text-xs">
          <span className="font-medium text-[var(--foreground)]">Demolition and prep</span>
          <span className="text-[var(--muted-foreground)]">Fixed</span>
          <span className="font-semibold text-[var(--foreground)]">£2,400</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center rounded-lg border bg-white px-3 py-2 text-xs">
          <span className="font-medium text-[var(--foreground)]">Structural steel install</span>
          <span className="text-[var(--muted-foreground)]">Unit rate</span>
          <span className="font-semibold text-[var(--foreground)]">£8,900</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center rounded-lg border bg-white px-3 py-2 text-xs">
          <span className="font-medium text-[var(--foreground)]">Bathroom fittings allowance</span>
          <span className="text-[var(--muted-foreground)]">Allowance</span>
          <span className="font-semibold text-[var(--foreground)]">£1,500</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border bg-white px-3 py-2">
          <p className="text-[var(--muted-foreground)]">Subtotal</p>
          <p className="font-semibold text-[var(--foreground)]">£26,840</p>
        </div>
        <div className="rounded-lg border bg-white px-3 py-2">
          <p className="text-[var(--muted-foreground)]">Total (VAT 20%)</p>
          <p className="font-semibold text-[var(--foreground)]">£32,208</p>
        </div>
      </div>
    </div>
  );
}

export function AcceptanceMock() {
  return (
    <div className="rounded-xl border bg-[#fafafa] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--foreground)]">Client view</p>
        <Pill label="Updated on 12 Feb" />
      </div>
      <div className="space-y-2 rounded-lg border bg-white p-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">Rear extension - summary</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Labour, materials, and allowances shown in a summary-first format.
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border bg-[#fafafa] px-2 py-1.5">
            <p className="text-[var(--muted-foreground)]">Quote total</p>
            <p className="font-semibold text-[var(--foreground)]">£74,600</p>
          </div>
          <div className="rounded-md border bg-[#fafafa] px-2 py-1.5">
            <p className="text-[var(--muted-foreground)]">Deposit</p>
            <p className="font-semibold text-[var(--foreground)]">10%</p>
          </div>
          <div className="rounded-md border bg-[#fafafa] px-2 py-1.5">
            <p className="text-[var(--muted-foreground)]">Status</p>
            <p className="font-semibold text-[var(--foreground)]">Ready to accept</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Pill label="Accept quote" dark />
        <Pill label="Download PDF" />
      </div>
    </div>
  );
}

export function VariationsMock() {
  return (
    <div className="rounded-xl border bg-[#fafafa] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--foreground)]">Variations</p>
        <Pill label="Post-acceptance only" />
      </div>
      <div className="space-y-2">
        <div className="rounded-lg border bg-white px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--foreground)]">V-014 - Skylight upgrade</p>
            <Pill label="Approved" dark />
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Added insulation spec and larger unit</p>
          <p className="mt-1 text-xs font-semibold text-[var(--foreground)]">+£2,150</p>
        </div>
        <div className="rounded-lg border bg-white px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--foreground)]">V-015 - Tile change</p>
            <Pill label="Pending" />
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Client requested alternate finish in bathroom</p>
          <p className="mt-1 text-xs font-semibold text-[var(--foreground)]">+£680</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg border bg-white px-3 py-2">
        <p className="text-xs text-[var(--muted-foreground)]">Approved variations total</p>
        <p className="text-sm font-semibold text-[var(--foreground)]">£2,150</p>
      </div>
    </div>
  );
}
