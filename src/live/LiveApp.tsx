import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { AuthProvider } from './AuthContext';
import { AuthCallback, AuthFrame, AuthPage } from './AuthPages';
import { AccountPage, AdminPage, BusinessInstagram, Discover, Guard, Overview, WalletPage } from './Workspace';
import { Campaigns, CampaignEditor } from './Campaigns';
import { Onboarding, StartPage } from './Onboarding';
import '../journey/journey.css';
import './live.css';

function Guide({kind}:{kind:'help'|'terms'|'privacy'}){
  const title={help:'How can we help?',terms:'Terms of use',privacy:'Your privacy'}[kind];
  return <AuthFrame><span className="r-kicker">REALREACH</span><h1>{title}</h1><div className="r-guide-copy">{kind==='privacy'?<>
    <h2>What we keep</h2><p>Your name, email, account details and activity on RealReach. We use Supabase to manage accounts and store this information.</p>
    <h2>Instagram</h2><p>If you connect Instagram, we use the account details and task-related checks needed to provide the service. We never ask for your Instagram password.</p>
    <h2>Your choices</h2><p>Edit your profile in Account settings or disconnect your business’s Instagram in Settings. Contact us to request access to or deletion of your data. Records needed to resolve disputes or meet legal obligations may need to be retained.</p>
  </>:kind==='terms'?<>
    <h2>Your account</h2><p>Use accurate details and your own Instagram account. Keep your password private. Worker and business accounts have different features; contact us to request a change.</p>
    <h2>Tasks and payments</h2><p>Read the rules and reward before accepting a task. Work must pass the stated checks before a reward is released. A business cannot withhold payment simply because it dislikes a verified result.</p>
    <p>Payments and paid campaigns are not available yet. Saving a draft does not publish it or charge you.</p>
    <h2>Fair use</h2><p>Do not use someone else’s work, create duplicate accounts to claim the same reward, or interfere with task checks. Follow Instagram’s rules. Campaigns do not guarantee sales or permanent followers.</p>
  </>:<>
    <details open><summary>How do I find work?</summary><p>Open Discover. Available tasks will show their reward and rules before you accept. There are no paid tasks available yet.</p></details>
    <details><summary>How do I create a campaign?</summary><p>Choose a business account when signing up. Go to Campaigns, add the details and save your draft. Publishing requires Instagram and payments to be connected.</p></details>
    <details><summary>Can I change my account type?</summary><p>Contact us. A worker account does not automatically have business access.</p></details>
    <details><summary>Why can’t I withdraw?</summary><p>Payments are not available yet. No deposit is needed to create an account.</p></details>
    <details><summary>How do I get back into my account?</summary><p>Use Google if you signed up with Google. For email accounts, choose “Forgot password?” on the login page.</p></details>
  </>}<p>Need help? Email <a href="mailto:userealreach@gmail.com">userealreach@gmail.com</a>. Never send your password or sign-in codes.</p></div><Link className="r-button" to="/start">Open my account</Link><Link className="r-text-button" to="/">Back to RealReach</Link></AuthFrame>;
}
export default function LiveApp(){return <AuthProvider><Routes>
  <Route path="/" element={<LandingPage/>}/>
  <Route path="/login" element={<AuthPage key="login" mode="login"/>}/>
  <Route path="/signup" element={<AuthPage key="signup" mode="signup"/>}/>
  <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot"/>}/>
  <Route path="/verify-email" element={<AuthPage key="verify" mode="verify"/>}/>
  <Route path="/reset-password" element={<AuthPage key="reset" mode="reset"/>}/>
  <Route path="/auth/callback" element={<AuthCallback/>}/>
  <Route path="/start" element={<Guard onboarding><StartPage/></Guard>}/>
  <Route path="/onboarding" element={<Guard onboarding><Onboarding/></Guard>}/>
  <Route path="/account" element={<Guard><AccountPage/></Guard>}/>
  <Route path="/earn" element={<Guard front="worker"><Discover/></Guard>}/>
  <Route path="/earn/my-tasks" element={<Guard front="worker"><Discover myTasks/></Guard>}/>
  <Route path="/earn/instagram" element={<Navigate to="/earn/my-tasks" replace/>}/>
  <Route path="/earn/tasks" element={<Navigate to="/earn" replace/>}/>
  <Route path="/business" element={<Guard front="business"><Overview/></Guard>}/>
  <Route path="/business/campaigns" element={<Guard front="business"><Campaigns/></Guard>}/>
  <Route path="/business/campaigns/new" element={<Guard front="business"><CampaignEditor key="new"/></Guard>}/>
  <Route path="/business/campaigns/:id" element={<Guard front="business"><CampaignEditor key="edit"/></Guard>}/>
  <Route path="/business/instagram" element={<Guard front="business"><BusinessInstagram/></Guard>}/>
  <Route path="/business/settings" element={<Navigate to="/business/instagram" replace/>}/>
  <Route path="/earn/wallet" element={<Guard front="worker"><WalletPage/></Guard>}/>
  {['/business/wallet','/business/billing'].map(path=><Route key={path} path={path} element={<Guard front="business"><WalletPage/></Guard>}/>)}
  <Route path="/earn/profile" element={<Navigate to="/account" replace/>}/>
  <Route path="/admin/*" element={<Guard front="admin"><AdminPage/></Guard>}/>
  {(['help','terms','privacy'] as const).map(kind=><Route key={kind} path={`/${kind}`} element={<Guide kind={kind}/>}/>)}
  <Route path="*" element={<AuthFrame><span className="r-kicker">404</span><h1>Page not found.</h1><p>This page doesn’t exist.</p><Link className="r-button" to="/">Back to RealReach</Link></AuthFrame>}/>
</Routes></AuthProvider>;}
