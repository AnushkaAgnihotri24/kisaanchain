import { PageHeader, Panel } from "@/components/ui";

export default function AboutPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="How it works"
        title="KisaanChain follows the saffron lifecycle from farm registration to final consumer scan."
        description="The system architecture, roles, and blockchain modules reflect the project report directly rather than collapsing into a generic marketplace flow."
      />

      <div className="panel-grid">
        <Panel title="Supply chain lifecycle" subtitle="The product flow mirrors the report's real-world saffron process.">
          <div className="timeline">
            {[
              "Verified farmers register farms with origin data.",
              "Harvested saffron becomes a unique blockchain batch.",
              "Certifiers upload and verify origin, GI, organic, or quality proofs.",
              "Processing and packaging steps are recorded as immutable transformations.",
              "Ownership changes are written to the chain as the batch moves to buyers.",
              "Escrow secures payment until delivery and validation conditions are met.",
              "Consumers scan the QR code to inspect authenticity and chain of custody."
            ].map((step) => (
              <article className="timeline-item" key={step}>
                <span className="timeline-item__dot" />
                <div>
                  <strong>{step}</strong>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Why blockchain here" subtitle="The report's problem statement drives the product design.">
          <div className="timeline">
            {[
              "Transparency replaces opaque centralized records.",
              "Immutable batch history lowers adulteration and counterfeit risk.",
              "Certification proofs become easier to verify across stakeholders.",
              "Buyer enforcement and escrow reduce payment uncertainty for farmers.",
              "Consumer trust increases when verification is easy and public."
            ].map((step) => (
              <article className="timeline-item" key={step}>
                <span className="timeline-item__dot" />
                <div>
                  <strong>{step}</strong>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
