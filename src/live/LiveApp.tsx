import {lazy, Suspense, useEffect} from 'react';
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LandingPage } from "./LandingPage";
import { AuthProvider } from "./AuthContext";
import { AuthCallback, AuthFrame, AuthPage } from "./AuthPages";
import {AccountPage, Guard} from "./Workspace";
import {MarketplaceProvider} from './marketplace';
import {AppBoundary} from './AppBoundary';
import { Onboarding, StartPage } from "./Onboarding";
import "../journey/journey.css";
import "./live.css";
import './studio.css';

const WorkerDiscover = lazy(() => import('./WorkerPages').then(m => ({default: m.WorkerDiscover})));
const WorkerTasks = lazy(() => import('./WorkerPages').then(m => ({default: m.WorkerTasks})));
const WorkerTaskDetail = lazy(() => import('./WorkerPages').then(m => ({default: m.WorkerTaskDetail})));
const WorkerAssignment = lazy(() => import('./WorkerPages').then(m => ({default: m.WorkerAssignment})));
const BusinessOverview = lazy(() => import('./BusinessPages').then(m => ({default: m.BusinessOverview})));
const BusinessCampaigns = lazy(() => import('./BusinessPages').then(m => ({default: m.BusinessCampaigns})));
const BusinessCampaignBuilder = lazy(() => import('./BusinessPages').then(m => ({default: m.BusinessCampaignBuilder})));
const BusinessCampaignDetail = lazy(() => import('./BusinessPages').then(m => ({default: m.BusinessCampaignDetail})));
const BusinessSettings = lazy(() => import('./BusinessPages').then(m => ({default: m.BusinessSettings})));
const InstagramSetup = lazy(() => import('./AccountFlows').then(m => ({default: m.InstagramSetup})));
const WalletScreen = lazy(() => import('./AccountFlows').then(m => ({default: m.WalletScreen})));
const SupportScreen = lazy(() => import('./AccountFlows').then(m => ({default: m.SupportScreen})));
const NotificationsScreen = lazy(() => import('./AccountFlows').then(m => ({default: m.NotificationsScreen})));
const AdminConsole = lazy(() => import('./AdminConsole').then(m => ({default: m.AdminConsole})));

function RoutePosition(){
  const {pathname}=useLocation();
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[pathname]);
  return null;
}

function Guide({ kind }: { kind: "help" | "terms" | "privacy" }) {
  const title = {
    help: "How can we help?",
    terms: "Terms of use",
    privacy: "Your privacy",
  }[kind];
  return (
    <AuthFrame>
      <span className="r-kicker">REALREACH</span>
      <h1>{title}</h1>
      <div className="r-guide-copy">
        {kind === "privacy"
          ? (
            <>
              <h2>What we keep</h2>
              <p>
                We keep your name, email, account details and activity to run
                your account. Task checks, support messages and payment records
                help us track work, resolve problems and protect funds. We use
                Supabase for accounts and data storage.
              </p>
              <h2>Instagram</h2>
              <p>
                We use your connected account details and the public Instagram
                activity needed to check ownership and tasks. Verification
                providers help perform these checks. We never ask for your
                Instagram password.
              </p>
              <h2>Payments</h2>
              <p>
                Our payment provider processes payments and withdrawals.
                Recipient and transaction details are used to confirm payments,
                send funds and keep receipts. Never share your bank password or
                one-time codes with RealReach support.
              </p>
              <h2>Your choices</h2>
              <p>
                Edit your profile in Account settings. Manage your connected
                account on the Instagram page; unfinished work may need to be
                resolved before disconnecting. Contact us to request access to
                or deletion of your data. Records needed to resolve disputes or
                meet legal obligations may need to be retained.
              </p>
            </>
          )
          : kind === "terms"
          ? (
            <>
              <h2>Your account</h2>
              <p>
                Use accurate details and your own Instagram account. Keep your
                password private. Worker and business accounts have different
                features; contact us to request a change.
              </p>
              <h2>Tasks and payments</h2>
              <p>
                Read the reward, deadline and rules before accepting. Complete
                the task using your connected Instagram account and keep the
                action in place until its final check. Rewards become available
                only after the required checks pass. A business cannot reject
                checked work simply because it dislikes the result.
              </p>
              <p>
                Saving a campaign draft does not publish it or charge you.
                Publishing requires the displayed price, a verified Instagram
                account and enough confirmed funds. The campaign budget is set
                aside for delivery; closing a campaign returns its uncommitted
                funds. Work already accepted still follows its task rules.
              </p>
              <p>
                Wallet balances distinguish available funds from pending rewards
                and funds set aside for work or transfers. Withdrawal limits and
                fees are shown before you confirm. A payment or withdrawal is
                complete only when its status is confirmed, not when you press
                the button.
              </p>
              <h2>Fair use</h2>
              <p>
                Do not use someone else’s work, create duplicate accounts to
                claim the same reward, or interfere with task checks. Follow
                Instagram’s rules. Campaigns do not guarantee sales or permanent
                followers.
              </p>
            </>
          )
          : (
            <>
              <details open>
                <summary>How do I find work?</summary>
                <p>
                  Connect your Instagram account, then open Discover. Read the
                  reward and rules, accept a task, complete it on Instagram and
                  submit it for checking. Find accepted work in My tasks. If
                  there are no matching tasks, check back later.
                </p>
              </details>
              <details>
                <summary>How do I create a campaign?</summary>
                <p>
                  Sign up as a business and verify your Instagram account. In
                  Campaigns, choose followers or comments, add your brief and
                  quantity, then review the price. Add funds to your wallet and
                  publish. You can save a draft without paying.
                </p>
              </details>
              <details>
                <summary>What is checked before payment?</summary>
                <p>
                  We check the required follow or comment from the worker’s
                  connected account, then check again after the hold shown on
                  the task. Screenshots alone do not release payment. Likes are
                  not independently verified or guaranteed.
                </p>
              </details>
              <details>
                <summary>Can I change my account type?</summary>
                <p>
                  Contact us. A worker account does not automatically have
                  business access.
                </p>
              </details>
              <details>
                <summary>Why can’t I withdraw?</summary>
                <p>
                  Only available earnings can be withdrawn. Pending rewards must
                  finish their checks first. Add and confirm your bank details,
                  then review the minimum and fee in Wallet. If transfers are
                  unavailable, Wallet will say so before you submit. You never
                  need to deposit money to earn.
                </p>
              </details>
              <details>
                <summary>My payment or task is still pending. What now?</summary>
                <p>
                  Open its details to check the status and any next step. Don’t
                  pay again while a payment is still being confirmed. If you
                  need help, open Support from your account and include the
                  payment or task reference.
                </p>
              </details>
              <details>
                <summary>How do I get back into my account?</summary>
                <p>
                  Use Google if you signed up with Google. For email accounts,
                  choose “Forgot password?” on the login page.
                </p>
              </details>
              <details>
                <summary>I haven’t received my confirmation email.</summary>
                <p>
                  Check spam and the email address you entered. Use
                  “Resend confirmation” on the confirmation page, then open the
                  latest link in the same browser where you signed up. If email
                  delivery fails, the page will explain what to do.
                </p>
              </details>
            </>
          )}
        <p>
          Need help? Email{" "}
          <a href="mailto:userealreach@gmail.com">userealreach@gmail.com</a>.
          Never send your password or sign-in codes.
        </p>
      </div>
      <Link className="r-button" to="/start">Open my account</Link>
      <Link className="r-text-button" to="/">Back to RealReach</Link>
    </AuthFrame>
  );
}
export default function LiveApp() {
  return (
    <AppBoundary><AuthProvider><MarketplaceProvider><RoutePosition/>
      <Suspense fallback={<div className="r-loading" role="status"><span>Opening your page…</span></div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route
          path="/signup"
          element={<AuthPage key="signup" mode="signup" />}
        />
        <Route
          path="/forgot-password"
          element={<AuthPage key="forgot" mode="forgot" />}
        />
        <Route
          path="/verify-email"
          element={<AuthPage key="verify" mode="verify" />}
        />
        <Route
          path="/reset-password"
          element={<AuthPage key="reset" mode="reset" />}
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/start"
          element={
            <Guard onboarding>
              <StartPage />
            </Guard>
          }
        />
        <Route
          path="/onboarding"
          element={
            <Guard onboarding>
              <Onboarding />
            </Guard>
          }
        />
        <Route
          path="/account"
          element={
            <Guard>
              <AccountPage />
            </Guard>
          }
        />
        <Route
          path="/earn"
          element={
            <Guard front="worker">
              <WorkerDiscover />
            </Guard>
          }
        />
        <Route
          path="/earn/my-tasks"
          element={
            <Guard front="worker">
              <WorkerTasks />
            </Guard>
          }
        />
        <Route
          path="/earn/instagram"
          element={<Guard front="worker"><InstagramSetup/></Guard>}
        />
        <Route path="/earn/tasks" element={<Navigate to="/earn" replace />} />
        <Route path="/earn/tasks/:id" element={<Guard front="worker"><WorkerTaskDetail/></Guard>}/>
        <Route path="/earn/assignments/:id" element={<Guard front="worker"><WorkerAssignment/></Guard>}/>
        <Route path="/earn/my-tasks/:id" element={<Guard front="worker"><WorkerAssignment/></Guard>}/>
        <Route
          path="/business"
          element={
            <Guard front="business">
              <BusinessOverview />
            </Guard>
          }
        />
        <Route
          path="/business/campaigns"
          element={
            <Guard front="business">
              <BusinessCampaigns />
            </Guard>
          }
        />
        <Route
          path="/business/campaigns/new"
          element={
            <Guard front="business">
              <BusinessCampaignBuilder />
            </Guard>
          }
        />
        <Route
          path="/business/campaigns/:id"
          element={
            <Guard front="business">
              <BusinessCampaignDetail />
            </Guard>
          }
        />
        <Route
          path="/business/instagram"
          element={
            <Guard front="business">
              <InstagramSetup />
            </Guard>
          }
        />
        <Route
          path="/business/settings"
          element={<Guard front="business"><BusinessSettings/></Guard>}
        />
        <Route path="/business/campaigns/:id/edit" element={<Guard front="business"><BusinessCampaignBuilder/></Guard>}/>
        <Route
          path="/earn/wallet"
          element={
            <Guard front="worker">
              <WalletScreen />
            </Guard>
          }
        />
        {["/business/wallet", "/business/billing"].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <Guard front="business">
                <WalletScreen />
              </Guard>
            }
          />
        ))}
        <Route
          path="/earn/profile"
          element={<Navigate to="/account" replace />}
        />
        <Route path="/support" element={<Guard><SupportScreen/></Guard>}/>
        <Route path="/notifications" element={<Guard><NotificationsScreen/></Guard>}/>
        <Route
          path="/admin/*"
          element={
            <Guard front="admin">
              <AdminConsole />
            </Guard>
          }
        />
        {(["help", "terms", "privacy"] as const).map((kind) => (
          <Route key={kind} path={`/${kind}`} element={<Guide kind={kind} />} />
        ))}
        <Route
          path="*"
          element={
            <AuthFrame>
              <span className="r-kicker">404</span>
              <h1>Page not found.</h1>
              <p>This page doesn’t exist.</p>
              <Link className="r-button" to="/">Back to RealReach</Link>
            </AuthFrame>
          }
        />
      </Routes></Suspense>
    </MarketplaceProvider></AuthProvider></AppBoundary>
  );
}
