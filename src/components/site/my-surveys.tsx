import Link from "next/link";
import { ClipboardList, MapPin, Navigation, Phone } from "lucide-react";
import { formatAddress } from "@/core/clients";
import { londonParts, mapsLink, slotLabels } from "@/core/surveys";
import type { Address } from "@/core/schemas";

export type MySurvey = {
  id: string;
  startsAt: Date;
  leadId: string;
  name: string;
  phone: string | null;
  address: Address | null;
  postcode: string | null;
  projectType: string | null;
  description: string | null;
  budget: string | null;
};

/** My survey visits: when, who, where (with directions), their number, and what they want. */
export function MySurveys({ surveys, today, canOpenLead }: { surveys: MySurvey[]; today: string; canOpenLead: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {surveys.map((s) => {
        const when = slotLabels(s.startsAt);
        const place = formatAddress(s.address) || s.postcode;
        return (
          <li key={s.id} className="rounded-2xl bg-white p-4 shadow-ring">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[17px] font-semibold tabular">{when.time}</span>
              <span className="text-[13px] text-subtle">{londonParts(s.startsAt).day === today ? "Survey" : `Survey · ${when.dayShort}`}</span>
            </div>
            <div className="mt-0.5 font-medium">
              {s.name}
              {s.projectType ? <span className="font-normal text-ink-2"> · {s.projectType}</span> : null}
            </div>
            {place && (
              <div className="mt-1 flex items-start gap-1.5 text-[14px] text-ink-2">
                <MapPin className="mt-0.5 size-4 flex-none" />
                {place}
              </div>
            )}
            {(s.description || s.budget) && <p className="mt-2 line-clamp-3 rounded-xl bg-surface px-3 py-2 text-[14px] text-ink-2">{[s.description, s.budget ? `Budget: ${s.budget}` : null].filter(Boolean).join(" · ")}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {place && (
                <a href={mapsLink(place)} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-ink font-semibold text-white">
                  <Navigation className="size-4" />
                  Directions
                </a>
              )}
              {s.phone && (
                <a href={`tel:${s.phone}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-surface font-semibold shadow-ring">
                  <Phone className="size-4" />
                  Call
                </a>
              )}
              {canOpenLead && (
                <Link href={`/app/pipeline/${s.leadId}`} className="col-span-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white font-semibold shadow-ring">
                  <ClipboardList className="size-4" />
                  Open the lead (notes, start the quote)
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
