import Link from "next/link";

export const metadata = {
  title: "Compressed Soulbound Tokens (cSBT) on TON — ONTON Technology",
  description:
    "How Compressed Soulbound Tokens work on TON. Explaining state compression, the history of digital credentials from Solana to TEP-85, and ONTON's native Merkle-tree architecture.",
  openGraph: {
    title: "Compressed Soulbound Tokens (cSBT) on TON — ONTON Technology",
    description:
      "Technical breakdown of Compressed Soulbound Tokens (cSBT) on the TON blockchain, state compression mechanics, and ONTON's replacement of external credential services.",
    url: "https://onton.live/csbt",
    siteName: "ONTON",
    type: "article",
  },
};

export default function CsbtPage() {
  return (
    <div className="min-h-screen bg-[#F9F9FB] text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Technology</span>
          <span>/</span>
          <span className="text-gray-900 font-medium">Compressed SBT</span>
        </nav>

        <header className="mb-12 border-b border-gray-200 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] mb-4 border border-blue-200 shadow-sm">
            Technical Architecture &amp; Specification
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4 leading-tight">
            Compressed Soulbound Tokens (cSBT) on TON
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
            The concepts, Web3 history, and implementation of state-compressed credentials on the TON blockchain, alongside ONTON&apos;s migration from external APIs to a native in-house credential engine.
          </p>
        </header>

        <article className="prose lg:prose-lg max-w-none text-gray-800">
          <h2>Part 1: The Concept, Technology, and History of cSBT</h2>

          <h3>1. Soulbound Tokens in General Terms</h3>
          <p>
            A Soulbound Token (SBT) is a non-transferable digital token permanently bound to a single cryptographic wallet address. Standard non-fungible tokens (NFTs) are designed for financial exchange and secondary trade on marketplaces like OpenSea or Getgems. An SBT strips out the transfer mechanism entirely. Once a wallet receives an SBT, the token cannot be sold, transferred to another wallet, or pledged as loan collateral.
          </p>
          <p>
            This constraint makes SBTs useful for credentials that must reflect individual history rather than purchasing power: event attendance records, hackathon achievement badges, professional certifications, DAO voting rights, and verified community memberships.
          </p>

          <h3>2. The Cost Bottleneck of On-Chain Storage</h3>
          <p>
            On blockchains like Ethereum and TON, data storage is expensive because every validator node must store the blockchain state indefinitely.
          </p>
          <p>
            On the TON blockchain, the architecture follows an actor model. Every standard NFT collection and every individual NFT item is an independent smart contract with its own address, code cell, data cell, and storage rent balance. Minting 10,000 standard TEP-85 Soulbound Tokens for an event requires deploying 10,000 distinct smart contracts. At roughly 0.05 to 0.08 TON per deployed contract, minting 10,000 attendee badges costs between 500 and 800 TON (equivalent to $2,500 to $4,000 at $5/TON). For large conferences, free community meetups, or repeated side events, this cost structure makes mass credentialing economically impractical.
          </p>

          <h3>3. How State Compression Works</h3>
          <p>
            State compression solves the storage cost problem by moving individual token records off-chain while keeping mathematical proof of their validity on-chain.
          </p>
          <p>
            The mechanism relies on a binary Merkle tree:
          </p>
          <ul>
            <li>
              <strong>Leaves:</strong> Each credential record contains the recipient wallet address, token index, event identifier, and metadata hash. This data is hashed into a 32-byte cryptographic leaf: <code>hash = SHA256(index + owner + event_uuid + metadata_hash)</code>.
            </li>
            <li>
              <strong>Nodes and Root:</strong> Pairs of leaf hashes are combined and hashed up the tree until a single 32-byte value remains: the Merkle root.
            </li>
            <li>
              <strong>On-Chain Anchor Contract:</strong> The event organizer deploys a single contract on TON that stores only the 32-byte Merkle root. A tree of depth 20 can reference up to 1,048,576 individual badges, yet the on-chain contract stores only 32 bytes of state.
            </li>
            <li>
              <strong>Cryptographic Inclusion Proofs:</strong> To verify that a specific wallet owns a badge, the verifier does not read an individual smart contract. Instead, the user provides a Merkle proof: the path of 20 sibling hashes connecting their leaf to the on-chain root. Any contract or client can recompute the root from this proof in milliseconds. If the computed root matches the on-chain root, the credential is mathematically proven without the blockchain ever storing the badge data.
            </li>
          </ul>

          <div className="my-8 overflow-x-auto rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h4 className="text-base font-bold text-gray-900 mb-4 uppercase tracking-wider">Standard TEP-85 vs. Compressed SBT (cSBT)</h4>
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-4 font-semibold">Parameter</th>
                  <th className="py-2 pr-4 font-semibold">Standard TEP-85 SBT</th>
                  <th className="py-2 font-semibold">Compressed SBT (cSBT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">On-Chain Footprint (10k items)</td>
                  <td className="py-2.5 pr-4 text-gray-600">10,001 smart contracts</td>
                  <td className="py-2.5 text-gray-600">1 anchor contract (32-byte root)</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">Minting Cost (10k items)</td>
                  <td className="py-2.5 pr-4 text-gray-600">~500 - 800 TON</td>
                  <td className="py-2.5 text-gray-600">~0.1 - 0.5 TON</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">Storage Rent</td>
                  <td className="py-2.5 pr-4 text-gray-600">Paid per item contract</td>
                  <td className="py-2.5 text-gray-600">Single root contract rent</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">Verification Mechanism</td>
                  <td className="py-2.5 pr-4 text-gray-600">Contract getter method</td>
                  <td className="py-2.5 text-gray-600">Merkle inclusion proof</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">Transferability</td>
                  <td className="py-2.5 pr-4 text-gray-600">Rejects transfers (error 413)</td>
                  <td className="py-2.5 text-gray-600">Immutable leaf bound to address</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>4. History in Web3 and on the TON Blockchain</h3>
          <p>
            <strong>May 2022: The Conceptual Foundation</strong><br />
            Vitalik Buterin, Glen Weyl, and Puja Ohlhaver published <em>&quot;Decentralized Society: Finding Web3&apos;s Soul&quot;</em>. The paper argued that Web3 was overly financialized and lacked native primitives to represent trust, creditworthiness, affiliations, and provenance. They proposed Soulbound Tokens as non-transferable, identity-anchored credentials.
          </p>
          <p>
            <strong>Late 2022 – Early 2023: Solana Pioneers State Compression</strong><br />
            Solana Labs and Metaplex introduced concurrent Merkle trees through the SPL Account Compression program and the Bubblegum standard. This cut the cost of minting 1,000,000 NFTs on Solana from roughly $250,000 down to $100 (approximately 5 SOL). This deployment proved that Merkle compression was the only viable path for mass token issuance.
          </p>
          <p>
            <strong>2022 – 2023: TON Establishes TEP-85</strong><br />
            The TON Community approved the TEP-85 standard (&quot;Soulbound NFT Standard&quot;). TEP-85 extended the basic TEP-62 NFT standard by removing transfer operations and adding interfaces for proving ownership (<code>proveOwnership</code>, opcode <code>0x04ded148</code>), requesting owner info (<code>requestOwner</code>, opcode <code>0xd0c3bfea</code>), and handling revocation by designated authorities (<code>revoke</code>, opcode <code>0x6f89f5e3</code>). Attempted transfers return exit code 413.
          </p>
          <p>
            <strong>2023 – 2024: TON Society Credentialing and the API Bottleneck</strong><br />
            TON Society emerged as the primary community credentialing body on TON, issuing badges for hackathons, regional hubs, and ecosystem activities. They introduced early cSBT campaigns for event organizers.
          </p>
          <p>
            However, TON Society operated their system through a centralized, hosted backend API at <code>society.ton.org</code>. Event organizers and platforms could not interact directly with an on-chain protocol; they had to authenticate through API keys, submit payloads to TON Society&apos;s servers, and rely on TON Society to sign and batch transactions.
          </p>
          <p>
            When the TON Society team changed priorities and shut down <code>society.ton.org</code>, the domain stopped resolving (<code>NXDOMAIN</code>). External applications that depended on their API experienced immediate outages: event creation transactions rolled back, ticket check-in workflows stalled, and attendee reward queues jammed.
          </p>

          <hr />

          <h2>Part 2: What We Built for ONTON and What We Are Replacing</h2>

          <h3>1. The Problem We Addressed</h3>
          <p>
            ONTON originally integrated with TON Society&apos;s hosted API for event activity registration, badge creation, and attendee rewards. When <code>society.ton.org</code> went offline, ONTON&apos;s background workers threw uncaught connection exceptions during ticket order completion and post-event reward processing.
          </p>
          <p>
            This operational failure confirmed that core event operations cannot depend on third-party SaaS backends. We resolved to eliminate external dependencies and implement our own credential system directly on the TON blockchain.
          </p>

          <h3>2. Phase 1: Native In-House TEP-85 Engine (Shipped &amp; Live)</h3>
          <p>
            We developed and deployed a native TEP-85 Soulbound Token engine directly within ONTON. This system is fully independent of TON Society or any external service:
          </p>
          <ul>
            <li>
              <strong>FunC Smart Contract Wrappers:</strong> In <code>mini-app/src/lib/sbt.ts</code> and <code>sbtOpcodes.ts</code>, we implemented full TEP-85 compliance. The system handles collection deployment, badge minting messages with custom authority addresses, revocation, and ownership verification.
            </li>
            <li>
              <strong>Deterministic Address Derivation:</strong> The TypeScript implementation uses TON cell hashing to derive the exact contract address of every badge before it is deployed on-chain. When an attendee buys or claims a ticket, ONTON can display their badge contract address immediately.
            </li>
            <li>
              <strong>Self-Healing Database Architecture:</strong> The PostgreSQL module (<code>sbt.db.ts</code>) manages <code>sbt_collections</code> and <code>sbt_items</code> tables with automatic, idempotent schema creation (<code>ensureSbtTables()</code>). If migrations are missing during container startup, the database creates the necessary schemas and indexes on the first query without throwing 500 errors.
            </li>
            <li>
              <strong>Worker Pipeline Decoupling:</strong> We replaced all defunct TON Society calls inside ONTON&apos;s ticket processing and reward workers (<code>TsCsbtTicketOrder.ts</code>, <code>createRewards.helpers.ts</code>, <code>rewardsService.ts</code>). Badges are minted directly through ONTON&apos;s dedicated minter wallet to the recipient&apos;s TON address.
            </li>
            <li>
              <strong>tRPC API Integration:</strong> We exposed <code>sbt.getEventCollection</code>, <code>sbt.getWalletBadges</code>, and <code>sbt.verifyOwnership</code> endpoints directly in the API router for use by the Telegram Mini App and third-party verifiers.
            </li>
          </ul>

          <h3>3. Phase 2: The ONTON cSBT State Compression Engine (Next Generation)</h3>
          <p>
            Our native TEP-85 engine solved autonomy and eliminated external failure points. However, deploying individual contracts for each attendee still costs approximately 0.08 TON per mint.
          </p>
          <p>
            To scale to hundreds of thousands of attendees across conferences, hacker houses, and meetups, we are expanding our native architecture into a full Merkle state compression engine (cSBT):
          </p>

          <ol>
            <li>
              <strong>The On-Chain Anchor Contract:</strong> Instead of deploying a new contract for every badge, each event collection deploys a single Merkle anchor contract on TON. The contract holds the current 32-byte Merkle root and accepts batch root updates signed by the authorized organizer or ONTON minter wallet.
            </li>
            <li>
              <strong>Indexed Leaf Storage:</strong> All badge leaves are computed and indexed in ONTON&apos;s PostgreSQL cluster. When an organizer finishes check-in for a 5,000-person summit, the leaf hashes are combined into a Merkle tree, and a single root transaction is committed to the blockchain.
            </li>
            <li>
              <strong>Zero-Gas Claim Flow via Telegram Mini App:</strong> Attendees do not need TON in their wallets to receive credentials. When their QR code is scanned at the door, their badge is instantly registered in the leaf index. Inside the Telegram Mini App, their profile displays their verified badge.
            </li>
            <li>
              <strong>Cryptographic Verification API:</strong> Any third party (a partner event, a DAO voting portal, or a gated chat) can verify an attendee&apos;s badge by requesting a Merkle proof from ONTON&apos;s public API and checking it against the on-chain root stored on the TON blockchain.
            </li>
            <li>
              <strong>On-Demand Materialization:</strong> If an attendee requires a standalone on-chain TEP-85 contract (for instance, to interact with an external contract that does not support Merkle proof verification), they can trigger an on-chain extraction. The user submits their Merkle proof to the anchor contract, pays the isolated deployment fee, and the anchor contract deploys an individual TEP-85 token instance while marking the leaf as materialized.
            </li>
          </ol>

          <h3>Summary</h3>
          <p>
            By moving from TON Society&apos;s closed API to our own native TEP-85 and cSBT engines, ONTON has replaced a fragile external dependency with a deterministic, mathematically verifiable credential system built directly on the TON blockchain.
          </p>
        </article>

        <footer className="mt-16 pt-8 border-t border-gray-200 flex flex-wrap justify-between items-center gap-4 text-sm text-gray-500">
          <div>
            Published by the ONTON Engineering Team • Updated September 2026
          </div>
          <div className="flex gap-4">
            <Link href="/blog" className="text-blue-600 hover:underline">
              Blog &amp; Case Studies
            </Link>
            <Link href="/events" className="text-blue-600 hover:underline">
              Explore Events
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
