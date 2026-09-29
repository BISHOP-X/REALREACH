import { Link } from 'react-router-dom';

export function Logo({to='/',light=false}:{to?:string;light?:boolean}) {
  return <Link to={to} className={`j-logo ${light?'is-light':''}`} aria-label="RealReach home"><svg className="j-mark" viewBox="0 0 58 36" fill="none" aria-hidden="true"><path d="M28 10C22 3 18 3 13 5C3 9 2 23 11 29C17 33 22 30 29 22L38 12" stroke="#f77959" strokeWidth="7" strokeLinecap="round"/><path d="M29 25C35 32 41 32 47 28C56 22 53 8 46 5C39 1 34 5 28 12L20 22" stroke="#d5ed83" strokeWidth="7" strokeLinecap="round"/></svg><span>realreach<span className="j-logo-dot">.</span></span></Link>;
}
