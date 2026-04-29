import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, ScanLine, ShieldCheck } from "lucide-react";
import { PageHeader, Panel, StatCard } from "@/components/ui";

const modules = [
  "Participant registry and admin verification",
  "Farm origin registration for verified saffron farms",
  "Harvest batch creation with immutable blockchain identity",
  "Batch transformation history for grading, drying, cleaning, and packaging",
  "Ownership transfer records across the supply chain",
  "Certificate upload, verification, and IPFS-linked proofs",
  "Buyer compliance checks and escrow-backed settlement",
  "Consumer QR verification with chain-of-custody visibility"
];

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-card">
          <span className="eyebrow">Blockchain saffron traceability</span>
          <h1>Premium trust for every saffron batch, from farm to final scan.</h1>
          <p>
            KisaanChain records farm origin, harvest batches, certificates, transformations, ownership transfers,
            escrow-backed payments, and consumer verification on a layered Ethereum supply chain platform.
          </p>
          <div className="hero-actions">
            <Link href="/auth/register" className="primary-button">
              Launch platform
            </Link>
            <Link href="/verify" className="ghost-button">
              Verify a product
            </Link>
          </div>
        </div>

        <div className="hero-grid">
          <article className="spotlight-card">
            <ShieldCheck size={22} />
            <strong>Immutable origin and custody</strong>
            <p>Farm registration, batch creation, certificates, and transfers stay linked to tamper-resistant proofs.</p>
          </article>
          <article className="spotlight-card">
            <ScanLine size={22} />
            <strong>Consumer authenticity checks</strong>
            <p>Each verified batch can generate a QR verification flow with origin, certificates, and lifecycle events.</p>
          </article>
          <article className="spotlight-card">
            <Boxes size={22} />
            <strong>Real workflow, empty by default</strong>
            <p>No mock inventory. The platform starts clean and accepts real manual entries, uploads, and blockchain writes.</p>
          </article>
          <article className="spotlight-card">
            <BadgeCheck size={22} />
            <strong>Escrow-backed fairness</strong>
            <p>Buyer compliance and conditional payment release make settlement clearer for farmers and buyers.</p>
          </article>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Smart contracts" value="10" hint="Modular Solidity contracts aligned with the report." />
        <StatCard label="Core roles" value="5" hint="Farmer, admin, buyer, consumer, and certifier." />
        <StatCard label="Architecture layers" value="5" hint="User to supply chain, with clean separation." />
        <StatCard label="Initial mock records" value="0" hint="Every record comes from real user input flows." />
      </section>

      <PageHeader
        eyebrow="Modules"
        title="Report-aligned platform scope"
        description="The application is structured around the modules, lifecycle stages, and stakeholder journeys defined in the KisaanChain report."
      />

      <div className="panel-grid">
        <Panel title="Implemented capabilities" subtitle="Every major module from the report has a place in the product flow.">
          <div className="timeline">
            {modules.map((module) => (
              <article className="timeline-item" key={module}>
                <span className="timeline-item__dot" />
                <div>
                  <strong>{module}</strong>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Layered product journey" subtitle="Built around the report's five-layer architecture.">
          <div className="timeline">
            {[
              "User Layer: farmers, admins, buyers, consumers, certifiers",
              "Application Layer: Next.js dashboards, verification pages, MetaMask flows",
              "Backend Layer: JWT auth, PostgreSQL, document storage, search, orchestration",
              "Blockchain Layer: Ethereum smart contracts through Hardhat and Ethers.js",
              "Supply Chain Layer: saffron lifecycle from origin to verified consumer scan"
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

      <Panel title="Start with a role" subtitle="Each role gets a dedicated workspace with empty-state guidance.">
        <div className="hero-actions">
          <Link href="/dashboard/farmer" className="ghost-button">
            Farmer dashboard
          </Link>
          <Link href="/dashboard/admin" className="ghost-button">
            Admin dashboard
          </Link>
          <Link href="/dashboard/buyer" className="ghost-button">
            Buyer dashboard
          </Link>
          <Link href="/verify" className="primary-button">
            Consumer verification <ArrowRight size={16} />
          </Link>
        </div>
      </Panel>
    </div>
  );
}
