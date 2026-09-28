import { Link, Route, Routes } from 'react-router-dom';
import { LandingPage } from '../App';
import { AuthProvider } from './AuthContext';
import { AuthCallback, AuthFrame, AuthPage } from './AuthPages';
import { AccountPage, AdminPage, BusinessInstagram, Guard, Overview, WalletPage, WorkerInstagram } from './Workspace';
import '../journey/journey.css';
import './live.css';

function Guide({kind}:{kind:'help'|'terms'|'privacy'}){
  const title={help:'A little clarity goes a long way.',terms:'The pilot, explained.',privacy:'Your information matters.'}[kind];
  return <AuthFrame><span className="r-kicker">REALREACH / EARLY ACCESS</span><h1>{title}</h1><div className="r-guide-copy">{kind==='privacy'?<><p>Real accounts store your email and account details in Supabase. Business owners and participating workers can see their own pilot activity, not everyone else’s.</p><p>Connecting Instagram uses a third-party authorization flow. We retain the account mapping and limited verification evidence needed for the pilot. Unrelated message content is not retained by our webhook handler.</p><p>The separately labelled demo stores sample progress in your browser. Don’t put real bank details in it. Detailed retention and support policies must be finalized before public launch.</p></>:<><p>RealReach is in an early-access, Instagram-only technical pilot. Real account access and provider verification are being introduced separately from the product demo.</p><p>Pilot participation is unpaid. There are no deposits, cash rewards or bank withdrawals. A check can be positive, negative or unknown; an unavailable provider is never counted as a success.</p><p>Use your own account and follow the instructions. Do not share verification codes or submit somebody else’s work. Comments and paid campaigns are not enabled in this pilot.</p><p>For a pilot issue, contact the person who invited you. Keep the task reference, but never share your password or authenticator codes.</p></>}</div><Link className="r-button" to="/account">Back to your account</Link><a className="r-text-button" href="/demo/earn">Explore the sample product</a></AuthFrame>;
}
export default function LiveApp(){return <AuthProvider><Routes>
  <Route path="/" element={<LandingPage/>}/>
  <Route path="/login" element={<AuthPage key="login" mode="login"/>}/>
  <Route path="/signup" element={<AuthPage key="signup" mode="signup"/>}/>
  <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot"/>}/>
  <Route path="/verify-email" element={<AuthPage key="verify" mode="verify"/>}/>
  <Route path="/reset-password" element={<AuthPage key="reset" mode="reset"/>}/>
  <Route path="/auth/callback" element={<AuthCallback/>}/>
  <Route path="/account" element={<Guard><AccountPage/></Guard>}/>
  <Route path="/earn" element={<Guard><Overview/></Guard>}/>
  <Route path="/business" element={<Guard><Overview business/></Guard>}/>
  <Route path="/earn/instagram" element={<Guard><WorkerInstagram/></Guard>}/>
  <Route path="/earn/my-tasks" element={<Guard><WorkerInstagram/></Guard>}/>
  <Route path="/business/instagram" element={<Guard><BusinessInstagram/></Guard>}/>
  <Route path="/business/settings" element={<Guard><BusinessInstagram/></Guard>}/>
  {['/earn/wallet','/business/wallet','/business/billing'].map(path=><Route key={path} path={path} element={<Guard><WalletPage/></Guard>}/>)}
  <Route path="/earn/profile" element={<Guard><AccountPage/></Guard>}/>
  <Route path="/admin/*" element={<Guard admin><AdminPage/></Guard>}/>
  {(['help','terms','privacy'] as const).map(kind=><Route key={kind} path={`/${kind}`} element={<Guide kind={kind}/>}/>)}
  <Route path="*" element={<AuthFrame><span className="r-kicker">404 / A LITTLE OFF TRACK</span><h1>Let’s get you home.</h1><p>This page isn’t part of the current pilot.</p><Link className="r-button" to="/">Return to RealReach</Link></AuthFrame>}/>
</Routes></AuthProvider>;}
