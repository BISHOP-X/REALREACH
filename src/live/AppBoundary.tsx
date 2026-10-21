import {Component, type ReactNode} from 'react';
import {ArrowRight, RefreshCw} from 'lucide-react';
import {Logo} from './Brand';

export class AppBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(!this.state.failed)return this.props.children;
    return <div className="r-loading"><Logo/><h1>Let’s get you back.</h1><p>This page couldn’t open. Reload to try again.</p><button className="r-button" onClick={()=>window.location.reload()}>Reload page <RefreshCw size={18}/></button><a className="r-text-button" href="/">Back to RealReach <ArrowRight size={17}/></a></div>;
  }
}
