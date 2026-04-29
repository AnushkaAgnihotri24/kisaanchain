import { formatDate, toTitleCase } from "@/lib/format";

type Event = {
  id: string;
  eventType: string;
  details: string;
  occurredAt?: string;
  createdAt?: string;
  actor?: {
    name?: string;
    role?: string;
  } | null;
};

export function TraceabilityTimeline({ events }: { events: Event[] }) {
  return (
    <div className="timeline">
      {events.map((event) => (
        <article className="timeline-item" key={event.id}>
          <span className="timeline-item__dot" />
          <div>
            <strong>{toTitleCase(event.eventType)}</strong>
            <p>{event.details}</p>
            <small>
              {event.actor?.name ? `${event.actor.name} · ` : ""}
              {formatDate(event.occurredAt || event.createdAt)}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}
