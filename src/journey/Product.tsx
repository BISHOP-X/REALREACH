import { useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { money } from "./model";
import { useDemo } from "./store";
import { AssignmentPage, Discover, MyTasks, TaskDetail } from "./Worker";
import {
  BusinessFunds,
  BusinessOverview,
  CampaignBuilder,
  CampaignDetail,
  Campaigns,
} from "./Business";
import { AccountPage, HelpPage, WorkerWallet } from "./Account";
import {
  Button,
  ButtonLink,
  Empty,
  Info,
  Modal,
  PageHeading,
  SectionHeading,
  Shell,
  Stat,
  Status,
  Timeline,
} from "./ui";
import "./journey.css";

export { ProductProvider } from "./store";
export { AuthScreen } from "./Account";
export { Mark } from "./ui";

function NotFound() {
  return (
    <Empty
      title="Let's get you back on track."
      text="That page isn't part of this workspace."
      action={<ButtonLink to="/earn">Open Discover</ButtonLink>}
    />
  );
}
export function EarnerProduct() {
  return (
    <Shell front="worker">
      <Routes>
        <Route index element={<Discover />} />
        <Route path="tasks" element={<Discover />} />
        <Route path="tasks/:campaignId" element={<TaskDetail />} />
        <Route path="assignments/:assignmentId" element={<AssignmentPage />} />
        <Route path="my-tasks" element={<MyTasks />} />
        <Route
          path="history"
          element={<Navigate to="/earn/my-tasks" replace />}
        />
        <Route path="wallet" element={<WorkerWallet />} />
        <Route path="profile" element={<AccountPage front="worker" />} />
        <Route
          path="settings"
          element={<Navigate to="/earn/profile" replace />}
        />
        <Route path="help" element={<HelpPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
export function BusinessProduct() {
  return (
    <Shell front="business">
      <Routes>
        <Route index element={<BusinessOverview />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/new" element={<CampaignBuilder />} />
        <Route
          path="campaigns/:campaignId/edit"
          element={<CampaignBuilder />}
        />
        <Route path="campaigns/:campaignId" element={<CampaignDetail />} />
        <Route path="billing" element={<BusinessFunds />} />
        <Route path="settings" element={<AccountPage front="business" />} />
        <Route path="analytics" element={<Navigate to="/business" replace />} />
        <Route
          path="audience"
          element={<Navigate to="/business/campaigns" replace />}
        />
        <Route path="help" element={<HelpPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
export function PublicHelp({ legal = false }: { legal?: boolean }) {
  const { state } = useDemo();
  return (
    <Shell front={state.front}>
      <HelpPage legal={legal} />
    </Shell>
  );
}

function AdminOverview() {
  const { state } = useDemo();
  return (
    <>
      <PageHeading
        eyebrow="DEMO OPERATIONS"
        title="Exceptions, not every action."
        copy="Keep the ordinary journey automatic. Bring the unusual cases into focus."
      />
      <Info warning>
        Open demo administration. This is not a protected admin service. Live
        roles, MFA and server authorization are not connected.
      </Info>
      <div className="j-stats-grid">
        <Stat
          label="Open exceptions"
          value={state.assignments.filter((a) => a.status === "review").length}
          detail="Require a recorded decision"
        />
        <Stat
          label="Pending rewards"
          value={state.assignments.filter((a) => a.status === "pending").length}
          detail="Waiting for final checks"
        />
        <Stat
          label="Payouts processing"
          value={
            state.withdrawals.filter((w) => w.status === "processing").length
          }
          detail="Funds remain on hold"
        />
        <Stat
          label="Business connection"
          value={state.connected ? "Ready" : "Paused"}
          detail="Simulated provider health"
        />
      </div>
      <div className="j-help-grid">
        <Link className="j-panel j-admin-link" to="/admin/proofs">
          <ShieldCheck size={29} />
          <h2>Verification exceptions</h2>
          <p>Review missing actions and appeals with the full task timeline.</p>
          <span>
            Open queue <ArrowRight size={19} />
          </span>
        </Link>
        <Link className="j-panel j-admin-link" to="/admin/payouts">
          <Wallet size={29} />
          <h2>Payout reconciliation</h2>
          <p>Inspect simulated transfers and resolve their final outcome.</p>
          <span>
            Open payouts <ArrowRight size={19} />
          </span>
        </Link>
      </div>
    </>
  );
}
function AdminExceptions() {
  const { state, send } = useDemo();
  const [selected, setSelected] = useState<string | null>(null);
  const rows = state.assignments.filter((a) => a.status === "review");
  const a = rows.find((x) => x.id === selected);
  return (
    <>
      <PageHeading
        eyebrow="VERIFICATION EXCEPTIONS"
        title="A fair look at what happened."
        copy="Use evidence and a timeline. Never guess from an unavailable response."
      />
      {rows.length ? (
        <div className="j-assignment-list">
          {rows.map((row) => (
            <button
              className="j-assignment-row"
              key={row.id}
              onClick={() => setSelected(row.id)}
            >
              <span className="j-money-icon">
                <ShieldCheck size={20} />
              </span>
              <div className="j-assignment-description">
                <strong>
                  {state.campaigns.find((c) => c.id === row.campaignId)?.brand}{" "}
                  · {row.id.slice(-8)}
                </strong>
                <span>{row.reason}</span>
              </div>
              <Status value={row.status} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Nothing needs a second look."
          text="Missing-action scenarios and worker appeals appear here. Routine tasks do not need admin approval."
          action={
            <ButtonLink to="/earn/my-tasks" secondary>
              Explore task scenarios
            </ButtonLink>
          }
        />
      )}{" "}
      {a && (
        <Modal title="Review assignment" onClose={() => setSelected(null)} wide>
          <p>{a.reason}</p>
          <Timeline events={a.events} />
          <Info>
            Only a previously detected action can be released in this simulator.
            Every outcome is added to the assignment timeline.
          </Info>
          <div className="j-button-row">
            <Button
              kind="secondary"
              onClick={() => {
                if (send({ type: "resolve", id: a.id, accept: false }))
                  setSelected(null);
              }}
            >
              Close without payment
            </Button>
            <Button
              disabled={!a.verifiedAt}
              onClick={() => {
                if (send({ type: "resolve", id: a.id, accept: true }))
                  setSelected(null);
              }}
            >
              Resolve & release demo reward
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function AdminPayouts() {
  const { state, send } = useDemo();
  return (
    <>
      <PageHeading
        eyebrow="PAYMENT OPERATIONS"
        title="Every transfer has a trail."
        copy="A processing payout stays on hold until its outcome is known."
      />
      <Info>
        These controls simulate PocketFi outcomes. No real payment API is
        called.
      </Info>
      {state.withdrawals.length ? (
        <div className="j-panel">
          {state.withdrawals.map((w) => (
            <div className="j-admin-payout" key={w.id}>
              <div>
                <strong>{money(w.amount)}</strong>
                <p>{w.bank}</p>
                <small>{w.id}</small>
              </div>
              <Status value={w.status} />
              {w.status === "processing" && (
                <div className="j-button-row">
                  <Button
                    kind="secondary"
                    onClick={() =>
                      send({ type: "payout-result", id: w.id, success: true })
                    }
                  >
                    Confirm demo success
                  </Button>
                  <Button
                    kind="ghost"
                    onClick={() =>
                      send({ type: "payout-result", id: w.id, success: false })
                    }
                  >
                    Confirm failure & return funds
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="No transfers to reconcile."
          text="Request a demo withdrawal from the worker wallet to explore this flow."
          action={
            <ButtonLink to="/earn/wallet" secondary>
              Open worker wallet
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
export function AdminProduct() {
  return (
    <Shell front="admin">
      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="proofs" element={<AdminExceptions />} />
        <Route path="payouts" element={<AdminPayouts />} />
        <Route path="settings" element={<AccountPage front="admin" />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="users" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
